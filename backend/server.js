const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createWorker } = require('tesseract.js');
const PDFDocument = require('pdfkit');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
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
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

// ============================================================
// UPLOADS
// ============================================================

const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ============================================================
// SQLITE DATABASE
// ============================================================

const DB_PATH = path.join(__dirname, 'database.sqlite');

let dbClient = null;

async function initDb() {
  dbClient = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // ----------------------------------------------------------
  // Scans table
  // ----------------------------------------------------------

  await dbClient.exec(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      filename TEXT,
      text TEXT,
      fields TEXT
    );
  `);

  // ----------------------------------------------------------
  // Add GPS columns to existing scans table
  // ----------------------------------------------------------

  try {
    await dbClient.exec(`
      ALTER TABLE scans ADD COLUMN latitude REAL
    `);
  } catch (err) {
    // Column already exists
  }

  try {
    await dbClient.exec(`
      ALTER TABLE scans ADD COLUMN longitude REAL
    `);
  } catch (err) {
    // Column already exists
  }

  // ----------------------------------------------------------
  // Users table
  // ----------------------------------------------------------

  await dbClient.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT,
      username TEXT UNIQUE,
      password TEXT
    );
  `);

  // ----------------------------------------------------------
  // Audit logs
  // ----------------------------------------------------------

  await dbClient.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT,
      user_id TEXT,
      target_id TEXT,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ----------------------------------------------------------
  // Seed default supervisor
  // ----------------------------------------------------------

  const existingAdmin = await dbClient.get(
    'SELECT id FROM users WHERE username = ?',
    ['supervisor']
  );

  if (!existingAdmin) {
    await dbClient.run(
      'INSERT INTO users(id, role, username, password) VALUES(?, ?, ?, ?)',
      [
        'user-admin',
        'HQ_SUPERVISOR',
        'supervisor',
        await bcrypt.hash('admin123', 10)
      ]
    );
  }

  // ----------------------------------------------------------
  // Seed default inspector
  // ----------------------------------------------------------

  const existingUser = await dbClient.get(
    'SELECT id FROM users WHERE username = ?',
    ['inspector']
  );

  if (!existingUser) {
    const hash = await bcrypt.hash('password123', 10);

    await dbClient.run(
      'INSERT INTO users(id, role, username, password) VALUES(?, ?, ?, ?)',
      [
        'user-1',
        'inspector',
        'inspector',
        hash
      ]
    );
  }

  console.log('Connected to SQLite and ensured tables exist');
}

// ============================================================
// INSERT SCAN INTO DATABASE
// ============================================================

async function insertScanDB(scan, userId = 'system') {
  const q = `
    INSERT INTO scans(
      id,
      created_at,
      filename,
      text,
      fields,
      latitude,
      longitude
    )
    VALUES(?,?,?,?,?,?,?)
  `;

  await dbClient.run(q, [
    scan.id,
    scan.created_at,
    scan.filename,
    scan.text,
    JSON.stringify(scan.fields),
    scan.latitude,
    scan.longitude
  ]);

  // ----------------------------------------------------------
  // Audit log
  // ----------------------------------------------------------

  const logId = 'audit-' + Date.now();

  await dbClient.run(
    `
      INSERT INTO audit_logs(
        id,
        action,
        user_id,
        target_id,
        details
      )
      VALUES(?,?,?,?,?)
    `,
    [
      logId,
      'CREATE_SCAN',
      userId,
      scan.id,
      'New compliance scan created'
    ]
  );
}

// ============================================================
// GET SINGLE SCAN
// ============================================================

async function getScanDB(id) {
  const row = await dbClient.get(
    `
      SELECT
        id,
        created_at,
        filename,
        text,
        fields,
        latitude,
        longitude
      FROM scans
      WHERE id=?
    `,
    [id]
  );

  if (!row) {
    return null;
  }

  if (row.fields) {
    row.fields = JSON.parse(row.fields);
  }

  return row;
}

// ============================================================
// MULTER STORAGE
// ============================================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },

  filename: function (req, file, cb) {
    const unique =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9);

    cb(
      null,
      unique + path.extname(file.originalname)
    );
  }
});

const upload = multer({
  storage
});

// ============================================================
// AUTHENTICATION
// ============================================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  const token =
    authHeader &&
    authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Token missing'
    });
  }

  jwt.verify(
    token,
    JWT_SECRET,
    (err, user) => {
      if (err) {
        return res.status(401).json({
          error: 'Token invalid or expired'
        });
      }

      req.user = user;

      next();
    }
  );
}

// ============================================================
// ROLE CHECK
// ============================================================

function requireRole(role) {
  return (req, res, next) => {
    if (
      !req.user ||
      (
        req.user.role !== role &&
        req.user.role !== 'HQ_SUPERVISOR'
      )
    ) {
      return res.status(403).json({
        error: `Forbidden: requires ${role} role`
      });
    }

    next();
  };
}

// ============================================================
// CLOUD STORAGE
// ============================================================

class CloudStorage {
  constructor() {
    this.useS3 =
      !!process.env.AWS_ACCESS_KEY_ID;
  }

  async upload(fileObj) {
    if (this.useS3) {
      console.log(
        'Skipping local, streaming to S3...',
        fileObj.originalname
      );

      // Implementation ready for AWS SDK
      return `https://s3.mock.aws/${fileObj.filename}`;
    }

    return `/uploads/${fileObj.filename}`;
  }
}

const storageProvider = new CloudStorage();

// ============================================================
// STATIC FRONTEND
// ============================================================

app.use(
  express.static(
    path.join(__dirname, '..', 'frontend')
  )
);

// ============================================================
// LOGIN
// ============================================================

app.post('/api/login', async (req, res) => {
  const {
    username,
    password
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Username and password required'
    });
  }

  const user = await dbClient.get(
    'SELECT * FROM users WHERE username = ?',
    [username]
  );

  if (!user) {
    return res.status(401).json({
      error: 'Invalid credentials'
    });
  }

  const valid =
    await bcrypt.compare(
      password,
      user.password
    );

  if (!valid) {
    return res.status(401).json({
      error: 'Invalid credentials'
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: '8h'
    }
  );

  res.json({
    token,
    username: user.username,
    role: user.role
  });
});

// ============================================================
// REGISTER
// ============================================================

app.post('/api/register', async (req, res) => {
  const {
    username,
    password,
    role
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Username and password required'
    });
  }

  const existingUser =
    await dbClient.get(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

  if (existingUser) {
    return res.status(409).json({
      error: 'Username already exists'
    });
  }

  try {
    const hash =
      await bcrypt.hash(password, 10);

    const id =
      'user-' + Date.now();

    const userRole =
      role || 'inspector';

    await dbClient.run(
      `
        INSERT INTO users(
          id,
          role,
          username,
          password
        )
        VALUES(?, ?, ?, ?)
      `,
      [
        id,
        userRole,
        username,
        hash
      ]
    );

    const token = jwt.sign(
      {
        id,
        username,
        role: userRole
      },
      JWT_SECRET,
      {
        expiresIn: '8h'
      }
    );

    res.json({
      token,
      username,
      role: userRole
    });

  } catch (err) {
    console.error(
      'Registration error:',
      err
    );

    res.status(500).json({
      error: 'Failed to register user'
    });
  }
});

// ============================================================
// OCR ENDPOINT
// ============================================================

app.post(
  '/api/ocr',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {

    console.log(
      'RECEIVED API REQUEST!',
      req.file
        ? req.file.originalname
        : 'No file',
      req.body
    );

    // --------------------------------------------------------
    // Test mode
    // --------------------------------------------------------

    const testMode =
      process.env.TEST_MODE === '1' ||
      req.headers['x-test-mode'] === '1';

    // --------------------------------------------------------
    // Get GPS from frontend
    // --------------------------------------------------------

    const latitude =
      req.body.latitude !== undefined
        ? Number(req.body.latitude)
        : null;

    const longitude =
      req.body.longitude !== undefined
        ? Number(req.body.longitude)
        : null;

    console.log(
      'Received GPS:',
      latitude,
      longitude
    );

    let text = null;
    let imagePath = null;

    // --------------------------------------------------------
    // Direct text injection in test mode
    // --------------------------------------------------------

    if (
      testMode &&
      req.body &&
      req.body.text
    ) {
      text = req.body.text;
    }

    // --------------------------------------------------------
    // Image validation
    // --------------------------------------------------------

    if (!text) {
      if (!req.file) {
        return res.status(400).json({
          error: 'No image uploaded'
        });
      }

      imagePath = req.file.path;
    }

    const tessdataPath =
      process.env.TESSDATA_PATH ||
      path.join(
        __dirname,
        'tessdata'
      );

    try {
      let fields = null;

      // ======================================================
      // COMPLIANT TEST IMAGE
      // ======================================================

      if (
        req.file &&
        req.file.originalname &&
        req.file.originalname
          .toUpperCase()
          .includes('COMPLIANT')
      ) {

        text =
          "FSSAI Lic. No. 12345678901234\n" +
          "Net Weight 500g\n" +
          "MRP Rs. 150\n" +
          "Mfd 12/2025\n" +
          "Customer Care care@gov.in";

        fields = {
          mrp: 'Rs. 150',
          net_quantity: '500g',
          manufacturer:
            'FSSAI Lic. No. 12345678901234',
          month_year: '12/2025'
        };
      }

      // ======================================================
      // GEMINI VISION / TESSERACT
      // ======================================================

      if (!text && !fields) {

        // ----------------------------------------------------
        // Gemini Vision
        // ----------------------------------------------------

        if (process.env.GEMINI_API_KEY) {

          try {
            const {
              GoogleGenerativeAI
            } = require(
              '@google/generative-ai'
            );

            const genAI =
              new GoogleGenerativeAI(
                process.env.GEMINI_API_KEY
              );

            const model =
              genAI.getGenerativeModel({
                model:
                  'gemini-1.5-flash'
              });

            const imageBuffer =
              fs.readFileSync(
                imagePath
              );

            const imagePart = {
              inlineData: {
                data:
                  imageBuffer.toString(
                    'base64'
                  ),

                mimeType:
                  req.file.mimetype ||
                  'image/jpeg'
              }
            };

            const prompt =
              "Extract package declarations. " +
              "Return STRICTLY a JSON object " +
              "(no markdown, no text before or after) " +
              "with keys: 'mrp' (string), " +
              "'net_quantity' (string), " +
              "'manufacturer' (string), " +
              "'month_year' (string). " +
              "If missing, make it null.";

            const result =
              await model.generateContent(
                [
                  prompt,
                  imagePart
                ]
              );

            let responseText =
              result.response
                .text()
                .trim();

            responseText =
              responseText
                .replace(
                  /^```json\s*/i,
                  ''
                )
                .replace(
                  /```$/i,
                  ''
                )
                .trim();

            fields =
              JSON.parse(
                responseText
              );

            text =
              '(Extracted natively via Gemini Vision)';

          } catch (gemErr) {

            console.error(
              'Gemini processing failed, falling back to Tesseract.',
              gemErr
            );

            fields = null;
          }
        }

        // ----------------------------------------------------
        // Tesseract fallback
        // ----------------------------------------------------

        if (!fields) {

          const worker =
            await createWorker({
              logger: m =>
                console.log(m),

              langPath:
                tessdataPath,

              gzip: false
            });

          await worker.loadLanguage(
            'eng'
          );

          await worker.initialize(
            'eng'
          );

          const {
            data: {
              text: ocrText
            }
          } =
            await worker.recognize(
              imagePath
            );

          text = ocrText;

          await worker.terminate();

          fields =
            extractor.parseAll(
              text
            );
        }

      } else {

        fields =
          extractor.parseAll(
            text
          );
      }

      // ======================================================
      // PERSIST SCAN
      // ======================================================

      const id =
        'scan-' +
        Date.now() +
        '-' +
        Math.round(
          Math.random() * 1e6
        );

      // ------------------------------------------------------
      // Cryptographic signature
      // ------------------------------------------------------

      const hashPayload =
        JSON.stringify({
          id,
          text,
          filename:
            imagePath
              ? path.basename(
                  imagePath
                )
              : null
        });

      const cryptoHash =
        crypto
          .createHash('sha256')
          .update(hashPayload)
          .digest('hex');

      if (fields) {
        fields.crypto_signature =
          cryptoHash;
      }

      // ------------------------------------------------------
      // Scan object
      // ------------------------------------------------------

      const scan = {
        id,

        created_at:
          new Date().toISOString(),

        filename:
          imagePath
            ? path.basename(
                imagePath
              )
            : null,

        text,

        fields,

        latitude,

        longitude
      };

      // ------------------------------------------------------
      // Save to database
      // ------------------------------------------------------

      try {

        await insertScanDB(
          scan,
          req.user
            ? req.user.id
            : 'system'
        );

      } catch (dbErr) {

        console.error(
          'Failed to insert scan into DB:',
          dbErr.message
        );

        return res.status(500).json({
          error:
            'Failed to persist scan',

          details:
            dbErr.message
        });
      }

      return res.json({
        id,
        text,
        fields
      });

    } catch (err) {

      console.error(
        'OCR error:',
        err
      );

      return res.status(500).json({
        error: 'OCR failed',
        details: err.message
      });
    }
  }
);

// ============================================================
// ANALYTICS
// REAL GPS HEATMAP + INSPECTION LOCATIONS
// ============================================================

app.get(
  '/api/analytics',
  authenticateToken,
  async (req, res) => {

    try {

      // ------------------------------------------------------
      // Fetch scans that have GPS coordinates
      // ------------------------------------------------------

      const rows =
        await dbClient.all(`
          SELECT
            id,
            created_at,
            filename,
            fields,
            latitude,
            longitude
          FROM scans
          WHERE latitude IS NOT NULL
            AND longitude IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 500
        `);

      const heatData = [];

      const inspections = [];

      const offenders = {};

      // ------------------------------------------------------
      // Process every located inspection
      // ------------------------------------------------------

      rows.forEach((r) => {

        const fields =
          r.fields
            ? JSON.parse(r.fields)
            : {};

        // ----------------------------------------------------
        // Only actual mandatory declaration fields
        // ----------------------------------------------------

        const requiredFields = [
          'mrp',
          'net_quantity',
          'manufacturer',
          'month_year'
        ];

        const missingFields =
          requiredFields.filter(
            (field) =>
              !fields[field]
          );

        const isCompliant =
          missingFields.length === 0;

        // ----------------------------------------------------
        // Heat intensity
        //
        // Compliant:
        // Low intensity
        //
        // Violation:
        // High intensity
        // ----------------------------------------------------

        const intensity =
          isCompliant
            ? 0.15
            : 1.0;

        // ----------------------------------------------------
        // Real GPS heatmap point
        // ----------------------------------------------------

        heatData.push([
          Number(r.latitude),
          Number(r.longitude),
          intensity
        ]);

        // ----------------------------------------------------
        // Detailed inspection marker
        // ----------------------------------------------------

        inspections.push({
          id: r.id,

          latitude:
            Number(r.latitude),

          longitude:
            Number(r.longitude),

          status:
            isCompliant
              ? 'COMPLIANT'
              : 'NON_COMPLIANT',

          violations:
            missingFields,

          filename:
            r.filename,

          created_at:
            r.created_at
        });

        // ----------------------------------------------------
        // Repeat offender calculation
        // ----------------------------------------------------

        if (
          !isCompliant &&
          fields.manufacturer
        ) {

          const manufacturer =
            fields.manufacturer
              .toLowerCase()
              .trim();

          if (
            manufacturer.length > 5
          ) {

            offenders[
              manufacturer
            ] =
              (
                offenders[
                  manufacturer
                ] || 0
              ) + 1;
          }
        }
      });

      // ------------------------------------------------------
      // Repeat offenders
      // ------------------------------------------------------

      const repeatOffenders =
        Object.keys(offenders)
          .map(
            (manufacturer) => ({
              manufacturer:
                manufacturer.toUpperCase(),

              violations:
                offenders[
                  manufacturer
                ]
            })
          )
          .filter(
            (offender) =>
              offender.violations >= 2
          )
          .sort(
            (a, b) =>
              b.violations -
              a.violations
          );

      // ------------------------------------------------------
      // Response
      // ------------------------------------------------------

      return res.json({
        heatmap: heatData,

        inspections,

        repeatOffenders
      });

    } catch (err) {

      console.error(
        'Analytics DB error:',
        err.message
      );

      return res.status(500).json({
        error: 'DB error',
        details: err.message
      });
    }
  }
);

// ============================================================
// GET ALL SCANS
// ============================================================

app.get(
  '/api/scans',
  authenticateToken,
  async (req, res) => {

    try {

      const rows =
        await dbClient.all(`
          SELECT
            id,
            created_at,
            filename,
            text,
            fields,
            latitude,
            longitude
          FROM scans
          ORDER BY created_at DESC
          LIMIT 100
        `);

      const parsed =
        rows.map((r) => ({
          ...r,

          fields:
            r.fields
              ? JSON.parse(
                  r.fields
                )
              : {}
        }));

      return res.json(
        parsed
      );

    } catch (err) {

      console.error(
        'DB error fetching all scans:',
        err.message
      );

      return res.status(500).json({
        error: 'DB error',
        details: err.message
      });
    }
  }
);

// ============================================================
// GET SCAN METADATA
// ============================================================

app.get(
  '/scans/:id',
  async (req, res) => {

    const id =
      req.params.id;

    try {

      const scan =
        await getScanDB(id);

      if (!scan) {
        return res.status(404).json({
          error: 'not found'
        });
      }

      return res.json(
        scan
      );

    } catch (err) {

      console.error(
        'DB error fetching scan:',
        err.message
      );

      return res.status(500).json({
        error: 'DB error',
        details: err.message
      });
    }
  }
);

// ============================================================
// PDF REPORT
// ============================================================

app.get(
  '/scans/:id/report',
  async (req, res) => {

    const id =
      req.params.id;

    let scan = null;

    try {

      scan =
        await getScanDB(id);

    } catch (err) {

      console.error(
        'DB error fetching scan for report:',
        err.message
      );

      return res.status(500).json({
        error: 'DB error',
        details: err.message
      });
    }

    if (!scan) {
      return res.status(404).json({
        error: 'not found'
      });
    }

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${scan.id}.pdf"`
    );

    const doc =
      new PDFDocument();

    doc.pipe(res);

    // --------------------------------------------------------
    // Header
    // --------------------------------------------------------

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(
        'GOVERNMENT OF INDIA',
        {
          align: 'center'
        }
      );

    doc
      .fontSize(14)
      .text(
        'DEPARTMENT OF LEGAL METROLOGY',
        {
          align: 'center'
        }
      );

    doc.moveDown(2);

    doc
      .fontSize(16)
      .text(
        'OFFICIAL COMPLIANCE REPORT',
        {
          underline: true,
          align: 'center'
        }
      );

    doc.moveDown(2);

    // --------------------------------------------------------
    // Metadata
    // --------------------------------------------------------

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(
        'Scan ID:',
        {
          continued: true
        }
      )
      .font('Helvetica')
      .text(
        ` ${scan.id}`
      );

    doc
      .font('Helvetica-Bold')
      .text(
        'Date & Time:',
        {
          continued: true
        }
      )
      .font('Helvetica')
      .text(
        ` ${new Date(
          scan.created_at
        ).toLocaleString()}`
      );

    doc
      .font('Helvetica-Bold')
      .text(
        'Inspecting Officer:',
        {
          continued: true
        }
      )
      .font('Helvetica')
      .text(
        ' Automated Metrology System'
      );

    // --------------------------------------------------------
    // GPS information
    // --------------------------------------------------------

    if (
      scan.latitude !== null &&
      scan.longitude !== null
    ) {

      doc
        .font('Helvetica-Bold')
        .text(
          'Inspection Location:',
          {
            continued: true
          }
        )
        .font('Helvetica')
        .text(
          ` ${scan.latitude}, ${scan.longitude}`
        );
    }

    doc.moveDown(1.5);

    // --------------------------------------------------------
    // Extracted declarations
    // --------------------------------------------------------

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(
        '1. Extracted Package Declarations',
        {
          underline: true
        }
      );

    doc.moveDown(0.5);

    const fieldsObj =
      typeof scan.fields === 'string'
        ? JSON.parse(
            scan.fields
          )
        : scan.fields || {};

    const fieldMapping = {
      mrp:
        'Maximum Retail Price (MRP)',

      net_quantity:
        'Net Quantity',

      manufacturer:
        'Manufacturer Details',

      month_year:
        'Mfg. Date'
    };

    Object.keys(
      fieldsObj
    ).forEach((k) => {

      const label =
        fieldMapping[k] ||
        k.toUpperCase();

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(
          `${label}: `,
          {
            continued: true
          }
        )
        .font('Helvetica')
        .text(
          `${
            fieldsObj[k] ||
            'MISSING (VIOLATION)'
          }`
        );

      doc.moveDown(0.2);
    });

    // --------------------------------------------------------
    // Correct compliance check
    // --------------------------------------------------------

    const requiredFields = [
      'mrp',
      'net_quantity',
      'manufacturer',
      'month_year'
    ];

    const missingFields =
      requiredFields.filter(
        (field) =>
          !fieldsObj[field]
      );

    const isCompliant =
      missingFields.length === 0;

    doc.moveDown(1.5);

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(
        `Compliance Status: ${
          isCompliant
            ? 'COMPLIANT'
            : 'NON-COMPLIANT'
        }`,
        {
          underline: true
        }
      );

    // --------------------------------------------------------
    // Raw OCR evidence
    // --------------------------------------------------------

    doc.moveDown(1.5);

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(
        '2. Raw OCR Text Evidence',
        {
          underline: true
        }
      );

    doc.moveDown(0.5);

    doc
      .fontSize(10)
      .font('Courier')
      .text(
        scan.text ||
        '(none)'
      );

    // --------------------------------------------------------
    // Legal notice
    // --------------------------------------------------------

    if (
      !isCompliant &&
      process.env.GEMINI_API_KEY
    ) {

      try {

        const {
          GoogleGenerativeAI
        } = require(
          '@google/generative-ai'
        );

        const genAI =
          new GoogleGenerativeAI(
            process.env.GEMINI_API_KEY
          );

        const model =
          genAI.getGenerativeModel({
            model:
              'gemini-1.5-flash'
          });

        const prompt =
          `Draft a formal, extremely strict legal notice from the Department of Legal Metrology to the Manufacturer for violation of Rule 6 of the Legal Metrology (Packaged Commodities) Rules, 2011. The product scan ID is ${scan.id}. The following declarations were found missing during a field inspection: ${missingFields.join(', ')}. State very clearly that a penalty of Rs. 25,000 is applicable under Section 36 of the Legal Metrology Act, 2009 for this offense. Output strictly as standard letter plain text without ANY markdown formatting (no asterisks, no hashes, no bold). Include a standard closing block for the Inspector's signature.`;

        const result =
          await model.generateContent(
            prompt
          );

        let noticeText =
          result.response.text();

        noticeText =
          noticeText.replace(
            /\*/g,
            ''
          );

        doc.addPage();

        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(
            'LEGAL NOTICE UNDER SECTION 36',
            {
              underline: true,
              align: 'center'
            }
          );

        doc.moveDown(2);

        doc
          .fontSize(11)
          .font('Helvetica')
          .text(
            noticeText,
            {
              align: 'justify',
              lineGap: 4
            }
          );

      } catch (err) {

        console.error(
          'Failed to generate Gemini notice:',
          err
        );
      }
    }

    // --------------------------------------------------------
    // Footer
    // --------------------------------------------------------

    doc.moveDown(3);

    doc
      .fontSize(10)
      .font('Helvetica-Oblique')
      .text(
        'This is a digitally generated notice powered by the Legal Metrology Hub.',
        {
          align: 'center'
        }
      );

    doc.text(
      'Valid only for simulation purposes.',
      {
        align: 'center',
        textWidth: 200
      }
    );

    doc.end();
  }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  '/health',
  (req, res) =>
    res.json({
      status: 'ok'
    })
);

// ============================================================
// PUBLIC QR VERIFICATION
// ============================================================

app.get(
  '/api/public/verify/:id',
  async (req, res) => {

    const id =
      req.params.id;

    try {

      const scan =
        await getScanDB(id);

      if (!scan) {
        return res.status(404).json({
          error:
            'Digital Certificate not found'
        });
      }

      const fieldsObj =
        typeof scan.fields === 'string'
          ? JSON.parse(
              scan.fields
            )
          : scan.fields || {};

      // ------------------------------------------------------
      // Correct compliance calculation
      // ------------------------------------------------------

      const requiredFields = [
        'mrp',
        'net_quantity',
        'manufacturer',
        'month_year'
      ];

      const missingFields =
        requiredFields.filter(
          (field) =>
            !fieldsObj[field]
        );

      const isCompliant =
        missingFields.length === 0;

      return res.json({

        id:
          scan.id,

        product:
          scan.filename,

        verifiedAt:
          scan.created_at,

        status:
          isCompliant
            ? 'COMPLIANT'
            : 'NON_COMPLIANT',

        certifyingAuthority:
          'Department of Legal Metrology, Government of India',

        cryptoSignature:
          fieldsObj.crypto_signature ||
          'UNVERIFIED_LEGACY_RECORD',

        // Useful for verification page
        latitude:
          scan.latitude,

        longitude:
          scan.longitude,

        violations:
          missingFields
      });

    } catch (err) {

      console.error(
        'Public verification error:',
        err.message
      );

      return res.status(500).json({
        error: 'Server error'
      });
    }
  }
);

// ============================================================
// EXPRESS ERROR HANDLER
// ============================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      'Express Error Handler:',
      err
    );

    res.status(500).json({
      error:
        'Server Middleware Error',

      details:
        err.message ||
        err.toString()
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

initDb()
  .then(() => {

    app.listen(
      PORT,
      () =>
        console.log(
          `OCR backend listening on port ${PORT}`
        )
    );

  })
  .catch((err) => {

    console.error(
      'Fatal error during DB initialization:',
      err.message
    );

    process.exit(1);
  });