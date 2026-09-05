const assert = require('assert');
const extractor = require('../lib/extractor');

function run() {
  console.log('Running extractor unit tests...');

  // Test MRP parsing
  const t1 = 'MRP: Rs. 49.00 /-';
  const r1 = extractor.parseMRP(t1);
  assert.strictEqual(r1, '49.00'.replace(/,/g, '')); // allow decimals

  const t2 = 'Maximum Retail Price Rs 1,299';
  const r2 = extractor.parseMRP(t2);
  assert.strictEqual(r2, '1299');

  const t2b = 'MRP: ₹ 89/- only';
  const r2b = extractor.parseMRP(t2b);
  assert.strictEqual(r2b, '89');

  // Net quantity
  const t3 = 'Net Qty: 200 g';
  const q1 = extractor.parseNetQuantity(t3);
  assert.strictEqual(q1, '200 g');

  const t4 = 'Net Weight: 1kg';
  const q2 = extractor.parseNetQuantity(t4);
  assert.strictEqual(q2, '1 kg');

  const t4b = '500ML';
  const q2b = extractor.parseNetQuantity(t4b);
  assert.strictEqual(q2b, '500 ml');

  // Manufacturer
  const t5 = 'Mfg. by: ACME Foods Pvt. Ltd.';
  const m1 = extractor.parseManufacturer(t5);
  assert.strictEqual(m1, 'ACME Foods Pvt. Ltd');

  const t5b = 'Packed by: Good Snacks Ltd.';
  const m1b = extractor.parseManufacturer(t5b);
  assert.strictEqual(m1b, 'Good Snacks Ltd');

  // Month Year
  const t6 = 'Mfg Date: Jan 2021';
  const d1 = extractor.parseMonthYear(t6);
  assert.ok(/Jan\s*2021/i.test(d1));

  const t6b = '01/2023';
  const d1b = extractor.parseMonthYear(t6b);
  assert.strictEqual(d1b, '01/2023');

  const t6c = 'MFG Date: 24-Apr-23';
  const d1c = extractor.parseMonthYear(t6c);
  assert.strictEqual(d1c, '24-Apr-23');

  const t6d = 'MFG Date: 24/04/2023';
  const d1d = extractor.parseMonthYear(t6d);
  assert.strictEqual(d1d, '24/04/2023');

  // parseAll integrates
  const multi = `MRP Rs. 59\nNet Weight 250 ml\n Manufactured by: XYZ Ltd\nMfg Date: Feb 2022`;
  const all = extractor.parseAll(multi);
  assert.strictEqual(all.mrp, '59');
  assert.strictEqual(all.net_quantity, '250 ml');
  assert.strictEqual(all.manufacturer, 'XYZ Ltd');
  assert.ok(/Feb/i.test(all.month_year));

  // Some noisy OCR-like input
  const noisy = `MRP: Rs 29.00\nNet Wt 100 g\nMfg by: X Y Z Foods\nMfg Date:Mar-2020`;
  const noisyAll = extractor.parseAll(noisy);
  assert.strictEqual(noisyAll.mrp, '29.00');
  assert.strictEqual(noisyAll.net_quantity, '100 g');
  assert.strictEqual(noisyAll.manufacturer, 'X Y Z Foods');
  assert.ok(/Mar/i.test(noisyAll.month_year));

  console.log('All extractor unit tests passed');
}

run();
