const { v4: uuid } = require('uuid');

function randomInvoiceSuffix() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Builds fresh demo data relative to "now" so the dashboard always has
// something sensible to show the first time the server starts.
function buildSeed() {
  const now = new Date();
  const year = now.getFullYear();

  function hoursAgo(h) {
    return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
  }

  const products = [
    { id: 'p1', name: 'Shirt', tamil: '', category: 'Shirts', price: 799, active: true },
    { id: 'p2', name: 'Linen Shirts', tamil: '', category: 'Shirts', price: 1299, active: true },
    { id: 'p3', name: 'Printed Shirt', tamil: '', category: 'Shirts', price: 899, active: true },
    { id: 'p4', name: 'Pant', tamil: '', category: 'Pants', price: 999, active: true },
    { id: 'p5', name: 'Polo Fit Pant', tamil: '', category: 'Pants', price: 1099, active: true },
    { id: 'p6', name: 'Mom Fit', tamil: '', category: 'Pants', price: 1199, active: true },
    { id: 'p7', name: 'Linen Pant', tamil: '', category: 'Pants', price: 1399, active: true }
  ];

  const usedNumbers = new Set();
  function invNumber() {
    let code;
    do { code = `INV-${year}-${randomInvoiceSuffix()}`; } while (usedNumbers.has(code));
    usedNumbers.add(code);
    return code;
  }

  function order({ hours, customer, phone, items, source, manualDiscountPct, gstPct, delivery, received }) {
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    let running = subtotal;
    let manualDiscount = 0;
    if (manualDiscountPct) {
      manualDiscount = Math.round(running * manualDiscountPct / 100);
      running -= manualDiscount;
    }
    let gstAmt = 0;
    if (gstPct) {
      gstAmt = Math.round(running * gstPct / 100);
    }
    const deliveryAmt = delivery || 0;
    const grandTotal = Math.max(0, running + gstAmt + deliveryAmt);
    const amountReceived = received != null ? received : grandTotal;

    return {
      id: uuid(),
      number: invNumber(),
      date: hoursAgo(hours),
      customer: customer || 'Walk-in Customer',
      phone: phone || '-',
      items,
      source: source || 'offline',
      subtotal,
      manualDiscount,
      gstAmt,
      delivery: deliveryAmt,
      grandTotal,
      paymentMode: 'cash',
      amountReceived,
      balance: amountReceived - grandTotal,
      status: 'Completed'
    };
  }

  const orders = [
    order({ hours: 60, customer: 'Ravi Kumar', phone: '9876543210', source: 'offline',
      items: [{ name: 'Shirt', price: 799, qty: 2 }, { name: 'Pant', price: 999, qty: 1 }] }),
    order({ hours: 50, customer: 'Walk-in Customer', phone: '9840001111', source: 'offline',
      items: [{ name: 'Linen Shirts', price: 1299, qty: 1 }], manualDiscountPct: 10 }),
    order({ hours: 40, customer: 'Suresh', phone: '9944556677', source: 'online',
      items: [{ name: 'Polo Fit Pant', price: 1099, qty: 1 }, { name: 'Printed Shirt', price: 899, qty: 1 }], delivery: 50 }),
    order({ hours: 28, customer: 'Walk-in Customer', phone: '9876501234', source: 'offline',
      items: [{ name: 'Mom Fit', price: 1199, qty: 1 }] }),
    order({ hours: 18, customer: 'Arun', phone: '9003332221', source: 'offline',
      items: [{ name: 'Linen Pant', price: 1399, qty: 1 }, { name: 'Shirt', price: 799, qty: 1 }], gstPct: 5, manualDiscountPct: 5 }),
    order({ hours: 6, customer: 'Walk-in Customer', phone: '9994448880', source: 'offline',
      items: [{ name: 'Shirt', price: 799, qty: 1 }] }),
    order({ hours: 2, customer: 'Priya', phone: '9887766554', source: 'online',
      items: [{ name: 'Printed Shirt', price: 899, qty: 2 }] })
  ];

  return { products, orders };
}

module.exports = buildSeed;
