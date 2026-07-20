const router = require('express').Router();
const { v4: uuid } = require('uuid');
const { load, save } = require('../db');
const { adminOnly } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

function inRange(dateStr, from, to) {
  const d = new Date(dateStr);
  if (from && d < new Date(from)) return false;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (d > end) return false;
  }
  return true;
}

function generateInvoiceNumber(db) {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const existing = new Set(db.orders.map(o => o.number));
  let number;
  do {
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    number = `INV-${year}-${code}`;
  } while (existing.has(number));
  return number;
}

/* ---- Read/manage history — admin only ---- */

router.get('/', adminOnly, asyncHandler(async (req, res) => {
  const db = await load();
  let orders = [...db.orders];
  const { source, from, to, orderId, customer, phone } = req.query;

  if (source && source !== 'all') orders = orders.filter(o => o.source === source);
  if (from || to) orders = orders.filter(o => inRange(o.date, from, to));
  if (orderId) orders = orders.filter(o => o.number.toLowerCase().includes(String(orderId).toLowerCase()));
  if (customer) orders = orders.filter(o => o.customer.toLowerCase().includes(String(customer).toLowerCase()));
  if (phone) orders = orders.filter(o => (o.phone || '').includes(String(phone)));

  orders.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(orders);
}));

router.get('/export', adminOnly, asyncHandler(async (req, res) => {
  const db = await load();
  const rows = [['Order ID', 'Customer Name', 'Mobile Number', 'Source', 'Discount', 'Delivery', 'Total Due', 'Date', 'Status']];

  [...db.orders].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(o => {
    rows.push([
      o.number, o.customer, o.phone, o.source,
      o.manualDiscount ? o.manualDiscount.toFixed(2) : '-', o.delivery || 0,
      o.grandTotal.toFixed(2), new Date(o.date).toLocaleDateString('en-GB'), o.status
    ]);
  });

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="order-history.csv"');
  res.send(csv);
}));

router.get('/:id', adminOnly, asyncHandler(async (req, res) => {
  const db = await load();
  const order = db.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json(order);
}));

router.put('/:id/status', adminOnly, asyncHandler(async (req, res) => {
  const db = await load();
  const idx = db.orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found.' });

  const allowed = ['Completed', 'Pending', 'Cancelled'];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ error: 'Status must be one of: ' + allowed.join(', ') });
  }
  db.orders[idx].status = req.body.status;
  await save(db);
  res.json(db.orders[idx]);
}));

router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  const db = await load();
  const exists = db.orders.some(o => o.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Order not found.' });

  db.orders = db.orders.filter(o => o.id !== req.params.id);
  await save(db);
  res.json({ success: true });
}));

/* ---- Checkout — staff and admin ---- */

router.post('/', asyncHandler(async (req, res) => {
  const db = await load();
  const {
    customer, phone, items, source,
    discountType, discountValue, gstEnabled, gstPct,
    delivery, paymentMode, amountReceived
  } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must include at least one item.' });
  }
  if (!customer || !customer.trim()) {
    return res.status(400).json({ error: 'Customer name is required.' });
  }
  if (!phone || !/^\d{10}$/.test(String(phone).trim())) {
    return res.status(400).json({ error: 'A valid 10-digit mobile number is required.' });
  }
  for (const it of items) {
    if (!it.name || isNaN(Number(it.price)) || isNaN(Number(it.qty)) || Number(it.qty) <= 0 || Number(it.price) <= 0) {
      return res.status(400).json({ error: 'Each item needs a name, a price above zero, and a quantity.' });
    }
  }

  const subtotal = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  let running = subtotal;

  let manualDiscount = 0;
  const dVal = Number(discountValue) || 0;
  if (dVal > 0) {
    manualDiscount = discountType === 'flat' ? dVal : running * dVal / 100;
    manualDiscount = Math.min(manualDiscount, running);
    running -= manualDiscount;
  }

  let gstAmt = 0;
  if (gstEnabled) {
    gstAmt = running * (Number(gstPct) || 0) / 100;
  }

  const deliveryAmt = Number(delivery) || 0;
  const grandTotal = Math.max(0, running + gstAmt + deliveryAmt);
  const received = Number(amountReceived) || 0;

  const order = {
    id: uuid(),
    number: generateInvoiceNumber(db),
    date: new Date().toISOString(),
    customer: customer && customer.trim() ? customer.trim() : 'Walk-in Customer',
    phone: phone && phone.trim() ? phone.trim() : '-',
    items: items.map(it => ({ name: it.name, price: Number(it.price), qty: Number(it.qty) })),
    source: source || 'offline',
    subtotal, manualDiscount, gstAmt, delivery: deliveryAmt, grandTotal,
    paymentMode: paymentMode || 'cash',
    amountReceived: received,
    balance: received - grandTotal,
    status: 'Completed',
    createdByRole: req.auth ? req.auth.role : 'staff'
  };

  db.orders.push(order);
  await save(db);
  res.status(201).json(order);
}));

module.exports = router;
