const router = require('express').Router();
const { load } = require('../db');
const asyncHandler = require('../middleware/asyncHandler');

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
function moneyFull(v) { return '₹' + Number(v || 0).toFixed(2); }

function shopInitials(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function renderInvoicePage(inv, config) {
  const c = config || {};
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

  const body = `
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
    <div style="text-align:center; color:#8a8577; font-size:11.5px; margin-top:22px;">Thank you for shopping with ${escapeHtml(c.shopName || 'us')}!</div>
    <div class="print-btn-wrap no-print"><button onclick="window.print()">⬇ Download / Print as PDF</button></div>
  `;

  const css = `
    body{font-family:Segoe UI,Arial,sans-serif; color:#1a1a1a; max-width:620px; margin:30px auto; padding:0 20px; background:#faf9f5;}
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
    .print-btn-wrap{text-align:center; margin-top:26px;}
    .print-btn-wrap button{background:#a8172f; color:#fff; border:none; padding:12px 22px; border-radius:9px; font-weight:700; font-size:13.5px; cursor:pointer;}
    @media print{ .no-print{display:none;} body{background:#fff;} }
  `;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(inv.number)}</title><style>${css}</style></head><body>${body}</body></html>`;
}

// Public (no auth) — this is a customer-facing link shared over WhatsApp/SMS,
// so it can't require a login. The order UUID itself acts as the access token.
router.get('/:id', asyncHandler(async (req, res) => {
  const db = await load();
  const inv = db.orders.find(o => o.id === req.params.id);
  if (!inv) return res.status(404).send('Invoice not found.');

  const config = {
    shopName: process.env.SHOP_NAME || "11:11 Men's Wear & Sport's Wear",
    address: process.env.SHOP_ADDRESS || 'AGS Complex, Near Aavin Palagam, Amarakundhi.'
  };
  res.setHeader('Content-Type', 'text/html');
  res.send(renderInvoicePage(inv, config));
}));

module.exports = router;
