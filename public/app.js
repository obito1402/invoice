const state = { customers: [], products: [], invoices: [], profile: null };

const qs = (selector) => document.querySelector(selector);

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file || !file.size) {
    resolve('');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => resolve(reader.result || '');
  reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
  reader.readAsDataURL(file);
});

const bindImagePreview = (inputId, previewId) => {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;

  input.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
};

const setDefaultDates = () => {
  const today = new Date();
  const issueDate = today.toISOString().slice(0, 10);
  const dueDate = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  if (document.getElementById('issueDate')) {
    document.getElementById('issueDate').value = issueDate;
    document.getElementById('dueDate').value = dueDate;
  }
};

const renderDashboard = (dashboard) => {
  const totalRevenue = document.getElementById('totalRevenue');
  if (totalRevenue) totalRevenue.textContent = formatCurrency(dashboard.totalRevenue || 0);

  const totalInvoices = document.getElementById('totalInvoices');
  if (totalInvoices) totalInvoices.textContent = dashboard.totalInvoices || 0;

  const paidInvoices = document.getElementById('paidInvoices');
  if (paidInvoices) paidInvoices.textContent = dashboard.paidInvoices || 0;

  const totalCustomers = document.getElementById('totalCustomers');
  if (totalCustomers) totalCustomers.textContent = dashboard.totalCustomers || 0;
};

const renderCompanySummary = (profile) => {
  const box = document.getElementById('companySummary');
  if (!box) return;

  const businessName = profile?.business_name || 'InvoiceFlow Studio';
  const ownerName = profile?.owner_name || 'Pemilik Usaha';
  const email = profile?.email || 'hello@invoiceflow.id';
  const phone = profile?.phone || '-';
  const address = profile?.address || '-';

  box.innerHTML = `
    <strong>${businessName}</strong>
    <span>Owner: ${ownerName}</span>
    <span>Email: ${email}</span>
    <span>Phone: ${phone}</span>
    <span>Address: ${address}</span>
  `;
};

const renderProductsTable = (products) => {
  const tbody = document.querySelector('#productsTable tbody');
  if (!tbody) return;

  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="4">Belum ada produk.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map((product) => `
    <tr>
      <td>${product.name}</td>
      <td>${product.sku || '-'}</td>
      <td>${formatCurrency(product.price)}</td>
      <td>${product.description ? product.description.substring(0, 70) : '-'}</td>
    </tr>
  `).join('');
};

const renderCustomersTable = (customers) => {
  const tbody = document.querySelector('#customersTable tbody');
  if (!tbody) return;

  if (!customers.length) {
    tbody.innerHTML = '<tr><td colspan="4">Belum ada customer.</td></tr>';
    return;
  }

  tbody.innerHTML = customers.map((customer) => `
    <tr>
      <td>${customer.name}</td>
      <td>${customer.company || '-'}</td>
      <td>${customer.phone || '-'}</td>
      <td>${customer.npwp || '-'}</td>
    </tr>
  `).join('');
};

const renderInvoicesTable = (invoices) => {
  const tbody = document.querySelector('#invoicesTable tbody');
  if (!tbody) return;

  if (!invoices.length) {
    tbody.innerHTML = '<tr><td colspan="6">Belum ada invoice.</td></tr>';
    return;
  }

  tbody.innerHTML = invoices.map((invoice) => `
    <tr>
      <td>${invoice.invoice_number}</td>
      <td>${invoice.customer_name || 'Customer'}</td>
      <td>${formatCurrency(invoice.total)}</td>
      <td><span class="status-tag ${invoice.status}">${invoice.status}</span></td>
      <td><a class="text-link" href="/api/invoices/${invoice.id}/preview" target="_blank">Lihat</a></td>
      <td><a class="text-link" href="/api/invoices/${invoice.id}/download" target="_blank">Download</a></td>
    </tr>
  `).join('');
};

const renderCustomerOptions = () => {
  const select = document.getElementById('customerSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Pilih customer</option>' +
    state.customers.map((customer) => `<option value="${customer.id}">${customer.name}${customer.company ? ` - ${customer.company}` : ''}</option>`).join('');
};

const addInvoiceItemRow = (item = {}) => {
  const row = document.createElement('div');
  row.className = 'invoice-item-row';
  row.innerHTML = `
    <label>
      Produk
      <select class="item-select">
        <option value="">Pilih produk</option>
        ${state.products.map((product) => `<option value="${product.id}" ${item.productId === product.id ? 'selected' : ''}>${product.name}</option>`).join('')}
      </select>
    </label>
    <label>
      Qty
      <input class="item-qty" type="number" min="1" value="${item.quantity || 1}" />
    </label>
    <label>
      Harga
      <input class="item-price" type="number" min="0" step="1000" value="${item.unitPrice || 0}" />
    </label>
    <label>
      Diskon
      <input class="item-discount" type="number" min="0" step="1000" value="${item.discount || 0}" />
    </label>
    <label>
      Pajak
      <input class="item-tax" type="number" min="0" value="${item.taxRate || 0}" />
    </label>
    <button type="button" class="remove-item">×</button>
  `;

  row.querySelector('.remove-item').addEventListener('click', () => row.remove());

  row.querySelector('.item-select').addEventListener('change', (event) => {
    const productId = Number(event.target.value);
    const product = state.products.find((itemProduct) => itemProduct.id === productId);
    if (product) {
      row.querySelector('.item-price').value = product.price || 0;
    }
  });

  const container = document.getElementById('invoiceItems');
  if (container) container.appendChild(row);
};

const getInvoiceRows = () => [...document.querySelectorAll('.invoice-item-row')].map((row) => ({
  productId: Number(row.querySelector('.item-select').value || 0),
  quantity: Number(row.querySelector('.item-qty').value || 0),
  unitPrice: Number(row.querySelector('.item-price').value || 0),
  discount: Number(row.querySelector('.item-discount').value || 0),
  taxRate: Number(row.querySelector('.item-tax').value || 0),
  description: state.products.find((product) => product.id === Number(row.querySelector('.item-select').value || 0))?.name || 'Item custom',
})).filter((row) => row.productId && row.quantity > 0);

const loadDashboard = async () => {
  try {
    const [dashboard, profile] = await Promise.all([
      fetchJson('/api/dashboard'),
      fetchJson('/api/profile').catch(() => null),
    ]);

    renderDashboard(dashboard);
    renderCompanySummary(profile);
  } catch (_) {
    console.error(_);
  }
};

const loadProducts = async () => {
  try {
    const products = await fetchJson('/api/products');
    state.products = products;
    renderProductsTable(products);
    if (document.getElementById('invoiceItems')) {
      const container = document.getElementById('invoiceItems');
      container.innerHTML = '';
      addInvoiceItemRow();
    }
  } catch (error) {
    console.error(error);
  }
};

const loadCustomers = async () => {
  try {
    const customers = await fetchJson('/api/customers');
    state.customers = customers;
    renderCustomersTable(customers);
    renderCustomerOptions();
  } catch (error) {
    console.error(error);
  }
};

const loadInvoices = async () => {
  try {
    const invoices = await fetchJson('/api/invoices');
    renderInvoicesTable(invoices);
  } catch (error) {
    console.error(error);
  }
};

const loadProfile = async () => {
  try {
    const profile = await fetchJson('/api/profile').catch(() => null);
    state.profile = profile;
    const form = document.getElementById('profileForm');
    if (!form) return;

    if (!profile) return;

    Object.entries(profile).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (field && !field.type.includes('file')) field.value = value || '';
    });

    const logoPreview = document.getElementById('logoPreview');
    const stampPreview = document.getElementById('stampPreview');
    const signaturePreview = document.getElementById('signaturePreview');

    if (logoPreview && profile.logo_url) logoPreview.src = profile.logo_url;
    if (stampPreview && profile.stamp_url) stampPreview.src = profile.stamp_url;
    if (signaturePreview && profile.signature_url) signaturePreview.src = profile.signature_url;
  } catch (error) {
    console.error(error);
  }
};

const handleLogin = (event) => {
  event.preventDefault();
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('password');

  if (!emailField.value.trim() || !passwordField.value.trim()) {
    alert('Harap isi email dan password.');
    return;
  }

  window.location.href = '/dashboard';
};

const handleDemoLogin = () => {
  document.getElementById('email').value = 'admin@invoiceflow.id';
  document.getElementById('password').value = 'demo123';
  window.location.href = '/dashboard';
};

const handleProfileSubmit = async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());

  try {
    const logoFile = formData.get('logo_file');
    const stampFile = formData.get('stamp_file');
    const signatureFile = formData.get('signature_file');

    payload.logo_url = state.profile?.logo_url || '';
    payload.stamp_url = state.profile?.stamp_url || '';
    payload.signature_url = state.profile?.signature_url || '';

    if (logoFile && logoFile.size) payload.logo_url = await readFileAsDataUrl(logoFile);
    if (stampFile && stampFile.size) payload.stamp_url = await readFileAsDataUrl(stampFile);
    if (signatureFile && signatureFile.size) payload.signature_url = await readFileAsDataUrl(signatureFile);

    delete payload.logo_file;
    delete payload.stamp_file;
    delete payload.signature_file;

    payload.invoice_start_number = Number(payload.invoice_start_number || state.profile?.invoice_start_number || 1);
    payload.invoice_prefix = (payload.invoice_prefix || state.profile?.invoice_prefix || 'INV').trim() || 'INV';

    await fetchJson('/api/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    alert('Profil usaha berhasil disimpan.');
    window.location.href = '/dashboard';
  } catch (error) {
    alert(error.message);
  }
};

const handleProductSubmit = async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());

  try {
    await fetchJson('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    event.currentTarget.reset();
    loadProducts();
  } catch (error) {
    alert(error.message);
  }
};

const handleCustomerSubmit = async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());

  try {
    await fetchJson('/api/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    event.currentTarget.reset();
    loadCustomers();
    renderCustomerOptions();
  } catch (error) {
    alert(error.message);
  }
};

const handleInvoiceSubmit = async (event) => {
  event.preventDefault();
  const customerId = Number(document.getElementById('customerSelect').value);
  const items = getInvoiceRows();

  if (!customerId) {
    alert('Pilih customer terlebih dahulu.');
    return;
  }

  if (!items.length) {
    alert('Tambahkan setidaknya satu item invoice.');
    return;
  }

  const payload = {
    customerId,
    issueDate: document.getElementById('issueDate').value,
    dueDate: document.getElementById('dueDate').value,
    status: document.getElementById('invoiceStatus').value,
    notes: document.getElementById('notesInput').value,
    discount: Number(document.getElementById('discountInput').value || 0),
    taxRate: Number(document.getElementById('taxInput').value || 0),
    otherFee: Number(document.getElementById('otherFeeInput').value || 0),
    otherFeeDescription: document.getElementById('otherFeeDescriptionInput').value || '',
    paymentMethod: document.getElementById('paymentMethodInput').value || '',
    paymentDetails: document.getElementById('paymentDetailsInput').value || '',
    items: items.map((item) => ({
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxRate: item.taxRate,
    })),
  };

  try {
    const created = await fetchJson('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    alert('Invoice berhasil dibuat.');
    event.currentTarget.reset();
    setDefaultDates();
    loadInvoices();
    loadProducts();
    window.open(`/api/invoices/${created.id}/preview`, '_blank');
  } catch (error) {
    alert(error.message);
  }
};

const setupPageActions = () => {
  const page = document.body.dataset.page;

  if (page === 'login') {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('demoLoginBtn').addEventListener('click', handleDemoLogin);
  }

  if (page === 'profile') {
    document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit);
    bindImagePreview('logo_file', 'logoPreview');
    bindImagePreview('stamp_file', 'stampPreview');
    bindImagePreview('signature_file', 'signaturePreview');
    loadProfile();
    setDefaultDates();
  }

  if (page === 'products') {
    document.getElementById('productForm').addEventListener('submit', handleProductSubmit);
    loadProducts();
  }

  if (page === 'customers') {
    document.getElementById('customerForm').addEventListener('submit', handleCustomerSubmit);
    loadCustomers();
  }

  if (page === 'invoices') {
    document.getElementById('invoiceForm').addEventListener('submit', handleInvoiceSubmit);
    document.getElementById('addItemBtn').addEventListener('click', () => addInvoiceItemRow());
    setDefaultDates();
    Promise.all([loadCustomers(), loadProducts(), loadInvoices()]);
  }

  if (page === 'dashboard') {
    loadDashboard();
  }
};

setupPageActions();
