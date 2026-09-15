const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// On Render, attach a Persistent Disk and mount it here (e.g. /data) via the
// DB_PATH env var, otherwise the SQLite file is wiped on every redeploy.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "dashboard.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  entity TEXT, type TEXT, num TEXT, memo TEXT, amount REAL,
  upload_id INTEGER
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  entity TEXT, type TEXT, num TEXT, memo TEXT, amount REAL,
  upload_id INTEGER
);
CREATE TABLE IF NOT EXISTS ar_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT, total REAL, current REAL, d1_30 REAL, d31_60 REAL, d61_90 REAL, d90plus REAL
);
CREATE TABLE IF NOT EXISTS ap_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT, total REAL, current REAL, d1_30 REAL, d31_60 REAL, d61_90 REAL, d90plus REAL
);
CREATE TABLE IF NOT EXISTS ngr_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  salesRep TEXT, factory TEXT, customer TEXT, invoiceNum TEXT,
  totalAmount REAL, paidRevenue REAL,
  upload_id INTEGER
);
CREATE TABLE IF NOT EXISTS ifs_commission (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  salesRep TEXT, customer TEXT, invoiceNum TEXT, factory TEXT, jobName TEXT, status TEXT,
  invoiceTotalAmount REAL, invoicePaymentAmount REAL, totalCommAmount REAL, actualCommissionPct REAL, factoryCommissionPct REAL,
  upload_id INTEGER
);
CREATE TABLE IF NOT EXISTS sales_detail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  customer TEXT, type TEXT, num TEXT, memo TEXT, item TEXT, qty REAL, salesPrice REAL, amount REAL,
  upload_id INTEGER
);
CREATE TABLE IF NOT EXISTS qb_sales_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asOfDate TEXT NOT NULL,
  customer TEXT, a REAL, b REAL, dollarChange REAL, pctChange REAL,
  upload_id INTEGER
);
CREATE TABLE IF NOT EXISTS upload_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  filename TEXT, kind TEXT, detail TEXT
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE INDEX IF NOT EXISTS idx_so_date ON sales_orders(date);
CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(date);
CREATE INDEX IF NOT EXISTS idx_ar_date ON ar_items(date);
CREATE INDEX IF NOT EXISTS idx_ap_date ON ap_items(date);
CREATE INDEX IF NOT EXISTS idx_ngr_date ON ngr_sales(date);
CREATE INDEX IF NOT EXISTS idx_ifs_date ON ifs_commission(date);
CREATE INDEX IF NOT EXISTS idx_detail_date ON sales_detail(date);
CREATE INDEX IF NOT EXISTS idx_detail_customer ON sales_detail(customer);
CREATE INDEX IF NOT EXISTS idx_qbsummary_date ON qb_sales_summary(asOfDate);
`);

// Migration for databases created before upload_id tracking existed.
// ALTER TABLE ... ADD COLUMN fails if the column is already there, which is
// exactly what we want on every restart after the first - so just swallow that.
try { db.exec("ALTER TABLE sales_orders ADD COLUMN upload_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE purchase_orders ADD COLUMN upload_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE ifs_commission ADD COLUMN factory TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE ifs_commission ADD COLUMN jobName TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE ifs_commission ADD COLUMN status TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE ifs_commission ADD COLUMN totalCommAmount REAL"); } catch (e) {}
try { db.exec("ALTER TABLE ifs_commission ADD COLUMN actualCommissionPct REAL"); } catch (e) {}

module.exports = db;
