/* ============================================================
   11:11 Men's Wear & Sport's Wear — POS frontend
   Talks to the Express API under /api/*. Auth token + role are
   stored in localStorage and sent as a Bearer token on requests.
   ============================================================ */

const APP = {
  role: null,
  config: null,
  products: [],
  categories: [],
  cart: [],
  activeCategory: 'ALL',
  currentSource: 'offline',
  currentInvoiceOrder: null,
  invoiceModalContext: 'new-sale',
  catalogContextRowId: null,
  currentPage: 'billing',
  orderFilters: { source: 'all', from: '', to: '', orderId: '', customer: '', phone: '' },
  ordersCache: [],
  analytics: { tab: 'revenue', period: 'all', from: '', to: '' }
};

/* ---------------- API HELPER ---------------- */
async function api(path, opts = {}) {
  const token = localStorage.getItem('pos_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api' + path, { ...opts, headers });

  if (res.status === 401) {
    logout();
    throw new Error('Your session expired. Please sign in again.');
  }
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "You don't have access to this.");
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }

  if (!res.ok) {
    throw new Error((data && data.error) || 'Something went wrong. Please try again.');
  }
  return data;
}

/* ---------------- UTIL ---------------- */
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function money(n) { return '₹' + Number(n || 0).toFixed(2).replace(/\.00$/, ''); }
function moneyFull(n) { return '₹' + Number(n || 0).toFixed(2); }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function showError(msg) { showToast('⚠ ' + msg); }
function shopInitials(name) {
  if (!name) return 'POS';
  const first = name.trim().split(' ')[0];
  if (/\d/.test(first)) return first;
  return name.trim().split(' ').map(w => w[0]).slice(0, 3).join('').toUpperCase();
}

/* ---------------- CONFIG / BRANDING ---------------- */
async function loadConfig() {
  try {
    APP.config = await fetch('/api/config').then(r => r.json());
    applyBranding();
  } catch (e) {
    APP.config = {
      shopName: 'POS Terminal', ownerName: '', address: '', footerTagline: '',
      poweredByName: 'CENEXA SYSTEMS', poweredByUrl: 'https://www.cenexasystems.com/', version: 'V2.1.0 • PREMIUM POS'
    };
    applyBranding();
  }
}

function applyBranding() {
  const c = APP.config;
  const initials = shopInitials(c.shopName);

  document.getElementById('login-shop-name').textContent = c.shopName;
  document.getElementById('login-logo').textContent = initials;
  document.getElementById('login-version').textContent = c.version + ' TERMINAL';

  document.getElementById('sidebar-shop-name').textContent = c.shopName;
  document.getElementById('sidebar-logo').textContent = initials;
  document.getElementById('sidebar-version').textContent = c.version;

  document.getElementById('mobile-shop-name').textContent = c.shopName;

  document.title = c.shopName + ' — POS';
  renderFooter();
}

function renderFooter() {
  const el = document.getElementById('app-footer');
  if (!el || !APP.config) return;
  const c = APP.config;
  el.innerHTML = `
    <span>© ${new Date().getFullYear()} ALL RIGHTS RESERVED. ${escapeHtml((c.shopName || '').toUpperCase())}.</span>
    <span>POWERED BY <a href="${escapeHtml(c.poweredByUrl)}" target="_blank" rel="noopener">${escapeHtml(c.poweredByName)}</a> @${new Date().getFullYear()}</span>
    <span class="tagline">${escapeHtml(c.footerTagline || '')}</span>
  `;
}

/* ---------------- LOGIN / SESSION ---------------- */
function togglePw() {
  const inp = document.getElementById('login-pw');
  const btn = document.querySelector('.pw-toggle');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  if (btn) btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

async function doLogin() {
  const pw = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-err');
  const inputEl = document.getElementById('login-pw');
  errEl.textContent = '';
  inputEl.classList.remove('err');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');
    localStorage.setItem('pos_token', data.token);
    localStorage.setItem('pos_role', data.role);
    showApp();
  } catch (e) {
    inputEl.classList.add('err');
    errEl.textContent = e.message;
  }
}

function showApp() {
  APP.role = localStorage.getItem('pos_role');
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('view-app').classList.remove('hidden');
  document.getElementById('role-avatar').textContent = APP.role === 'admin' ? 'A' : 'S';
  buildNav();
  goTo('billing');
}

function logout() {
  localStorage.removeItem('pos_token');
  localStorage.removeItem('pos_role');
  document.getElementById('view-app').classList.add('hidden');
  document.getElementById('view-login').classList.remove('hidden');
  document.getElementById('login-pw').value = '';
  closeSidebar();
}

function openSidebar() {
  document.getElementById('sidebar').classList.remove('sidebar-collapsed');
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isMobile = window.matchMedia('(max-width:1024px)').matches;
  if (isMobile) {
    if (sidebar.classList.contains('open')) closeSidebar();
    else openSidebar();
  } else {
    sidebar.classList.toggle('sidebar-collapsed');
  }
}

/* ---------------- NAV / ROUTING ---------------- */
function buildNav() {
  const items = [{ page: 'billing', label: 'Billing Panel', ic: '🛒' }];
  if (APP.role === 'admin') {
    items.push({ page: 'orders', label: 'Order History', ic: '🕓' });
    items.push({ page: 'analytics', label: 'Analytics Dashboard', ic: '📊' });
  }
  document.getElementById('nav-list').innerHTML = items.map(i =>
    `<li class="nav-item" data-page="${i.page}" onclick="goTo('${i.page}')"><span class="ic">${i.ic}</span><span class="label">${i.label}</span></li>`
  ).join('');
}

function goTo(page) {
  if (page !== 'billing' && APP.role !== 'admin') page = 'billing';
  APP.currentPage = page;
  closeSidebar();
  document.querySelectorAll('.nav-item[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  ['billing', 'orders', 'analytics'].forEach(p => {
    document.getElementById('page-' + p).classList.toggle('hidden', p !== page);
  });
  if (page === 'billing') renderBillingPage();
  if (page === 'orders') renderOrdersPage();
  if (page === 'analytics') renderAnalyticsPage();
}

/* ============================================================
   BILLING PANEL (POS)
   ============================================================ */
function blankRow() {
  return { id: 'row-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), name: '', price: 0, qty: 1 };
}

function renderBillingPage() {
  const el = document.getElementById('page-billing');
  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-block">
        <button class="page-hamburger-btn" onclick="toggleSidebar()" title="Menu">☰</button>
        <div class="bar"></div>
        <div><h1>POS Billing Panel</h1><p>Quick invoice generator &amp; database synced checkout</p></div>
      </div>
      <div class="source-toggle">
        <button id="btn-offline" class="active offline" onclick="setSource('offline')">OFFLINE (POS)</button>
        <button id="btn-online" class="online" onclick="setSource('online')"><span class="dot"></span> ONLINE ORDER</button>
      </div>
    </div>

    <div class="pos-grid">
      <div>
        <div class="card">
          <h3><span class="sq"></span> Customer Details</h3>
          <div class="field-row">
            <div class="field"><label>CUSTOMER NAME <span class="required-star">*</span></label><input id="cust-name" placeholder="Enter name" oninput="renderSummary()"></div>
            <div class="field"><label>MOBILE NUMBER (WHATSAPP) <span class="required-star">*</span></label><input id="cust-phone" placeholder="Enter 10-digit number" maxlength="10" oninput="renderSummary()"></div>
          </div>
        </div>

        <div class="card">
          <h3><span class="sq"></span> Order Items</h3>
          <div class="order-toolbar">
            <button class="btn danger" onclick="clearOrder()">🗑 CLEAR ORDER</button>
            <button class="btn" onclick="openCatalogToolbar()">📚 ADD TO CATALOGUE</button>
            <button class="btn primary" onclick="addBlankRow()">+ ADD CUSTOM ITEM</button>
          </div>
          <div id="cart-rows"></div>
        </div>
      </div>

      <div class="card">
        <div class="summary-head">
          <h3 style="margin:0;">📋 Current Order</h3>
          <span class="src-tag" id="src-tag">● OFFLINE (POS)</span>
        </div>

        <div class="mini-info"><span>SOURCE</span><b id="mini-source">OFFLINE</b></div>
        <div class="mini-info"><span>CUSTOMER</span><b id="mini-customer">Walk-in Customer</b></div>
        <div class="mini-info"><span>PHONE</span><b id="mini-phone">—</b></div>
        <div class="empty-state hidden" id="mini-empty" style="padding:14px 0; font-style:italic;">No items added yet</div>
        <div id="invoice-lines" class="invoice-lines"></div>

        <label class="field-label" style="display:block; font-size:11px; font-weight:700; color:#6a6455; margin:14px 0 6px;">MANUAL DISCOUNT</label>
        <div class="discount-row" style="margin-bottom:14px;">
          <select id="discount-type" onchange="renderSummary()"><option value="pct">%</option><option value="flat">₹</option></select>
          <input id="discount-value" type="number" min="0" placeholder="0" style="flex:1; padding:9px 12px; border:1px solid var(--line); border-radius:7px;" oninput="renderSummary()">
        </div>

        <div class="sum-line"><span>Subtotal (<span id="item-count">0</span> items)</span><span id="sum-subtotal">₹0</span></div>
        <div class="sum-line" id="discount-line" style="display:none;"><span>Manual Discount</span><span id="sum-discount">-₹0</span></div>
        <div class="sum-line"><span>Delivery</span><input type="number" id="delivery-input" min="0" placeholder="0" oninput="renderSummary()"></div>

        <div class="sum-line">
          <span style="display:flex; align-items:center; gap:10px;">
            <label class="toggle-switch"><input type="checkbox" id="gst-toggle" onchange="toggleGstInput()"><span class="slider"></span></label>
            APPLY GST
          </span>
          <input id="gst-value" type="number" min="0" placeholder="%" class="hidden" style="width:64px; padding:6px 8px; border:1px solid var(--line); border-radius:6px; text-align:right;" oninput="renderSummary()">
        </div>
        <div class="sum-line" id="gst-line" style="display:none;"><span>GST Amount</span><span id="sum-gst">₹0</span></div>

        <div class="sum-line total"><span>GRAND TOTAL</span><span id="sum-grand">₹0.00</span></div>

        <div style="margin-top:14px; border-top:1.5px solid var(--line); padding-top:14px;">
          <label class="field-label" style="display:block; font-size:11px; font-weight:700; color:#6a6455; margin-bottom:6px;">CASH PAYMENT<br>Amount Received (₹)</label>
          <input id="amount-received" type="number" min="0" placeholder="0.00" style="width:100%; padding:10px 12px; border:1.5px solid var(--line); border-radius:8px;" oninput="renderSummary()">
          <div class="sum-line" id="return-line" style="display:none;"><span>Return Balance:</span><b id="return-balance">₹0</b></div>
        </div>

        <button class="send-whatsapp-btn" id="complete-btn" onclick="completeSale()" disabled>💬 SEND BILL VIA WHATSAPP</button>
      </div>
    </div>
  `;

  APP.cart = [];
  loadProducts().then(() => { renderCart(); renderSummary(); });
}

async function loadProducts() {
  try {
    APP.products = await api('/products');
  } catch (e) { showError(e.message); }
}

function setSource(src) {
  APP.currentSource = src;
  document.getElementById('btn-offline').classList.toggle('active', src === 'offline');
  document.getElementById('btn-online').classList.toggle('active', src === 'online');
  const tag = document.getElementById('src-tag');
  const label = src === 'offline' ? '● OFFLINE (POS)' : '● ONLINE ORDER';
  tag.textContent = label; tag.classList.toggle('on', src === 'online');
  document.getElementById('mini-source').textContent = src.toUpperCase();
}

function clearOrder() {
  APP.cart = [];
  renderCart(); renderSummary();
  showToast('Order cleared');
}
function addBlankRow() {
  APP.cart.push(blankRow());
  renderCart(); renderSummary();
}
function removeRow(id) {
  APP.cart = APP.cart.filter(r => r.id !== id);
  renderCart(); renderSummary();
}
function updateRowName(id, val) {
  const row = APP.cart.find(r => r.id === id);
  if (row) row.name = val;
  renderSummary();
}
function updateRowPrice(id, val) {
  const row = APP.cart.find(r => r.id === id);
  if (row) row.price = parseFloat(val) || 0;
  renderSummary();
}
function changeQty(id, delta) {
  const row = APP.cart.find(r => r.id === id);
  if (!row) return;
  row.qty = Math.max(1, (row.qty || 1) + delta);
  renderCart(); renderSummary();
}

function renderCart() {
  const container = document.getElementById('cart-rows');
  if (!container) return;
  if (APP.cart.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:18px 0; font-style:italic;">No items added yet — use Add to Catalogue or Add Custom Item above.</div>`;
    return;
  }
  container.innerHTML = APP.cart.map(r => `
    <div class="item-row">
      <div class="name-wrap">
        <input value="${escapeHtml(r.name)}" placeholder="Type custom product description..." oninput="updateRowName('${r.id}', this.value)">
        <button class="catalog-btn" onclick="openCatalogForRow('${r.id}')">☰ CATALOGUE</button>
      </div>
      <input class="price-input" type="number" min="0" value="${r.price || ''}" placeholder="0" oninput="updateRowPrice('${r.id}', this.value)">
      <div class="qty-del-group">
        <div class="qty-ctrl">
          <button onclick="changeQty('${r.id}',-1)">−</button><span>${r.qty}</span><button onclick="changeQty('${r.id}',1)">+</button>
        </div>
        <button class="row-del" onclick="removeRow('${r.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

function toggleGstInput() {
  const on = document.getElementById('gst-toggle').checked;
  document.getElementById('gst-value').classList.toggle('hidden', !on);
  renderSummary();
}

function validItems() {
  return APP.cart.filter(r => r.name && r.name.trim() && Number(r.price) > 0 && Number(r.qty) > 0);
}

function renderSummary() {
  const custName = document.getElementById('cust-name');
  if (!custName) return;

  const items = validItems();
  document.getElementById('mini-empty').classList.toggle('hidden', items.length > 0);

  const custNameVal = document.getElementById('cust-name').value.trim();
  const custPhoneVal = document.getElementById('cust-phone').value.trim();
  document.getElementById('mini-customer').textContent = custNameVal || 'Walk-in Customer';
  document.getElementById('mini-phone').textContent = custPhoneVal || '—';
  const nameValid = custNameVal.length > 0;
  const phoneValid = /^\d{10}$/.test(custPhoneVal);
  document.getElementById('cust-phone').classList.toggle('field-invalid', custPhoneVal.length > 0 && !phoneValid);

  const linesEl = document.getElementById('invoice-lines');
  linesEl.innerHTML = items.length ? items.map(r => `
    <div class="invoice-line-row">
      <span class="inv-line-name">${escapeHtml(r.name)} <span class="inv-line-qty">x${r.qty}</span></span>
      <span class="inv-line-amt">${money(Number(r.price) * Number(r.qty))}</span>
    </div>
  `).join('') : '';

  const subtotal = items.reduce((s, r) => s + Number(r.price) * Number(r.qty), 0);
  const itemCount = items.reduce((s, r) => s + Number(r.qty), 0);
  document.getElementById('item-count').textContent = itemCount;
  document.getElementById('sum-subtotal').textContent = money(subtotal);

  let running = subtotal;
  const dType = document.getElementById('discount-type').value;
  const dVal = parseFloat(document.getElementById('discount-value').value) || 0;
  let discountAmt = 0;
  if (dVal > 0) {
    discountAmt = dType === 'pct' ? running * dVal / 100 : dVal;
    discountAmt = Math.min(discountAmt, running);
    running -= discountAmt;
    document.getElementById('discount-line').style.display = 'flex';
    document.getElementById('sum-discount').textContent = '-' + money(discountAmt);
  } else {
    document.getElementById('discount-line').style.display = 'none';
  }

  const delivery = parseFloat(document.getElementById('delivery-input').value) || 0;

  const gstOn = document.getElementById('gst-toggle').checked;
  let gstAmt = 0;
  if (gstOn) {
    const gstVal = parseFloat(document.getElementById('gst-value').value) || 0;
    gstAmt = running * gstVal / 100;
    document.getElementById('gst-line').style.display = 'flex';
    document.getElementById('sum-gst').textContent = money(gstAmt);
  } else {
    document.getElementById('gst-line').style.display = 'none';
  }

  const grand = Math.max(0, running + gstAmt + delivery);
  document.getElementById('sum-grand').textContent = moneyFull(grand);

  const received = parseFloat(document.getElementById('amount-received').value) || 0;
  if (received > 0) {
    const balance = received - grand;
    document.getElementById('return-line').style.display = 'flex';
    document.getElementById('return-balance').textContent = money(Math.abs(balance)) + (balance < 0 ? ' due' : '');
  } else {
    document.getElementById('return-line').style.display = 'none';
  }

  document.getElementById('complete-btn').disabled = items.length === 0 || !nameValid || !phoneValid;
  return { subtotal, discountAmt, gstAmt, delivery, grand, itemCount, received };
}

async function completeSale() {
  const items = validItems();
  if (items.length === 0) return;
  const custName = document.getElementById('cust-name').value.trim();
  const custPhone = document.getElementById('cust-phone').value.trim();
  if (!custName) { showError('Customer name is required.'); return; }
  if (!/^\d{10}$/.test(custPhone)) { showError('Enter a valid 10-digit mobile number.'); return; }
  const btn = document.getElementById('complete-btn');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  const payload = {
    customer: document.getElementById('cust-name').value,
    phone: document.getElementById('cust-phone').value,
    items: items.map(r => ({ name: r.name.trim(), price: Number(r.price), qty: Number(r.qty) })),
    source: APP.currentSource,
    discountType: document.getElementById('discount-type').value,
    discountValue: parseFloat(document.getElementById('discount-value').value) || 0,
    gstEnabled: document.getElementById('gst-toggle').checked,
    gstPct: parseFloat(document.getElementById('gst-value').value) || 0,
    delivery: parseFloat(document.getElementById('delivery-input').value) || 0,
    paymentMode: 'cash',
    amountReceived: parseFloat(document.getElementById('amount-received').value) || 0
  };

  try {
    const order = await api('/orders', { method: 'POST', body: JSON.stringify(payload) });
    openInvoiceModal(order, 'new-sale');
    setTimeout(() => sendWhatsApp(), 300);
  } catch (e) {
    showError(e.message);
  } finally {
    btn.textContent = '💬 SEND BILL VIA WHATSAPP';
    btn.disabled = validItems().length === 0;
  }
}

function resetBillingForm() {
  APP.cart = [];
  if (document.getElementById('cust-name')) {
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-phone').value = '';
    document.getElementById('discount-value').value = '';
    document.getElementById('gst-toggle').checked = false;
    document.getElementById('gst-value').value = '';
    document.getElementById('gst-value').classList.add('hidden');
    document.getElementById('delivery-input').value = '';
    document.getElementById('amount-received').value = '';
    renderCart();
    renderSummary();
  }
}

/* ============================================================
   CATALOGUE MODAL (shared: per-row picker + "add to catalogue")
   ============================================================ */
function openCatalogForRow(rowId) {
  APP.catalogContextRowId = rowId;
  openCatalogModal();
}
function openCatalogToolbar() {
  APP.catalogContextRowId = null;
  openCatalogModal();
}
async function openCatalogModal() {
  await Promise.all([loadProducts(), loadCategories()]);
  document.getElementById('catalog-modal').classList.remove('hidden');
  populateCategorySelect();
  renderCategoryChips();
  APP.activeCategory = 'ALL';
  renderCatalog();
}
function closeCatalog() {
  document.getElementById('catalog-modal').classList.add('hidden');
  APP.catalogContextRowId = null;
}

async function loadCategories() {
  try {
    APP.categories = await api('/categories');
  } catch (e) { showError(e.message); }
}

function allCategoryNames() {
  // Union of explicitly-created categories and any category text still
  // sitting on older products, so nothing "disappears" after this update.
  const fromList = APP.categories.map(c => c.name);
  const fromProducts = APP.products.map(p => p.category);
  return [...new Set([...fromList, ...fromProducts])].filter(Boolean);
}

function populateCategorySelect() {
  const sel = document.getElementById('new-cat');
  const names = allCategoryNames();
  sel.innerHTML = names.length
    ? names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')
    : '<option value="General">General</option>';
}

function renderCategoryChips() {
  const el = document.getElementById('category-chip-list');
  el.innerHTML = APP.categories.length
    ? APP.categories.map(c => `<span class="category-chip">${escapeHtml(c.name)}<button title="Delete category" onclick="deleteCategory('${c.id}')">✕</button></span>`).join('')
    : '<span style="font-size:11.5px; color:var(--muted);">No categories yet — add one above.</span>';
}

async function addCategory() {
  const input = document.getElementById('new-category-name');
  const name = input.value.trim();
  if (!name) { showError('Enter a category name.'); return; }
  try {
    await api('/categories', { method: 'POST', body: JSON.stringify({ name }) });
    input.value = '';
    await loadCategories();
    renderCategoryChips();
    populateCategorySelect();
    renderCatalog();
    showToast('Category added');
  } catch (e) { showError(e.message); }
}
async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this?')) return;
  try {
    await api('/categories/' + id, { method: 'DELETE' });
    await loadCategories();
    renderCategoryChips();
    populateCategorySelect();
    renderCatalog();
  } catch (e) { showError(e.message); }
}

function renderCatalog() {
  const cats = ['ALL', ...allCategoryNames()];
  document.getElementById('cat-tabs').innerHTML = cats.map(c =>
    `<button class="cat-tab ${c === APP.activeCategory ? 'active' : ''}" onclick="setCatalogCategory('${escapeHtml(c).replace(/'/g, "\\'")}')">${escapeHtml(c.toUpperCase())}</button>`
  ).join('');

  const q = (document.getElementById('catalog-search').value || '').toLowerCase();
  const filtered = APP.products.filter(p => {
    const matchesCat = APP.activeCategory === 'ALL' || p.category === APP.activeCategory;
    const matchesQ = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    return matchesCat && matchesQ;
  });

  document.getElementById('prod-grid').innerHTML = filtered.map(p => `
    <div class="prod-card" onclick='selectProductForCatalog(${JSON.stringify(p)})'>
      <div class="prod-actions">
        <button title="Edit" onclick="event.stopPropagation(); editProduct('${p.id}')">✎</button>
        <button title="Delete" onclick="event.stopPropagation(); deleteProduct('${p.id}')">🗑</button>
      </div>
      <div class="pname">${escapeHtml(p.name)}</div>
      <div class="price-row"><span class="price">₹${p.price}</span><span class="cat-chip">${escapeHtml(p.category.toUpperCase())}</span></div>
    </div>
  `).join('') || '<div class="empty-state" style="grid-column:1/-1;">No items found</div>';
}
function setCatalogCategory(c) { APP.activeCategory = c; renderCatalog(); }

function selectProductForCatalog(p) {
  if (APP.catalogContextRowId) {
    const row = APP.cart.find(r => r.id === APP.catalogContextRowId);
    if (row) { row.name = p.name; row.price = p.price; row.qty = row.qty || 1; }
  } else {
    APP.cart.push({ id: 'row-' + Date.now(), name: p.name, price: p.price, qty: 1 });
  }
  renderCart(); renderSummary();
  closeCatalog();
  showToast(p.name + ' added');
}

async function saveProduct() {
  const name = document.getElementById('new-name').value.trim();
  const category = document.getElementById('new-cat').value || 'General';
  const price = parseFloat(document.getElementById('new-price').value) || 0;
  if (!name || price <= 0) { showError('Enter a name and a valid price.'); return; }

  const editId = document.getElementById('edit-id').value;
  try {
    if (editId) {
      await api('/products/' + editId, { method: 'PUT', body: JSON.stringify({ name, category, price }) });
    } else {
      await api('/products', { method: 'POST', body: JSON.stringify({ name, category, price }) });
    }
    await loadProducts();
    resetProductForm();
    renderCatalog();
    showToast('Catalogue updated');
  } catch (e) { showError(e.message); }
}
function editProduct(id) {
  const p = APP.products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('edit-id').value = p.id;
  document.getElementById('new-name').value = p.name;
  populateCategorySelect();
  document.getElementById('new-cat').value = p.category;
  document.getElementById('new-price').value = p.price;
}
async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this?')) return;
  try {
    await api('/products/' + id, { method: 'DELETE' });
    await loadProducts();
    renderCatalog();
  } catch (e) { showError(e.message); }
}
function resetProductForm() {
  document.getElementById('edit-id').value = '';
  document.getElementById('new-name').value = '';
  document.getElementById('new-price').value = '';
}

/* ============================================================
   ORDER HISTORY (admin only)
   ============================================================ */
function renderOrdersPage() {
  const el = document.getElementById('page-orders');
  el.innerHTML = `
    <div class="filter-header-row">
      <div class="page-title-block"><button class="page-hamburger-btn" onclick="toggleSidebar()" title="Menu">☰</button><div class="bar"></div><div><h1>Order History</h1><p>Manage and track past invoices</p></div></div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <div class="period-row" id="oh-period-row">
          ${['all', 'today', 'week', 'month', 'year'].map(p => `<button data-period="${p}" class="${p === 'all' ? 'active' : ''}" onclick="setOrdersPeriod('${p}')">${{ all: 'All Time', today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year' }[p]}</button>`).join('')}
        </div>
        <div class="date-range-inline">
          <span class="calendar-icon">📅</span>
          <input type="date" id="oh-from" onchange="setOrdersCustomDate()"> <span style="color:var(--muted); font-size:12px;">to</span> <input type="date" id="oh-to" onchange="setOrdersCustomDate()">
        </div>
        <button class="btn primary" onclick="exportCSV()">⬇ EXPORT CSV</button>
      </div>
    </div>

    <div class="card">
      <div class="search-fields">
        <input id="filter-orderid" placeholder="e.g. INV-..." oninput="onOrderFilterInput()">
        <input id="filter-customer" placeholder="Customer name..." oninput="onOrderFilterInput()">
        <input id="filter-phone" placeholder="Customer phone..." oninput="onOrderFilterInput()">
        <select id="filter-source" onchange="onOrderFilterInput()">
          <option value="all">All Sources</option>
          <option value="online">Online Orders</option>
          <option value="offline">Offline (POS)</option>
        </select>
      </div>
    </div>

    <div class="results-count" id="results-count">Loading...</div>

    <div style="overflow-x:auto;">
      <table>
        <thead><tr><th>Order ID</th><th>Customer Name</th><th>Mobile Number</th><th>Source</th><th>Total Due</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="orders-body"></tbody>
      </table>
    </div>
    <div id="orders-empty" class="empty-state hidden"><div class="ic">🧾</div>No bills match these filters</div>
  `;
  APP.orderFilters = { source: 'all', from: '', to: '', orderId: '', customer: '', phone: '' };
  loadOrders();
}

function setOrdersPeriod(preset) {
  document.querySelectorAll('#oh-period-row button').forEach(b => b.classList.toggle('active', b.dataset.period === preset));
  const now = new Date();
  if (preset === 'all') { APP.orderFilters.from = ''; APP.orderFilters.to = ''; }
  else if (preset === 'today') { const d = now.toISOString().slice(0, 10); APP.orderFilters.from = d; APP.orderFilters.to = d; }
  else if (preset === 'week') { const s = new Date(now); s.setDate(now.getDate() - 7); APP.orderFilters.from = s.toISOString().slice(0, 10); APP.orderFilters.to = now.toISOString().slice(0, 10); }
  else if (preset === 'month') { const s = new Date(now); s.setDate(now.getDate() - 30); APP.orderFilters.from = s.toISOString().slice(0, 10); APP.orderFilters.to = now.toISOString().slice(0, 10); }
  else if (preset === 'year') { const s = new Date(now.getFullYear(), 0, 1); APP.orderFilters.from = s.toISOString().slice(0, 10); APP.orderFilters.to = now.toISOString().slice(0, 10); }
  document.getElementById('oh-from').value = APP.orderFilters.from;
  document.getElementById('oh-to').value = APP.orderFilters.to;
  loadOrders();
}
function setOrdersCustomDate() {
  APP.orderFilters.from = document.getElementById('oh-from').value;
  APP.orderFilters.to = document.getElementById('oh-to').value;
  document.querySelectorAll('#oh-period-row button').forEach(b => b.classList.remove('active'));
  loadOrders();
}

let orderFilterDebounce = null;
function onOrderFilterInput() {
  clearTimeout(orderFilterDebounce);
  orderFilterDebounce = setTimeout(() => {
    APP.orderFilters.orderId = document.getElementById('filter-orderid').value.trim();
    APP.orderFilters.customer = document.getElementById('filter-customer').value.trim();
    APP.orderFilters.phone = document.getElementById('filter-phone').value.trim();
    APP.orderFilters.source = document.getElementById('filter-source').value;
    loadOrders();
  }, 250);
}

async function loadOrders() {
  const f = APP.orderFilters;
  const params = new URLSearchParams();
  if (f.source && f.source !== 'all') params.set('source', f.source);
  if (f.from) params.set('from', f.from);
  if (f.to) params.set('to', f.to);
  if (f.orderId) params.set('orderId', f.orderId);
  if (f.customer) params.set('customer', f.customer);
  if (f.phone) params.set('phone', f.phone);

  try {
    const orders = await api('/orders?' + params.toString());
    APP.ordersCache = orders;
    renderOrdersList(orders);
  } catch (e) { showError(e.message); }
}

function renderOrdersList(orders) {
  const body = document.getElementById('orders-body');
  const empty = document.getElementById('orders-empty');
  const countEl = document.getElementById('results-count');
  if (!body) return;

  countEl.textContent = `${orders.length} result${orders.length === 1 ? '' : 's'}`;

  if (orders.length === 0) {
    body.innerHTML = ''; empty.classList.remove('hidden'); return;
  }
  empty.classList.add('hidden');

  body.innerHTML = orders.map(o => `
    <tr>
      <td style="font-weight:700;">${escapeHtml(o.number)}</td>
      <td>${escapeHtml(o.customer)}</td>
      <td>${escapeHtml(o.phone)}</td>
      <td><span class="tag ${o.source}">${escapeHtml(o.source)}</span></td>
      <td style="font-weight:700;">${money(o.grandTotal)}</td>
      <td>
        <select onchange="updateOrderStatus('${o.id}', this.value)" style="padding:5px 6px; border-radius:6px; border:1.5px solid var(--line); font-size:11px; font-weight:700;">
          ${['Completed', 'Pending', 'Cancelled'].map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <div class="order-actions">
          <button class="btn green" title="Send via WhatsApp" onclick="sendWhatsAppForOrder('${o.id}')">💬</button>
          <button class="btn primary" title="View invoice" onclick="viewInvoice('${o.id}')">🧾</button>
          <button class="btn dark" title="Download invoice" onclick="downloadInvoiceForOrder('${o.id}')">⬇</button>
          <button class="btn danger" title="Delete" onclick="deleteOrder('${o.id}')">🗑</button>
        </div>
      </td>
    </tr>`).join('');
}

async function updateOrderStatus(id, status) {
  try {
    await api('/orders/' + id + '/status', { method: 'PUT', body: JSON.stringify({ status }) });
    showToast('Status updated');
  } catch (e) { showError(e.message); loadOrders(); }
}
async function deleteOrder(id) {
  if (!confirm('Are you sure you want to delete this?')) return;
  try { await api('/orders/' + id, { method: 'DELETE' }); loadOrders(); }
  catch (e) { showError(e.message); }
}
async function exportCSV() {
  try {
    const token = localStorage.getItem('pos_token');
    const res = await fetch('/api/orders/export', { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('Export failed.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'order-history.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) { showError(e.message); }
}
async function viewInvoice(id) {
  try { const order = await api('/orders/' + id); openInvoiceModal(order, 'history'); }
  catch (e) { showError(e.message); }
}
async function sendWhatsAppForOrder(id) {
  try { const order = await api('/orders/' + id); sendWhatsAppForData(order); }
  catch (e) { showError(e.message); }
}

/* ============================================================
   INVOICE PREVIEW MODAL
   ============================================================ */
function openInvoiceModal(order, context) {
  APP.currentInvoiceOrder = order;
  APP.invoiceModalContext = context;
  document.getElementById('inv-modal-sub').textContent = order.number;
  document.getElementById('invoice-paper').innerHTML = renderInvoiceHTML(order);
  document.getElementById('invoice-modal').classList.remove('hidden');
}
function closeInvoiceModal() {
  document.getElementById('invoice-modal').classList.add('hidden');
  if (APP.invoiceModalContext === 'new-sale') resetBillingForm();
  if (APP.currentPage === 'orders') loadOrders();
}

function renderInvoiceHTML(inv) {
  const c = APP.config || {};
  const d = new Date(inv.date);
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const itemsHtml = inv.items.map(it => `
    <tr>
      <td>${escapeHtml(it.name)}</td>
      <td style="text-align:center;">${it.qty}</td>
      <td style="text-align:right;">₹${it.price}</td>
      <td style="text-align:right; font-weight:700;">₹${(it.price * it.qty).toFixed(0)}</td>
    </tr>`).join('');

  let paymentHtml = '';
  if (inv.amountReceived > 0) {
    const balance = inv.balance;
    paymentHtml = `
      <div class="payment-strip">
        <span>Amount Received: <b>${moneyFull(inv.amountReceived)}</b></span>
        <span>${balance >= 0 ? 'Balance Returned' : 'Balance Due'}: <b>${moneyFull(Math.abs(balance))}</b></span>
      </div>`;
  }

  return `
    <div class="inv-center">
      <div class="inv-logo">${escapeHtml(shopInitials(c.shopName))}</div>
      <h2>${escapeHtml((c.shopName || '').toUpperCase())}</h2>
      <div class="sub">${escapeHtml(c.address || '')}</div>
      <div class="num">Invoice: ${escapeHtml(inv.number)}</div>
      <div class="status-chip">${escapeHtml((inv.status || 'Completed').toUpperCase())}</div>
    </div>
    <div class="inv-meta">
      <div><div class="label">Order Date</div><div style="font-weight:700; margin-top:4px;">${dateStr}, ${timeStr}</div></div>
      <div class="cust-box">
        <div class="label">Customer</div><div class="name">${escapeHtml(inv.customer)}</div>
        <div class="label">Mobile Number</div><div style="margin-top:2px;">${escapeHtml(inv.phone)}</div>
      </div>
    </div>
    <table class="inv-table">
      <thead><tr><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="inv-totals">
      <div class="line"><span>Subtotal</span><span>${moneyFull(inv.subtotal)}</span></div>
      ${inv.manualDiscount > 0 ? `<div class="line"><span>Manual Discount</span><span>-${moneyFull(inv.manualDiscount)}</span></div>` : ''}
      ${inv.gstAmt > 0 ? `<div class="line"><span>GST Amount</span><span>${moneyFull(inv.gstAmt)}</span></div>` : ''}
      <div class="line"><span>Delivery</span><span>${inv.delivery > 0 ? moneyFull(inv.delivery) : 'FREE'}</span></div>
      <div class="line grand"><span>Grand Total</span><span>${moneyFull(inv.grandTotal)}</span></div>
    </div>
    ${paymentHtml}
    <div style="text-align:center; color:var(--muted); font-size:11.5px; margin-top:22px;">Thank you for shopping with ${escapeHtml(c.shopName || 'us')}!</div>
  `;
}

function sendWhatsApp() {
  if (!APP.currentInvoiceOrder) return;
  sendWhatsAppForData(APP.currentInvoiceOrder);
}
function sendWhatsAppForData(inv) {
  const shopName = (APP.config && APP.config.shopName) || 'our store';
  const invoiceLink = `${window.location.origin}/api/invoice/${inv.id}`;
  const lines = [
    `🧾 *Invoice No:* ${inv.number}`,
    `📅 *Date:* ${new Date(inv.date).toLocaleDateString('en-GB')}`,
    `🙋 *Customer:* ${inv.customer}`,
    `📱 *Phone:* ${inv.phone || '-'}`,
    ``, `🛍️ *ITEMS PURCHASED*`,
    ...inv.items.map(it => `• ${it.name} — Qty: ${it.qty} x ₹${it.price} = ₹${(it.price * it.qty).toFixed(0)}`),
    ``, `💰 *Grand Total: ₹${inv.grandTotal.toFixed(2)}*`,
    ``, `📎 Download your invoice: ${invoiceLink}`,
    ``, `✨ Thank you for choosing *${shopName}*! 🙏`
  ];
  const text = encodeURIComponent(lines.join('\n'));
  const phone = (inv.phone || '').replace(/\D/g, '');
  const url = phone.length >= 10 ? `https://wa.me/91${phone.slice(-10)}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, '_blank');
}

function downloadInvoice() {
  if (!APP.currentInvoiceOrder) return;
  downloadInvoiceForData(APP.currentInvoiceOrder);
}
async function downloadInvoiceForOrder(id) {
  try {
    const order = await api('/orders/' + id);
    downloadInvoiceForData(order);
  } catch (e) { showError(e.message); }
}
function downloadInvoiceForData(inv) {
  const css = `
    body{font-family:Segoe UI,Arial,sans-serif; color:#1a1a1a; max-width:620px; margin:30px auto; padding:0 20px;}
    .inv-center{text-align:center; margin-bottom:22px;}
    .inv-logo{width:52px;height:52px;border-radius:14px; margin:0 auto 10px; background:#121212; color:#d6203c; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:10px;}
    .inv-center h2{color:#a8172f; margin:0 0 2px; font-size:19px;}
    .inv-center .sub{color:#7a7a7a; font-size:11.5px; margin-bottom:8px;}
    .status-chip{display:inline-block; background:#e6f7ee; color:#1fae64; font-weight:700; font-size:11px; padding:4px 12px; border-radius:999px;}
    .inv-meta{display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px;}
    .inv-meta .label{font-size:10px; color:#7a7a7a; text-transform:uppercase; font-weight:700;}
    .cust-box{background:#f7f5ee; border-radius:10px; padding:12px 14px;}
    .cust-box .name{font-weight:800; font-size:14px; margin:4px 0 8px;}
    table{width:100%; border-collapse:collapse;}
    .inv-table th{text-align:left; font-size:10.5px; text-transform:uppercase; color:#7a7a7a; border-bottom:1.5px solid #e7e7e5; padding-bottom:8px;}
    .inv-table td{padding:9px 0; border-bottom:1px solid #f1efe8; font-size:13px;}
    .inv-totals{margin-top:12px; margin-left:auto; width:260px;}
    .inv-totals .line{display:flex; justify-content:space-between; font-size:13px; padding:5px 0; color:#4c4738;}
    .inv-totals .grand{font-weight:800; font-size:16px; border-top:1.5px solid #e7e7e5; padding-top:10px; margin-top:6px; color:#a8172f;}
    .payment-strip{margin-top:16px; background:#fce9ec; border-radius:10px; padding:11px 14px; font-size:12.5px; display:flex; justify-content:space-between;}
  `;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(inv.number)}</title><style>${css}</style></head><body>${renderInvoiceHTML(inv)}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = inv.number + '.html';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Invoice downloaded — open it and print to save as PDF');
}

/* ============================================================
   ANALYTICS DASHBOARD (admin only)
   ============================================================ */
function renderAnalyticsPage() {
  const el = document.getElementById('page-analytics');
  el.innerHTML = `
    <div class="page-header">
      <div class="page-title-block"><button class="page-hamburger-btn" onclick="toggleSidebar()" title="Menu">☰</button><div class="bar"></div><div><h1>POS Analytics</h1><p>Real-time store &amp; channel insights</p></div></div>
    </div>
    <div class="tabs-row">
      <div class="subtabs">
        <button data-tab="revenue" class="active" onclick="setAnalyticsTab('revenue')">Revenue</button>
        <button data-tab="today" onclick="setAnalyticsTab('today')">Today's Sales</button>
        <button data-tab="products" onclick="setAnalyticsTab('products')">Products</button>
        <button data-tab="coupons" onclick="setAnalyticsTab('coupons')">Coupons</button>
      </div>
      <div class="period-and-date" id="an-period-date-row">
        <div class="period-row" id="an-period-row">
          ${['all', 'today', 'week', 'month', 'year'].map(p => `<button data-period="${p}" class="${p === 'all' ? 'active' : ''}" onclick="setAnalyticsPeriod('${p}')">${{ all: 'All Time', today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year' }[p]}</button>`).join('')}
        </div>
        <div class="date-range-inline">
          <span class="calendar-icon">📅</span>
          <input type="date" id="an-from" onchange="setAnalyticsCustomDate()"> <span style="color:var(--muted); font-size:12px;">to</span> <input type="date" id="an-to" onchange="setAnalyticsCustomDate()">
          <span class="date-format-hint">DD/MM/YY</span>
        </div>
      </div>
    </div>
    <div id="analytics-body"><div class="empty-state">Loading analytics...</div></div>
  `;
  loadAnalyticsTab();
}

function setAnalyticsTab(tab) {
  APP.analytics.tab = tab;
  document.querySelectorAll('.subtabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const periodRow = document.getElementById('an-period-date-row');
  if (periodRow) periodRow.classList.toggle('hidden', tab === 'today');
  loadAnalyticsTab();
}
function setAnalyticsPeriod(period) {
  APP.analytics.period = period;
  document.querySelectorAll('#an-period-row button').forEach(b => b.classList.toggle('active', b.dataset.period === period));
  loadAnalyticsTab();
}
function setAnalyticsCustomDate() {
  APP.analytics.from = document.getElementById('an-from').value;
  APP.analytics.to = document.getElementById('an-to').value;
  document.querySelectorAll('#an-period-row button').forEach(b => b.classList.remove('active'));
  loadAnalyticsTab();
}

function barChartHtml(entries, opts = {}) {
  if (!entries || entries.length === 0) return '<div class="empty-state">No data for this period</div>';
  const max = Math.max(...entries.map(e => e.value), 1);
  return '<div class="bar-chart">' + entries.map(e => {
    const h = Math.max(4, Math.round(e.value / max * 140));
    const display = opts.currency ? money(e.value) : Math.round(e.value);
    return `<div class="bar-col"><div class="bar-value">${display}</div><div class="bar" style="height:${h}px;"></div><div class="bar-label">${escapeHtml(e.label)}</div></div>`;
  }).join('') + '</div>';
}

async function loadAnalyticsTab() {
  const body = document.getElementById('analytics-body');
  const { tab, period, from, to } = APP.analytics;
  const params = new URLSearchParams();
  if (period && period !== 'all') params.set('period', period);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    if (tab === 'revenue') {
      const d = await api('/analytics/revenue?' + params.toString());
      body.innerHTML = `
        <div class="stat-grid">
          <div class="stat-card"><div class="ic">₹</div><div class="label">Total Revenue</div><div class="value">${money(d.totalRevenue)}</div><div class="sub">POS combined</div></div>
          <div class="stat-card"><div class="ic">🏆</div><div class="label">Completed Bills</div><div class="value">${d.completedBills}</div></div>
          <div class="stat-card"><div class="ic">₹</div><div class="label">Offline Bills</div><div class="value">${money(d.offlineTotal)}</div><div class="sub">Walk-in POS sales</div></div>
          <div class="stat-card"><div class="ic">📶</div><div class="label">Online Bills</div><div class="value">${money(d.onlineTotal)}</div><div class="sub">Online sales</div></div>
        </div>
        <div class="stat-grid cols-5">
          <div class="stat-card"><div class="label">Offline Bills</div><div class="value">${d.offlineCount}</div></div>
          <div class="stat-card"><div class="label">Online Bills</div><div class="value">${d.onlineCount}</div></div>
          <div class="stat-card"><div class="label">Items Sold</div><div class="value">${d.totalItemsSold}</div></div>
          <div class="stat-card"><div class="label">Avg Order Value</div><div class="value">${money(d.avgOrderValue)}</div></div>
          <div class="stat-card"><div class="label">Top Product</div><div class="value" style="font-size:15px;">${escapeHtml(d.topProduct)}</div></div>
        </div>
        <div class="chart-row">
          <div>
            <div class="card"><h3>Revenue Trend This Year <span style="color:var(--red);">${d.year}</span></h3>${barChartHtml(d.monthlyTrend, { currency: true })}</div>
            <div class="card"><h3>Revenue This Week <span style="color:var(--red);">(Week ${d.week} of ${d.year})</span></h3>${barChartHtml(d.weeklyTrend, { currency: true })}</div>
          </div>
          <div>
            <div class="card"><h3>Order Source</h3>
              <div class="channel-split">
                <div class="channel-bar-row"><span class="cname">OFFLINE</span><div class="track"><div class="fill offline" style="width:${d.offlineCount + d.onlineCount ? d.offlineCount / (d.offlineCount + d.onlineCount) * 100 : 0}%;"></div></div><span class="cval">${d.offlineCount}</span></div>
                <div class="channel-bar-row"><span class="cname">ONLINE</span><div class="track"><div class="fill online" style="width:${d.offlineCount + d.onlineCount ? d.onlineCount / (d.offlineCount + d.onlineCount) * 100 : 0}%;"></div></div><span class="cval">${d.onlineCount}</span></div>
              </div>
            </div>
            <div class="card list-card"><h3>Top Items by Revenue</h3>${
              d.topItemsByRevenue.length ? d.topItemsByRevenue.map((it, i) => `
                <div class="list-row"><div class="left"><span class="rank">${i + 1}</span><span class="name">${escapeHtml(it.name)}</span><div class="meta">${it.qty} pcs</div></div><div class="amt">${money(it.revenue)}</div></div>
              `).join('') : '<div class="empty-state">No sales yet</div>'
            }</div>
          </div>
        </div>
      `;
    } else if (tab === 'today') {
      const d = await api('/analytics/today');
      const totalCh = d.channelSplit.offline + d.channelSplit.online;
      body.innerHTML = `
        <div class="stat-grid">
          <div class="stat-card"><div class="ic">₹</div><div class="label">Today's Revenue</div><div class="value">${money(d.revenue)}</div></div>
          <div class="stat-card"><div class="ic">🧾</div><div class="label">Today's Bills</div><div class="value">${d.bills}</div></div>
          <div class="stat-card"><div class="ic">📦</div><div class="label">Today's Items Sold</div><div class="value">${d.itemsSold} pcs</div></div>
          <div class="stat-card"><div class="ic">📈</div><div class="label">Today's Avg Order Value</div><div class="value">${money(d.avgOrderValue)}</div></div>
        </div>
        <div class="chart-row">
          <div class="card">
            <h3>Today's Transactions</h3>
            <div class="search-icon-wrap"><span class="search-icon">🔍</span><input class="search-box" id="today-search" placeholder="Search invoice/phone..." oninput="filterTodayTransactions()"></div>
            <div style="overflow-x:auto;">
              <table id="today-table">
                <thead><tr><th>Invoice ID</th><th>Customer No</th><th>Source</th><th>Items</th><th>Grand Total</th><th>Actions</th></tr></thead>
                <tbody id="today-tbody"></tbody>
              </table>
            </div>
          </div>
          <div>
            <div class="card"><h3>Today's Channel Split</h3>
              <div class="channel-split">
                <div class="channel-bar-row"><span class="cname">OFFLINE</span><div class="track"><div class="fill offline" style="width:${totalCh ? d.channelSplit.offline / totalCh * 100 : 0}%;"></div></div><span class="cval">${money(d.channelSplit.offline)}</span></div>
                <div class="channel-bar-row"><span class="cname">ONLINE</span><div class="track"><div class="fill online" style="width:${totalCh ? d.channelSplit.online / totalCh * 100 : 0}%;"></div></div><span class="cval">${money(d.channelSplit.online)}</span></div>
              </div>
            </div>
            <div class="card list-card"><h3>Today's Top Items</h3>${
              d.topItems.length ? d.topItems.map((it, i) => `
                <div class="list-row"><div class="left"><span class="rank">${i + 1}</span><span class="name">${escapeHtml(it.name)}</span><div class="meta">${it.qty} pcs</div></div><div class="amt">${money(it.revenue)}</div></div>
              `).join('') : '<div class="empty-state">No sales yet today</div>'
            }</div>
          </div>
        </div>
      `;
      APP._todayTransactions = d.transactions;
      renderTodayTransactions(d.transactions);
    } else if (tab === 'products') {
      const d = await api('/analytics/products?' + params.toString());
      body.innerHTML = `
        <div class="card">
          <div class="modal-head" style="margin-bottom:10px;"><h3 style="color:var(--ink);">Product Sales Leaderboard</h3></div>
          <div class="search-icon-wrap"><span class="search-icon">🔍</span><input class="search-box" id="product-search" placeholder="Search product..." oninput="filterProductLeaderboard()"></div>
          <div class="leaderboard-row head">
            <span>#</span><span>Product</span><span>Qty</span><span>Revenue</span><span class="share-cell">Market Share</span>
          </div>
          <div id="leaderboard-rows"></div>
        </div>
      `;
      APP._leaderboard = d.leaderboard;
      renderLeaderboard(d.leaderboard);
    } else if (tab === 'coupons') {
      const d = await api('/analytics/discounts?' + params.toString());
      body.innerHTML = `
        <div class="chart-row coupons-grid">
          <div class="card">
            <h3>Discount Summary</h3>
            <div class="stat-card" style="margin-bottom:12px;"><div class="ic">%</div><div class="label">Total Discounts Given</div><div class="value">${money(d.totalDiscountsGiven)}</div></div>
            <div class="stat-card" style="margin-bottom:12px;"><div class="ic">🧾</div><div class="label">Discounted Orders</div><div class="value">${d.discountedOrders}</div></div>
            <div class="stat-card"><div class="ic">₹</div><div class="label">Avg Discount / Order</div><div class="value">${money(d.avgDiscountPerOrder)}</div></div>
          </div>
          <div class="card">
            <h3>Promo Campaign Performance</h3>
            <div class="search-icon-wrap"><span class="search-icon">🔍</span><input class="search-box" id="promo-search" placeholder="Search invoice/mobile/amount..." oninput="filterPromoTable()"></div>
            <div style="overflow-x:auto;">
              <table>
                <thead><tr><th>Order ID</th><th>Customer Mobile</th><th>Order Total</th><th>Discount Applied</th><th>Actions</th></tr></thead>
                <tbody id="promo-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      APP._promoTransactions = d.transactions;
      renderPromoTable(d.transactions);
    }
  } catch (e) {
    body.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
  }
}

function renderTodayTransactions(list) {
  document.getElementById('today-tbody').innerHTML = list.length ? list.map(t => `
    <tr><td style="font-weight:700;">${escapeHtml(t.number)}</td><td>${escapeHtml(t.phone)}</td><td><span class="tag ${t.source}">${escapeHtml(t.source)}</span></td><td>${t.itemsCount} pcs</td><td style="font-weight:700;">${money(t.grandTotal)}</td>
    <td>
      <div class="order-actions">
        <button class="btn green" title="Send via WhatsApp" onclick="sendWhatsAppForOrder('${t.id}')">💬</button>
        <button class="btn dark" title="Download invoice" onclick="downloadInvoiceForOrder('${t.id}')">⬇</button>
        <button class="btn danger" title="Delete" onclick="deleteTodayTransaction('${t.id}')">🗑</button>
      </div>
    </td></tr>
  `).join('') : `<tr><td colspan="6"><div class="empty-state">No transactions yet today</div></td></tr>`;
}
async function deleteTodayTransaction(id) {
  if (!confirm('Are you sure you want to delete this?')) return;
  try {
    await api('/orders/' + id, { method: 'DELETE' });
    showToast('Transaction deleted');
    loadAnalyticsTab();
  } catch (e) { showError(e.message); }
}
function filterTodayTransactions() {
  const q = document.getElementById('today-search').value.toLowerCase();
  const filtered = (APP._todayTransactions || []).filter(t => t.number.toLowerCase().includes(q) || (t.phone || '').includes(q));
  renderTodayTransactions(filtered);
}

function renderLeaderboard(list) {
  document.getElementById('leaderboard-rows').innerHTML = list.length ? list.map(p => `
    <div class="leaderboard-row">
      <span>${p.rank}</span>
      <span style="overflow-wrap:anywhere;">${escapeHtml(p.name)}</span>
      <span>${p.qty} pcs</span>
      <span style="font-weight:700; color:var(--red-dark);">${money(p.revenue)}</span>
      <span class="share-cell"><div class="share-track"><div class="share-fill" style="width:${p.marketSharePct}%;"></div></div><div class="share-pct">${p.marketSharePct.toFixed(1)}%</div></span>
    </div>
  `).join('') : '<div class="empty-state">No product sales yet</div>';
}
function filterProductLeaderboard() {
  const q = document.getElementById('product-search').value.toLowerCase();
  renderLeaderboard((APP._leaderboard || []).filter(p => p.name.toLowerCase().includes(q)));
}

function renderPromoTable(list) {
  document.getElementById('promo-tbody').innerHTML = list.length ? list.map(t => `
    <tr><td style="font-weight:700;">${escapeHtml(t.number)}</td><td>${escapeHtml(t.phone)}</td><td>${money(t.orderTotal)}</td><td style="color:var(--red); font-weight:700;">-${money(t.discount)}</td>
    <td>
      <div class="order-actions">
        <button class="btn green" title="Send via WhatsApp" onclick="sendWhatsAppForOrder('${t.id}')">💬</button>
        <button class="btn dark" title="Download invoice" onclick="downloadInvoiceForOrder('${t.id}')">⬇</button>
        <button class="btn danger" title="Delete" onclick="deletePromoTransaction('${t.id}')">🗑</button>
      </div>
    </td></tr>
  `).join('') : `<tr><td colspan="5"><div class="empty-state">No discounted orders yet</div></td></tr>`;
}
async function deletePromoTransaction(id) {
  if (!confirm('Are you sure you want to delete this?')) return;
  try {
    await api('/orders/' + id, { method: 'DELETE' });
    showToast('Transaction deleted');
    loadAnalyticsTab();
  } catch (e) { showError(e.message); }
}
function filterPromoTable() {
  const q = document.getElementById('promo-search').value.toLowerCase();
  const filtered = (APP._promoTransactions || []).filter(t =>
    t.number.toLowerCase().includes(q) || (t.phone || '').includes(q) || String(t.discount).includes(q)
  );
  renderPromoTable(filtered);
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
document.getElementById('login-pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

(async function bootstrap() {
  await loadConfig();
  const token = localStorage.getItem('pos_token');
  if (token) showApp();
})();
