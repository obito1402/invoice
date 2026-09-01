const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'invoice-app.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS business_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT,
    owner_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    npwp TEXT,
    nib TEXT,
    invoice_prefix TEXT,
    invoice_start_number INTEGER,
    invoice_footer TEXT,
    logo_url TEXT,
    stamp_url TEXT,
    signature_url TEXT,
    payment_method TEXT,
    payment_details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    npwp TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT,
    unit TEXT,
    price REAL NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    issue_date TEXT,
    due_date TEXT,
    status TEXT DEFAULT 'draft',
    notes TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    other_fee REAL NOT NULL DEFAULT 0,
    other_fee_description TEXT,
    payment_method TEXT,
    payment_details TEXT,
    total REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  );
`);

const ensureTableColumns = (tableName, columnDefinitions) => {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const existing = new Set(columns.map((column) => column.name));
  columnDefinitions.forEach(([columnName, columnType]) => {
    if (!existing.has(columnName)) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
      existing.add(columnName);
    }
  });
};

ensureTableColumns('business_profiles', [
  ['nib', 'TEXT'],
  ['invoice_prefix', 'TEXT'],
  ['invoice_start_number', 'INTEGER'],
  ['invoice_footer', 'TEXT'],
  ['logo_url', 'TEXT'],
  ['stamp_url', 'TEXT'],
  ['signature_url', 'TEXT'],
  ['payment_method', 'TEXT'],
  ['payment_details', 'TEXT'],
]);
ensureTableColumns('customers', [['npwp', 'TEXT']]);
ensureTableColumns('products', [['description', 'TEXT']]);
ensureTableColumns('invoices', [
  ['other_fee', 'REAL'],
  ['other_fee_description', 'TEXT'],
  ['payment_method', 'TEXT'],
  ['payment_details', 'TEXT'],
]);

const seedData = () => {
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM business_profiles').get().count;
  if (profileCount === 0) {
    db.prepare(`
      INSERT INTO business_profiles (business_name, owner_name, email, phone, address, npwp, nib, invoice_prefix, invoice_start_number, invoice_footer, payment_method, payment_details)
      VALUES ('InvoiceFlow Studio', 'Budi Santoso', 'hello@invoiceflow.id', '08123456789', 'Jl. Raya Bandung No. 18, Bandung', '01.234.567.8-901.000', '8123456789', 'INV', 1, 'Terima kasih atas kepercayaan Anda.', 'Bank Transfer', 'Bank BCA 1234567890 a.n. Budi Santoso')
    `).run();
  }

  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  if (customerCount === 0) {
    db.prepare(`
      INSERT INTO customers (name, company, email, phone, address)
      VALUES
        ('Rina Amelia', 'Batik Nusantara', 'rina@batiknusantara.com', '081234567890', 'Jl. Merdeka No. 12, Bandung'),
        ('Fajar Putra', 'Mitra Snack', 'fajar@mitrasnack.id', '085678901234', 'Jl. H. Agus Salim No. 7, Surabaya')
    `).run();
  }

  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount === 0) {
    db.prepare(`
      INSERT INTO products (name, sku, category, unit, price)
      VALUES
        ('Batik Tulis Premium', 'BT-001', 'Fashion', 'pcs', 250000),
        ('Tas Anyaman', 'TA-102', 'Aksesoris', 'pcs', 180000),
        ('Kopi Robusta 250gr', 'KR-250', 'Makanan', 'pack', 45000),
        ('Jasa Desain Logo', 'JD-001', 'Jasa', 'job', 600000)
    `).run();
  }

  const invoiceCount = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;
  if (invoiceCount === 0) {
    const customer = db.prepare('SELECT id FROM customers ORDER BY id LIMIT 1').get();
    const invoiceNumber = 'INV-1001';
    const invoiceInsert = db.prepare(`
      INSERT INTO invoices (invoice_number, customer_id, issue_date, due_date, status, notes, subtotal, discount, tax_rate, tax_amount, total)
      VALUES (?, ?, date('now'), date('now','+7 days'), 'draft', 'Invoice awal untuk demo aplikasi', 490000, 0, 11, 53900, 543900)
    `);
    const invoiceId = invoiceInsert.run(invoiceNumber, customer.id).lastInsertRowid;

    db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, discount, tax_rate, amount)
      VALUES
        (?, 'Batik Tulis Premium', 1, 250000, 0, 11, 250000),
        (?, 'Tas Anyaman', 1, 180000, 0, 11, 180000),
        (?, 'Jasa Desain Logo', 1, 600000, 0, 11, 600000)
    `).run(invoiceId, invoiceId, invoiceId);
  }
};

seedData();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const calculateInvoiceTotals = ({ items, discount, taxRate, otherFee }) => {
  const normalizedItems = Array.isArray(items) ? items : [];
  const subtotal = normalizedItems.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discountPerLine = Number(item.discount || 0);
    const lineTotal = quantity * unitPrice - discountPerLine;
    return sum + lineTotal;
  }, 0);

  const normalizedDiscount = Number(discount || 0);
  const normalizedTaxRate = Number(taxRate || 0);
  const normalizedOtherFee = Number(otherFee || 0);
  const taxableAmount = Math.max(subtotal - normalizedDiscount, 0);
  const taxAmount = taxableAmount * (normalizedTaxRate / 100);
  const total = Math.max(taxableAmount + taxAmount + normalizedOtherFee, 0);

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(normalizedDiscount.toFixed(2)),
    taxRate: Number(normalizedTaxRate.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    otherFee: Number(normalizedOtherFee.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
};

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getNextInvoiceNumber = (profile) => {
  const invoicePrefix = (profile?.invoice_prefix || 'INV').trim() || 'INV';
  const startNumber = Number(profile?.invoice_start_number || 1) || 1;
  const invoiceNumbers = db.prepare('SELECT invoice_number FROM invoices').all().map((row) => row.invoice_number || '');
  let maxSequence = 0;

  invoiceNumbers.forEach((invoiceNumber) => {
    const match = invoiceNumber.match(new RegExp(`^${escapeRegExp(invoicePrefix)}-?(\\d+)$`, 'i'));
    if (!match) return;

    const sequence = Number(match[1]);
    if (!Number.isNaN(sequence) && sequence > maxSequence) {
      maxSequence = sequence;
    }
  });

  const nextSequence = Math.max(startNumber, maxSequence + 1);
  return `${invoicePrefix}${invoicePrefix.endsWith('-') ? '' : '-'}${String(nextSequence).padStart(4, '0')}`;
};

app.get('/api/profile', (req, res) => {
  const profile = db.prepare('SELECT * FROM business_profiles ORDER BY id DESC LIMIT 1').get();
  res.json(profile || null);
});

app.post('/api/profile', (req, res) => {
  const {
    business_name,
    owner_name,
    email,
    phone,
    address,
    npwp,
    nib,
    invoice_prefix,
    invoice_start_number,
    invoice_footer,
    logo_url,
    stamp_url,
    signature_url,
    payment_method,
    payment_details,
  } = req.body || {};

  const profile = db.prepare('SELECT * FROM business_profiles ORDER BY id DESC LIMIT 1').get();
  const nextInvoiceStart = Number(invoice_start_number || profile?.invoice_start_number || 1);

  if (profile) {
    db.prepare(`
      UPDATE business_profiles
      SET business_name = ?, owner_name = ?, email = ?, phone = ?, address = ?, npwp = ?, nib = ?, invoice_prefix = ?, invoice_start_number = ?, invoice_footer = ?, logo_url = ?, stamp_url = ?, signature_url = ?, payment_method = ?, payment_details = ?
      WHERE id = ?
    `).run(
      business_name || '',
      owner_name || '',
      email || '',
      phone || '',
      address || '',
      npwp || '',
      nib || '',
      (invoice_prefix || profile?.invoice_prefix || 'INV').trim() || 'INV',
      nextInvoiceStart,
      invoice_footer || '',
      logo_url || profile?.logo_url || '',
      stamp_url || profile?.stamp_url || '',
      signature_url || profile?.signature_url || '',
      payment_method || profile?.payment_method || '',
      payment_details || profile?.payment_details || '',
      profile.id,
    );

    const updated = db.prepare('SELECT * FROM business_profiles WHERE id = ?').get(profile.id);
    return res.json(updated);
  }

  const inserted = db.prepare(`
    INSERT INTO business_profiles (business_name, owner_name, email, phone, address, npwp, nib, invoice_prefix, invoice_start_number, invoice_footer, logo_url, stamp_url, signature_url, payment_method, payment_details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    business_name || '',
    owner_name || '',
    email || '',
    phone || '',
    address || '',
    npwp || '',
    nib || '',
    (invoice_prefix || 'INV').trim() || 'INV',
    nextInvoiceStart,
    invoice_footer || '',
    logo_url || '',
    stamp_url || '',
    signature_url || '',
    payment_method || '',
    payment_details || '',
  );

  const created = db.prepare('SELECT * FROM business_profiles WHERE id = ?').get(inserted.lastInsertRowid);
  res.status(201).json(created);
});

app.get('/api/dashboard', (req, res) => {
  const totalInvoices = db.prepare('SELECT COUNT(*) as count FROM invoices').get().count;
  const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  const totalRevenue = db.prepare('SELECT COALESCE(SUM(total),0) as total FROM invoices').get().total;
  const paidInvoices = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status = 'paid'").get().count;
  const openInvoices = db.prepare("SELECT COUNT(*) as count FROM invoices WHERE status != 'paid'").get().count;

  res.json({
    totalInvoices,
    totalCustomers,
    totalProducts,
    totalRevenue,
    paidInvoices,
    openInvoices,
    currency: 'IDR',
  });
});

app.get('/api/customers', (req, res) => {
  const rows = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
  res.json(rows);
});

app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  res.json(rows);
});

app.get('/api/invoices', (req, res) => {
  const invoices = db.prepare(`
    SELECT i.*, c.name as customer_name, c.company as customer_company
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    ORDER BY i.id DESC
  `).all();

  const itemsByInvoice = db.prepare('SELECT * FROM invoice_items ORDER BY id ASC').all();

  const itemMap = {};
  for (const item of itemsByInvoice) {
    if (!itemMap[item.invoice_id]) itemMap[item.invoice_id] = [];
    itemMap[item.invoice_id].push(item);
  }

  const payload = invoices.map((invoice) => ({
    ...invoice,
    customerName: invoice.customer_name || 'Customer',
    customerCompany: invoice.customer_company || '',
    items: itemMap[invoice.id] || [],
    formattedTotal: formatCurrency(invoice.total),
    formattedSubtotal: formatCurrency(invoice.subtotal),
  }));

  res.json(payload);
});

app.post('/api/customers', (req, res) => {
  const { name, company, email, phone, address, npwp } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Nama customer wajib diisi.' });
  }

  const stmt = db.prepare(`
    INSERT INTO customers (name, company, email, phone, address, npwp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    name.trim(),
    company ? company.trim() : '',
    email ? email.trim() : '',
    phone ? phone.trim() : '',
    address ? address.trim() : '',
    npwp ? npwp.trim() : '',
  );

  const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

app.post('/api/products', (req, res) => {
  const { name, sku, category, unit, price, description } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Nama produk wajib diisi.' });
  }

  const stmt = db.prepare(`
    INSERT INTO products (name, sku, category, unit, price, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    name.trim(),
    sku ? sku.trim() : '',
    category ? category.trim() : '',
    unit ? unit.trim() : 'pcs',
    Number(price || 0),
    description ? description.trim() : '',
  );
  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

app.post('/api/invoices', (req, res) => {
  const {
    customerId,
    issueDate,
    dueDate,
    notes,
    status,
    discount,
    taxRate,
    otherFee,
    otherFeeDescription,
    paymentMethod,
    paymentDetails,
    items,
  } = req.body || {};

  if (!customerId) {
    return res.status(400).json({ message: 'Customer wajib dipilih.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Minimal satu item produk harus ditambahkan.' });
  }

  const totals = calculateInvoiceTotals({ items, discount, taxRate, otherFee });
  const profile = db.prepare('SELECT * FROM business_profiles ORDER BY id DESC LIMIT 1').get();
  const invoiceNumber = getNextInvoiceNumber(profile);

  const stmt = db.prepare(`
    INSERT INTO invoices (invoice_number, customer_id, issue_date, due_date, status, notes, subtotal, discount, tax_rate, tax_amount, other_fee, other_fee_description, payment_method, payment_details, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let invoiceInsert;
  try {
    invoiceInsert = stmt.run(
      invoiceNumber,
      Number(customerId),
      issueDate || new Date().toISOString().slice(0, 10),
      dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status || 'draft',
      notes || '',
      totals.subtotal,
      totals.discount,
      totals.taxRate,
      totals.taxAmount,
      totals.otherFee,
      otherFeeDescription || '',
      paymentMethod || profile?.payment_method || '',
      paymentDetails || profile?.payment_details || '',
      totals.total,
    );
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ message: 'Nomor invoice sudah digunakan. Periksa konfigurasi nomor invoice atau nomor terakhir yang tersimpan.' });
    }

    throw error;
  }

  const invoiceId = invoiceInsert.lastInsertRowid;
  const itemStmt = db.prepare(`
    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, discount, tax_rate, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  items.forEach((item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unitPrice || 0);
    const lineDiscount = Number(item.discount || 0);
    const lineTaxRate = Number(item.taxRate || 0);
    const amount = qty * price - lineDiscount;

    itemStmt.run(
      invoiceId,
      item.description || 'Item invoice',
      qty,
      price,
      lineDiscount,
      lineTaxRate,
      amount,
    );
  });

  const created = db.prepare(`
    SELECT i.*, c.name as customer_name, c.company as customer_company
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.id = ?
  `).get(invoiceId);

  created.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC').all(invoiceId);
  created.formattedTotal = formatCurrency(created.total);

  res.status(201).json(created);
});

const buildInvoiceHtml = (invoice, items, profile) => {
  const logoMarkup = profile?.logo_url ? `<img src="${profile.logo_url}" alt="Logo usaha" style="max-width: 180px; max-height: 80px; object-fit: contain;" />` : '<div style="font-weight: 700; font-size: 18px;">Logo</div>';
  const stampMarkup = profile?.stamp_url ? `<img src="${profile.stamp_url}" alt="Stempel" style="max-width: 140px; max-height: 120px; opacity: 0.8;" />` : '';
  const signatureMarkup = profile?.signature_url ? `<img src="${profile.signature_url}" alt="Tanda tangan" style="max-width: 160px; max-height: 90px; object-fit: contain;" />` : '';
  const paymentMethod = invoice.payment_method || profile?.payment_method || 'Transfer Bank';
  const paymentDetails = invoice.payment_details || profile?.payment_details || 'Bank BCA 1234567890 a.n. Pemilik Usaha';
  const otherFee = Number(invoice.other_fee || 0);
  const otherFeeDescription = invoice.other_fee_description || 'Biaya lain';

  let body = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${invoice.invoice_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #18212f; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-bottom: 2px solid #dfe7ff; padding-bottom: 18px; }
          .brand-block { display: flex; gap: 18px; align-items: center; }
          .info-box { line-height: 1.6; font-size: 13px; }
          .meta { text-align: right; }
          .meta h3 { margin: 0 0 8px; }
          .customer-box { margin-top: 24px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 18px; }
          .payment-box { margin-top: 20px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; }
          th { background: #f3f6ff; }
          .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
          .totals-box { min-width: 280px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 16px; }
          .signature-row { margin-top: 30px; display: flex; justify-content: space-between; align-items: end; gap: 20px; }
          .signature-box { text-align: center; min-width: 180px; }
          .signature-box .signature-line { height: 60px; display: flex; align-items: center; justify-content: center; }
          .footer-note { margin-top: 28px; font-size: 12px; color: #475467; border-top: 1px solid #e5e7eb; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand-block">
            <div>${logoMarkup}</div>
            <div class="info-box">
              <h2 style="margin: 0 0 6px; font-size: 20px;">${profile?.business_name || 'InvoiceFlow Studio'}</h2>
              <div>${profile?.address || ''}</div>
              <div>Email: ${profile?.email || '-'}</div>
              <div>Phone: ${profile?.phone || '-'}</div>
              <div>NIB: ${profile?.nib || '-'}</div>
              <div>NPWP: ${profile?.npwp || '-'}</div>
            </div>
          </div>
          <div class="meta">
            <h3>Invoice ${invoice.invoice_number}</h3>
            <div>Tanggal: ${invoice.issue_date || '-'}</div>
            <div>Jatuh Tempo: ${invoice.due_date || '-'}</div>
            <div>Status: ${invoice.status || 'draft'}</div>
          </div>
        </div>

        <div class="customer-box">
          <strong>Bill To:</strong>
          <div>${invoice.customer_name || 'Customer'}${invoice.customer_company ? ` (${invoice.customer_company})` : ''}</div>
        </div>

        <div class="payment-box">
          <strong>Pembayaran:</strong>
          <div>${paymentMethod}</div>
          <div>${paymentDetails}</div>
        </div>

        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr>
          </thead>
          <tbody>
  `;

  items.forEach((item) => {
    body += `<tr><td>${item.description}</td><td>${item.quantity}</td><td>${formatCurrency(item.unit_price)}</td><td>${formatCurrency(item.amount)}</td></tr>`;
  });

  body += `</tbody></table>
    <div class="totals">
      <div class="totals-box">
        <div>Subtotal: ${formatCurrency(invoice.subtotal)}</div>
        <div>Diskon: ${formatCurrency(invoice.discount)}</div>
        <div>${otherFeeDescription}: ${formatCurrency(otherFee)}</div>
        <div>Pajak: ${formatCurrency(invoice.tax_amount)}</div>
        <div style="font-weight: 700; font-size: 16px; margin-top: 8px;">Total: ${formatCurrency(invoice.total)}</div>
      </div>
    </div>

    <div class="signature-row">
      <div class="signature-box">
        <div style="font-weight: 700; margin-bottom: 8px;">Stempel</div>
        <div class="signature-line">${stampMarkup || '<div style="width: 120px; height: 60px; border: 1px dashed #d0d7e7;"></div>'}</div>
      </div>
      <div class="signature-box">
        <div style="font-weight: 700; margin-bottom: 8px;">Pemimpin</div>
        <div class="signature-line">${signatureMarkup || '<div style="width: 160px; height: 60px; border: 1px dashed #d0d7e7;"></div>'}</div>
      </div>
    </div>

    <div class="footer-note">${profile?.invoice_footer || 'Terima kasih atas kepercayaan Anda.'}</div>
  </body>
  </html>`;

  return body;
};

app.get('/api/invoices/:id/preview', (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*, c.name as customer_name, c.company as customer_company
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!invoice) {
    return res.status(404).json({ message: 'Invoice not found.' });
  }

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC').all(invoice.id);
  const profile = db.prepare('SELECT * FROM business_profiles ORDER BY id DESC LIMIT 1').get();
  res.setHeader('Content-Type', 'text/html');
  res.send(buildInvoiceHtml(invoice, items, profile));
});

app.get('/api/invoices/:id/download', (req, res) => {
  const invoice = db.prepare(`
    SELECT i.*, c.name as customer_name, c.company as customer_company
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!invoice) {
    return res.status(404).json({ message: 'Invoice not found.' });
  }

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC').all(invoice.id);
  const profile = db.prepare('SELECT * FROM business_profiles ORDER BY id DESC LIMIT 1').get();
  const body = buildInvoiceHtml(invoice, items, profile);

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.html"`);
  res.send(body);
});

const pageRoutes = ['/', '/login', '/dashboard', '/profile', '/products', '/customers', '/invoices'];

pageRoutes.forEach((route) => {
  app.get(route, (req, res) => {
    const file = route === '/' || route === '/login' ? 'index.html' : route.replace('/', '') + '.html';
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

app.listen(PORT, () => {
  console.log(`Invoice app running at http://localhost:${PORT}`);
});
