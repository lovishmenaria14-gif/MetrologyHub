// Simple extraction heuristics for MRP, net quantity, manufacturer, month/year
// Keep regexes robust to common variations seen on Indian packaged goods labels

const CURRENCY = '(?:Rs\\.?|INR|₹|Rs)';
const NUMBER = '(?:[0-9]+(?:[.,][0-9]+)*)';

function parseMRP(text) {
  if (!text) return null;
  // Common patterns: MRP: Rs. 50/-, MRP Rs.50, Maximum Retail Price Rs. 50.00
  const patterns = [
    new RegExp(`(?:MRP|Maximum Retail Price)\\s*[:\\-]?\\s*(?:${CURRENCY})?\\s*(${NUMBER})`, 'i'),
    new RegExp(`(?:${CURRENCY})\\s*(${NUMBER})\\s*(?:/\\-|only|/\\-)?\\b`, 'i'),
    new RegExp(`MRP\\s*[:\\-]?\\s*(${NUMBER})\\s*(?:INR|Rs|₹)?`, 'i')
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].replace(/,/g, '');
  }
  return null;
}

function parseNetQuantity(text) {
  if (!text) return null;
  // Units: g, kg, ml, l, litre, L, Kg etc.
  const unitList = ['kg', 'g', 'mg', 'lb', 'oz', 'litre', 'liter', 'l', 'ml'];
  const unitRe = unitList.join('|');
  // patterns like 200 g, 1kg, Net wt: 200g, Net Quantity 200 ml
  const patterns = [
    new RegExp(`(?:Net\\s*Wt\\.?|Net\\s*Weight|Net Quantity|Net\\s*Qty|Nett)?\\s*[:\\-]?\\s*(${NUMBER})\\s*(${unitRe})\\b`, 'i'),
    new RegExp(`\\b(${NUMBER})\\s*(${unitRe})\\b`, 'i')
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1] && m[2]) return `${m[1].replace(/,/g, '')} ${m[2].toLowerCase()}`;
  }
  return null;
}

function parseManufacturer(text) {
  if (!text) return null;
  // Look for patterns like Mfg by:, Manufactured by:, Mfg., Mfg by
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/(?:Mfg\.?\s*by|Manufactured by|Mfr|Packed by|Packed\s*by)\s*[:\-]?\s*(.+)/i);
    if (m && m[1]) {
      // take up to a reasonable length
      return m[1].replace(/\.$/, '').trim();
    }
  }
  // Fallback: try to find 'Mfg' token in a line and return remainder
  for (const line of lines) {
    if (/Mfg\.?\b/i.test(line)) {
      const parts = line.split(/Mfg\.?/i);
      if (parts[1]) return parts[1].replace(/^[:\-\s]+/, '').trim();
    }
  }
  return null;
}

function parseMonthYear(text) {
  if (!text) return null;
  // Accept full dates as well as month/year declarations commonly printed on labels.
  const monthName = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  const fullDateWithMonthName = text.match(new RegExp(`\\b([0-9]{1,2})[-\\/. ]${monthName}[-\\/. ]([0-9]{2,4})\\b`, 'i'));
  if (fullDateWithMonthName) return fullDateWithMonthName[0];

  const fullNumericDate = text.match(/\b([0-9]{1,2})[\/.-]([0-9]{1,2})[\/.-]([0-9]{2,4})\b/);
  if (fullNumericDate) return fullNumericDate[0];

  // e.g., Jan 2021, JAN-2021, 01/2021 (month/year), Mfg. Date: Jan 2021
  const m1 = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b[-\s,]*([0-9]{4})/i);
  if (m1) return `${m1[1]} ${m1[2]}`;
  const m2 = text.match(/\b(0?[1-9]|1[0-2])[\/-]([0-9]{4})\b/);
  if (m2) return `${m2[1]}/${m2[2]}`;
  return null;
}

function parseAll(text) {
  if (!text) return { mrp: null, net_quantity: null, manufacturer: null, month_year: null };
  // normalize spacing
  const normalized = text.replace(/\u00A0/g, ' ').replace(/[\t\r]+/g, '\n');
  const mrp = parseMRP(normalized);
  const net_quantity = parseNetQuantity(normalized);
  const manufacturer = parseManufacturer(normalized);
  const month_year = parseMonthYear(normalized);
  return { mrp, net_quantity, manufacturer, month_year };
}

module.exports = { parseAll, parseMRP, parseNetQuantity, parseManufacturer, parseMonthYear };
