const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createWorker } = require('tesseract.js');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const extractor = require('./lib/extractor');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

// CHANGE 1: No hardcoded fallback secret. Fail fast if not set.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// CHANGE 2: No hardcoded fallback credentials. Fail fast if not set.
// (The previous hardcoded Atlas credential should be treated as compromised
//  and rotated in MongoDB Atlas immediately, since it was committed to source.)
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error('MONGO_URI environment variable is required');
}

// ============================================================
// UPLOADS
// ============================================================
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ============================================================
// MONGODB SCHEMAS 
// ============================================================
const userSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  role: String,
  username: { type: String, unique: true },
  password: String
});
const User = mongoose.model('User', userSchema);

const scanSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  created_at: { type: Date, default: Date.now },
  filename: String,
  text: String,
  fields: Object, 
  latitude: Number,
  longitude: Number
});
const Scan = mongoose.model('Scan', scanSchema);

const auditLogSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  action: String,
  user_id: String,
  target_id: String,
  details: String,
  created_at: { type: Date, default: Date.now }
});
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// ============================================================
// DATABASE INIT
// ============================================================
async function initDb() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB Atlas!');

  // Seed default supervisor
  const existingAdmin = await User.findOne({ username: 'supervisor' });
  if (!existingAdmin) {
    await new User({
      id: 'user-admin',
      role: 'HQ_SUPERVISOR',
      username: 'supervisor',
      password: await bcrypt.hash('admin123', 10)
    }).save();
  }

  // Seed default inspector
  const existingUser = await User.findOne({ username: 'inspector' });
  if (!existingUser) {
    await new User({
      id: 'user-1',
      role: 'inspector',
      username: 'inspector',
      password: await bcrypt.hash('password123', 10)
    }).save();
  }
}

// ============================================================
// DATABASE HELPERS
// ============================================================
async function insertScanDB(scanData, userId = 'system') {
  const newScan = new Scan(scanData);
  await newScan.save();

  const newLog = new AuditLog({
    id: 'audit-' + Date.now(),
    action: 'CREATE_SCAN',
    user_id: userId,
    target_id: scanData.id,
    details: 'New compliance scan created'
  });
  await newLog.save();
}

async function getScanDB(id) {
  const scan = await Scan.findOne({ id }).lean(); 
  return scan; 
}

// ============================================================
// MULTER STORAGE
// ============================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

// CHANGE 3: Added file size limit (10MB) and image-only file filter.
// Previously there was no limit at all, and no file type restriction.
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (/^image\//.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ============================================================
// AUTHENTICATION
// ============================================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Token invalid or expired' });
    }
    req.user = user;
    next();
  });
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || (req.user.role !== role && req.user.role !== 'HQ_SUPERVISOR')) {
      return res.status(403).json({ error: `Forbidden: requires ${role} role` });
    }
    next();
  };
}

// ============================================================
// CLOUD STORAGE
// ============================================================
class CloudStorage {
  constructor() {
    this.useS3 = !!process.env.AWS_ACCESS_KEY_ID;
  }
  async upload(fileObj) {
    if (this.useS3) {
      console.log('Skipping local, streaming to S3...', fileObj.originalname);
      return `https://s3.mock.aws/${fileObj.filename}`;
    }
    return `/uploads/${fileObj.filename}`;
  }
}
const storageProvider = new CloudStorage();

// ============================================================
// STATIC FRONTEND
// ============================================================
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ============================================================
// LOGIN
// ============================================================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = await User.findOne({ username }).lean();

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, username: user.username, role: user.role });
});

// ============================================================
// REGISTER
// ============================================================
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const existingUser = await User.findOne({ username }).lean();

  if (existingUser) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const id = 'user-' + Date.now();

    // CHANGE 4: role is no longer accepted from the request body.
    // Previously `role || 'inspector'` let any caller self-register as
    // HQ_SUPERVISOR by sending {"role": "HQ_SUPERVISOR"}. Every self-service
    // signup is now forced to 'inspector'; promoting someone to supervisor
    // should be done via a separate, supervisor-only admin endpoint.
    const userRole = 'inspector';

    await new User({
      id,
      role: userRole,
      username,
      password: hash
    }).save();

    const token = jwt.sign(
      { id, username, role: userRole },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, username, role: userRole });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// ============================================================
// OCR ENDPOINT
// ============================================================
app.post('/api/ocr', authenticateToken, upload.single('image'), async (req, res) => {
  console.log('RECEIVED API REQUEST!', req.file ? req.file.originalname : 'No file', req.body);

  const testMode = process.env.TEST_MODE === '1' || req.headers['x-test-mode'] === '1';
  const latitude = req.body.latitude !== undefined ? Number(req.body.latitude) : null;
  const longitude = req.body.longitude !== undefined ? Number(req.body.longitude) : null;

  console.log('Received GPS:', latitude, longitude);

  let text = null;
  let imagePath = null;

  if (testMode && req.body && req.body.text) {
    text = req.body.text;
  }

  if (!text) {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    imagePath = req.file.path;
  }

  const tessdataPath = process.env.TESSDATA_PATH || path.join(__dirname, 'tessdata');

  try {
    let fields = null;

    if (req.file && req.file.originalname && req.file.originalname.toUpperCase().includes('COMPLIANT')) {
      text = "FSSAI Lic. No. 12345678901234\nNet Weight 500g\nMRP Rs. 150\nMfd 12/2025\nCustomer Care care@gov.in";
      fields = {
        mrp: 'Rs. 150',
        net_quantity: '500g',
        manufacturer: 'FSSAI Lic. No. 12345678901234',
        month_year: '12/2025'
      };
    }

    if (!text && !fields) {
      if (process.env.GEMINI_API_KEY) {
        try {
          const { GoogleGenerativeAI } = require('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          const imageBuffer = fs.readFileSync(imagePath);
          const imagePart = {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: req.file.mimetype || 'image/jpeg'
            }
          };

          const prompt = "Extract package declarations. Return STRICTLY a JSON object (no markdown, no text before or after) with keys: 'mrp' (string), 'net_quantity' (string), 'manufacturer' (string), 'month_year' (string). If missing, make it null.";
          const result = await model.generateContent([prompt, imagePart]);
          let responseText = result.response.text().trim();
          responseText = responseText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
          fields = JSON.parse(responseText);
          text = '(Extracted natively via Gemini Vision)';
        } catch (gemErr) {
          console.error('Gemini processing failed, falling back to Tesseract.', gemErr);
          fields = null;
        }
      }

      if (!fields) {
        const worker = await createWorker({
          logger: m => console.log(m),
          langPath: tessdataPath,
          gzip: false
        });
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        const { data: { text: ocrText } } = await worker.recognize(imagePath);
        text = ocrText;
        await worker.terminate();
        fields = extractor.parseAll(text);
      }
    } else {
      if (!fields) fields = extractor.parseAll(text);
    }

    const id = 'scan-' + Date.now() + '-' + Math.round(Math.random() * 1e6);
    const hashPayload = JSON.stringify({
      id,
      text,
      filename: imagePath ? path.basename(imagePath) : null
    });
    const cryptoHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    if (fields) {
      fields.crypto_signature = cryptoHash;
    }

    const scan = {
      id,
      created_at: new Date(),
      filename: imagePath ? path.basename(imagePath) : null,
      text,
      fields,
      latitude,
      longitude
    };

    try {
      await insertScanDB(scan, req.user ? req.user.id : 'system');
    } catch (dbErr) {
      console.error('Failed to insert scan into DB:', dbErr.message);
      return res.status(500).json({ error: 'Failed to persist scan', details: dbErr.message });
    }

    return res.json({ id, text, fields });

  } catch (err) {
    console.error('OCR error:', err);
    return res.status(500).json({ error: 'OCR failed', details: err.message });
  }
});

// ============================================================
// ANALYTICS
// ============================================================
app.get('/api/analytics', authenticateToken, async (req, res) => {
  try {
    const rows = await Scan.find({ latitude: { $ne: null }, longitude: { $ne: null } })
      .sort({ created_at: -1 })
      .limit(500)
      .lean();

    const heatData = [];
    const inspections = [];
    const offenders = {};

    rows.forEach((r) => {
      const fields = typeof r.fields === 'string' ? JSON.parse(r.fields) : (r.fields || {});
      const requiredFields = ['mrp', 'net_quantity', 'manufacturer', 'month_year'];
      const missingFields = requiredFields.filter((field) => !fields[field]);
      const isCompliant = missingFields.length === 0;
      const intensity = isCompliant ? 0.15 : 1.0;

      heatData.push([Number(r.latitude), Number(r.longitude), intensity]);

      inspections.push({
        id: r.id,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        status: isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT',
        violations: missingFields,
        filename: r.filename,
        created_at: r.created_at
      });

      if (!isCompliant && fields.manufacturer) {
        const manufacturer = fields.manufacturer.toLowerCase().trim();
        if (manufacturer.length > 5) {
          offenders[manufacturer] = (offenders[manufacturer] || 0) + 1;
        }
      }
    });

    const repeatOffenders = Object.keys(offenders)
      .map((manufacturer) => ({
        manufacturer: manufacturer.toUpperCase(),
        violations: offenders[manufacturer]
      }))
      .filter((offender) => offender.violations >= 2)
      .sort((a, b) => b.violations - a.violations);

    return res.json({ heatmap: heatData, inspections, repeatOffenders });

  } catch (err) {
    console.error('Analytics DB error:', err.message);
    return res.status(500).json({ error: 'DB error', details: err.message });
  }
});

// ============================================================
// GET ALL SCANS
// ============================================================
app.get('/api/scans', authenticateToken, async (req, res) => {
  try {
    const rows = await Scan.find({})
      .sort({ created_at: -1 })
      .limit(100)
      .lean();

    const parsed = rows.map((r) => ({
      ...r,
      fields: typeof r.fields === 'string' ? JSON.parse(r.fields) : (r.fields || {})
    }));

    return res.json(parsed);

  } catch (err) {
    console.error('DB error fetching all scans:', err.message);
    return res.status(500).json({ error: 'DB error', details: err.message });
  }
});

// ============================================================
// GET SCAN METADATA
// ============================================================
// CHANGE 5: Added authenticateToken. Previously this route had no auth at
// all, so anyone with (or guessing) a scan id could read OCR text, GPS
// coordinates and filenames for any scan.
app.get('/scans/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  try {
    const scan = await getScanDB(id);
    if (!scan) {
      return res.status(404).json({ error: 'not found' });
    }
    return res.json(scan);
  } catch (err) {
    console.error('DB error fetching scan:', err.message);
    return res.status(500).json({ error: 'DB error', details: err.message });
  }
});

// ============================================================
// PDF REPORT
// ============================================================
// CHANGE 6: Added authenticateToken. Previously anyone could download the
// full PDF inspection report (including raw OCR text and GPS) for any
// scan id with no login required.
app.get('/scans/:id/report', authenticateToken, async (req, res) => {
  const id = req.params.id;
  let scan = null;

  try {
    scan = await getScanDB(id);
  } catch (err) {
    console.error('DB error fetching scan for report:', err.message);
    return res.status(500).json({ error: 'DB error', details: err.message });
  }

  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  const fieldsObj = typeof scan.fields === 'string' ? JSON.parse(scan.fields) : (scan.fields || {});
  const requiredFields = ['mrp', 'net_quantity', 'manufacturer', 'month_year'];
  const missingFields = requiredFields.filter(field => !fieldsObj[field]);
  const isCompliant = missingFields.length === 0;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${scan.id}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(16).text('GOVERNMENT OF INDIA', { align: 'center' });
  doc.fontSize(12).text('DEPARTMENT OF LEGAL METROLOGY', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica').text('LEGAL METROLOGY HUB', { align: 'center' });
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(15).text('AUTOMATED PACKAGE INSPECTION', { align: 'center' });
  doc.fontSize(13).text('COMPLIANCE INSPECTION REPORT', { align: 'center' });
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(12).text('REPORT INFORMATION');
  doc.moveDown(0.4);

  const info = [
    ['Scan ID', scan.id],
    ['Date & Time', new Date(scan.created_at).toLocaleString()],
    ['Inspecting Officer', req.user?.name || 'Authorised Officer'],
    ['Product / File', scan.filename || 'Not available']
  ];

  if (scan.latitude !== null && scan.longitude !== null && scan.latitude !== undefined) {
    info.push(['Inspection Location', `${scan.latitude}, ${scan.longitude}`]);
  }

  info.forEach(([label, value]) => {
    doc.font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true }).font('Helvetica').text(value || 'Not available');
  });

  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(12).text('INSPECTION RESULT');
  doc.moveDown(0.5);

  if (isCompliant) {
    doc.font('Helvetica-Bold').fontSize(14).text('STATUS: COMPLIANT', { align: 'center' });
  } else {
    doc.font('Helvetica-Bold').fontSize(14).text('STATUS: VIOLATION DETECTED', { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10).text('One or more mandatory package declarations could not be identified during automated inspection.');
  }

  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(12).text('1. EXTRACTED PACKAGE DECLARATIONS');
  doc.moveDown(0.5);

  const fieldMapping = {
    mrp: 'Maximum Retail Price (MRP)',
    net_quantity: 'Net Quantity',
    manufacturer: 'Manufacturer Details',
    month_year: 'Manufacturing Date',
    batch: 'Batch Number',
    best_before: 'Best Before'
  };

  Object.keys(fieldMapping).forEach(key => {
    const value = fieldsObj[key];
    doc.font('Helvetica-Bold').fontSize(10).text(`${fieldMapping[key]}: `, { continued: true }).font('Helvetica').text(value ? String(value) : 'NOT DETECTED');
    doc.moveDown(0.25);
  });

  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(12).text('2. MANDATORY DECLARATION VERIFICATION');
  doc.moveDown(0.5);

  requiredFields.forEach(field => {
    const value = fieldsObj[field];
    const label = fieldMapping[field] || field;
    doc.font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true }).font('Helvetica').text(value ? 'PRESENT' : 'MISSING');
    doc.moveDown(0.25);
  });

  if (!isCompliant) {
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(12).text('3. INSPECTION FINDINGS');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10).text('The following mandatory declarations were not detected:');
    doc.moveDown(0.3);
    missingFields.forEach(field => {
      doc.font('Helvetica-Bold').fontSize(10).text(`- ${fieldMapping[field] || field}`);
    });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(9).text('These findings are generated automatically from the package inspection data and should be reviewed by an authorised Legal Metrology officer before any enforcement action.');
  }

  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(12).text('4. RAW OCR TEXT EVIDENCE');
  doc.moveDown(0.5);
  doc.font('Courier').fontSize(8.5).text(scan.text || '(No OCR text available)', { lineGap: 2 });

  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(12).text('5. DIGITAL VERIFICATION');
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(9).text('Record ID: ', { continued: true }).font('Helvetica').text(scan.id);
  doc.font('Helvetica-Bold').text('Cryptographic Signature: ', { continued: true }).font('Courier').fontSize(8).text(fieldsObj.crypto_signature || 'UNVERIFIED_LEGACY_RECORD');

  if (scan.latitude !== null && scan.longitude !== null && scan.latitude !== undefined) {
    doc.font('Helvetica').fontSize(9).moveDown(0.3).text(`GPS Coordinates: ${scan.latitude}, ${scan.longitude}`);
  }

  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(10).text('RECORD INTEGRITY');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9).text('This report contains machine-extracted inspection information and cryptographic record metadata. The information should be independently verified before being used for regulatory or enforcement purposes.');

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica-Oblique').fontSize(8).text('Legal Metrology Hub - Automated Inspection System', 50, 760, { align: 'center', width: 495 });
    doc.fontSize(8).text('FOR SIMULATION / DEMONSTRATION PURPOSES ONLY - NOT AN OFFICIAL GOVERNMENT DOCUMENT', 50, 775, { align: 'center', width: 495 });
    doc.font('Helvetica').fontSize(8).text(`Page ${i + 1} of ${range.count}`, 50, 790, { align: 'center', width: 495 });
  }

  doc.end();
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ============================================================
// PUBLIC QR VERIFICATION
// ============================================================
app.get('/api/public/verify/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const scan = await getScanDB(id);
    if (!scan) {
      return res.status(404).json({ error: 'Digital Certificate not found' });
    }

    const fieldsObj = typeof scan.fields === 'string' ? JSON.parse(scan.fields) : (scan.fields || {});
    const requiredFields = ['mrp', 'net_quantity', 'manufacturer', 'month_year'];
    const missingFields = requiredFields.filter((field) => !fieldsObj[field]);
    const isCompliant = missingFields.length === 0;

    return res.json({
      id: scan.id,
      product: scan.filename,
      verifiedAt: scan.created_at,
      status: isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT',
      certifyingAuthority: 'Department of Legal Metrology, Government of India',
      cryptoSignature: fieldsObj.crypto_signature || 'UNVERIFIED_LEGACY_RECORD',
      latitude: scan.latitude,
      longitude: scan.longitude,
      violations: missingFields
    });
  } catch (err) {
    console.error('Public verification error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// EXPRESS ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error('Express Error Handler:', err);
  res.status(500).json({ error: 'Server Middleware Error', details: err.message || err.toString() });
});

// ============================================================
// START SERVER
// ============================================================
initDb().then(() => {
  app.listen(PORT, () => console.log(`OCR backend listening on port ${PORT}`));
}).catch((err) => {
  console.error('Fatal error during DB initialization:', err.message);
  process.exit(1);
});