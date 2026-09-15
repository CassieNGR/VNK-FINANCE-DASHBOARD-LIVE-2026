const XLSX = require("xlsx");

function sheetToRows(workbook) {
  const preferred =
    workbook.SheetNames.find((n) => n.toLowerCase() === "sheet1") ||
    workbook.SheetNames[workbook.SheetNames.length - 1];
  const ws = workbook.Sheets[preferred];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function excelSerialToISO(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}

// AR / AP daily aging export: col A empty + col B = customer/vendor name row
function parseAgingRows(rows) {
  let count = 0,
    total = 0;
  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const a = r[0],
      b = r[1];
    if ((a === null || a === undefined) && b && b !== "TOTAL") {
      const c1 = Number(r[2]) || 0,
        c2 = Number(r[4]) || 0,
        c3 = Number(r[6]) || 0,
        c4 = Number(r[8]) || 0,
        c5 = Number(r[10]) || 0;
      const m = r[12] != null ? Number(r[12]) : 0;
      count++;
      total += m;
      items.push({
        name: b,
        total: round2(m),
        current: round2(c1),
        d1_30: round2(c2),
        d31_60: round2(c3),
        d61_90: round2(c4),
        d90plus: round2(c5),
      });
    }
  }
  return { count, total: round2(total), items };
}

// SO / PO monthly export: entity name row (col B set, col E empty), then txn rows (col E set)
function parseTxnRows(rows) {
  const out = [];
  let currentEntity = null;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const b = r[1],
      typ = r[4];
    if (b && !typ) {
      currentEntity = b;
      continue;
    }
    const date = excelSerialToISO(r[6]);
    if (!date) continue;
    const num = r[8],
      memo = r[10];
    const debit = r[18],
      credit = r[20];
    let amt = 0;
    if (debit !== null && debit !== undefined && debit !== "") amt = Number(debit) || 0;
    else if (credit !== null && credit !== undefined && credit !== "") amt = Number(credit) || 0;
    out.push({
      date,
      entity: currentEntity,
      type: typ || "",
      num: num != null ? String(num) : "",
      memo: memo || "",
      amount: round2(amt),
    });
  }
  return out;
}

function parseWorkbookBuffer(buffer) {
  return XLSX.read(buffer, { type: "buffer", cellDates: true });
}

// --- NGR Sales / IFS Commission: real CSVs with an actual header row ---
// (unlike the QuickBooks exports above, which have no headers and are read by
// fixed column position). Header names are matched loosely - lowercased with
// all non-letters stripped - so "Invoice #", "invoice#", "Invoice Number" etc.
// all match the same field.
function normalizeKey(s) {
  return String(s || "").toLowerCase().replace(/[^a-z]/g, "");
}

function sheetToObjects(workbook) {
  const preferred = workbook.SheetNames[0];
  const ws = workbook.Sheets[preferred];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  return raw.map((row) => {
    const out = {};
    Object.keys(row).forEach((k) => { out[normalizeKey(k)] = row[k]; });
    return out;
  });
}

function toNumber(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[$,\s%]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function pick(obj, ...keys) {
  for (const k of keys) if (obj[k] != null && obj[k] !== "") return obj[k];
  return null;
}

// NGR Sales CSV: Sales Rep, Factory, Customer, Invoice #, Invoice Date, Total Amount, Paid Revenue
function parseNGRRows(objs) {
  const out = [];
  objs.forEach((o) => {
    const dateRaw = pick(o, "invoicedate", "date");
    const date = excelSerialToISO(dateRaw);
    if (!date) return;
    out.push({
      date,
      salesRep: pick(o, "salesrep", "salesrep1") || "",
      factory: pick(o, "factory") || "",
      customer: pick(o, "customer", "customername") || "",
      invoiceNum: pick(o, "invoice", "invoicenum", "invoiceno") != null ? String(pick(o, "invoice", "invoicenum", "invoiceno")) : "",
      totalAmount: round2(toNumber(pick(o, "totalamount"))),
      paidRevenue: round2(toNumber(pick(o, "paidrevenue"))),
    });
  });
  return out;
}

// IFS Commission CSV: Sales Rep 1, Invoice Total Amount, Invoice Payment Amount,
// Invoice Factory Commission %, Invoice Date, Customer, Invoice #
function parseIFSRows(objs) {
  const out = [];
  objs.forEach((o) => {
    const dateRaw = pick(o, "invoicedate", "date");
    const date = excelSerialToISO(dateRaw);
    if (!date) return;
    // "Paid Amount" here is the amount paid out to the sales rep (their
    // commission payout), not a payment collected from the customer - it's
    // what gets subtracted from the invoice total to get the net figure.
    const paidToRep = toNumber(pick(o, "paidamount", "invoicepaymentamount"));
    out.push({
      date,
      salesRep: pick(o, "salesrep", "salesrep1") || "",
      customer: pick(o, "customer", "customername") || "",
      factory: pick(o, "factory") || "",
      invoiceNum: pick(o, "invoice", "invoicenum", "invoiceno") != null ? String(pick(o, "invoice", "invoicenum", "invoiceno")) : "",
      invoiceTotalAmount: round2(toNumber(pick(o, "invoicetotalamount"))),
      invoicePaymentAmount: round2(paidToRep),
      totalCommAmount: round2(toNumber(pick(o, "totalcommamount"))),
      actualCommissionPct: round2(toNumber(pick(o, "actualcommission"))),
      factoryCommissionPct: round2(toNumber(pick(o, "invoicefactorycommission", "factorycommission"))),
      jobName: pick(o, "jobname") || "",
      status: pick(o, "status") || "",
    });
  });
  return out;
}

module.exports = {
  sheetToRows, parseAgingRows, parseTxnRows, parseWorkbookBuffer, round2,
  sheetToObjects, parseNGRRows, parseIFSRows, parseSalesDetailRows, parseQBSummaryRows,
};

// QuickBooks "Sales by Customer Summary" (year-over-year comparison) report,
// once exported with the customer name column included. Row shape: col B =
// customer, col C = Period A amount, col E = Period B amount, col G = $
// change, col I = % change (as a decimal, e.g. -1 = -100%). A final row has
// col A = "TOTAL" instead of a customer name in col B - skip it.
function parseQBSummaryRows(rows) {
  const out = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const customer = r[1];
    if (!customer || r[0] === "TOTAL") continue;
    out.push({
      customer,
      a: round2(Number(r[2]) || 0),
      b: round2(Number(r[4]) || 0),
      dollarChange: round2(Number(r[6]) || 0),
      pctChange: round2((Number(r[8]) || 0) * 100),
    });
  }
  return out;
}

// "Sales by Customer Detail" QuickBooks report: per-line-item sales, with a
// customer subtotal ("Total <Customer>") row after each customer's block.
// Unlike the SO/PO export, the customer name is directly on each transaction
// row (col M), so we read it straight from there rather than tracking a
// running "current entity" - this sidesteps the "Total X" subtotal rows
// entirely, since those have no date and get skipped by the date check below.
// Columns: E=Type, G=Date, I=Num, K=Memo, M=Name(customer), O=Item, Q=Qty,
// S=Sales Price, U=Amount, W=Balance.
function parseSalesDetailRows(rows) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const date = excelSerialToISO(r[6]);
    if (!date) continue; // skips customer-name header rows and "Total X" subtotal rows
    const customer = r[12];
    if (!customer) continue;
    out.push({
      date,
      customer,
      type: r[4] || "",
      num: r[8] != null ? String(r[8]) : "",
      memo: r[10] || "",
      item: r[14] || "",
      qty: r[16] != null ? Number(r[16]) || 0 : 0,
      salesPrice: r[18] != null ? round2(Number(r[18]) || 0) : 0,
      amount: r[20] != null ? round2(Number(r[20]) || 0) : 0,
    });
  }
  return out;
}
