const router = require('express').Router();
const { load } = require('../db');
const asyncHandler = require('../middleware/asyncHandler');

function filterOrders(orders, period, from, to) {
  const now = new Date();
  let start = null;
  let end = null;

  if (period === 'today') {
    start = new Date(now); start.setHours(0, 0, 0, 0);
    end = new Date(now); end.setHours(23, 59, 59, 999);
  } else if (period === 'week') {
    start = new Date(now); start.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    start = new Date(now); start.setDate(now.getDate() - 30);
  } else if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
  }
  if (from) start = new Date(from);
  if (to) { end = new Date(to); end.setHours(23, 59, 59, 999); }

  return orders.filter(o => {
    const d = new Date(o.date);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function monthlyTrend(orders, year) {
  const labels = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const totals = new Array(12).fill(0);
  orders.forEach(o => {
    const d = new Date(o.date);
    if (d.getFullYear() === year) totals[d.getMonth()] += o.grandTotal;
  });
  return labels.map((label, i) => ({ label, value: totals[i] }));
}

function weeklyTrend(orders) {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now); monday.setDate(now.getDate() + diffToMonday); monday.setHours(0, 0, 0, 0);
  const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const totals = new Array(7).fill(0);
  orders.forEach(o => {
    const d = new Date(o.date);
    const diffDays = Math.floor((d - monday) / 86400000);
    if (diffDays >= 0 && diffDays < 7) totals[diffDays] += o.grandTotal;
  });
  return labels.map((label, i) => ({ label, value: totals[i] }));
}

router.get('/revenue', asyncHandler(async (req, res) => {
  const db = await load();
  const { period, from, to } = req.query;
  const now = new Date();
  const orders = filterOrders(db.orders.filter(o => o.status === 'Completed'), period, from, to);

  const totalRevenue = orders.reduce((s, o) => s + o.grandTotal, 0);
  const offline = orders.filter(o => o.source === 'offline');
  const online = orders.filter(o => o.source === 'online');
  const totalItems = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);

  const itemRevenue = {};
  const itemQty = {};
  orders.forEach(o => o.items.forEach(i => {
    itemRevenue[i.name] = (itemRevenue[i.name] || 0) + i.price * i.qty;
    itemQty[i.name] = (itemQty[i.name] || 0) + i.qty;
  }));
  const rankedItems = Object.entries(itemRevenue).sort((a, b) => b[1] - a[1]);
  const maxItemRevenue = rankedItems.length ? rankedItems[0][1] : 1;
  const topItemsByRevenue = rankedItems.slice(0, 5).map(([name, revenue]) => ({
    name, revenue, qty: itemQty[name], pct: Math.round(revenue / maxItemRevenue * 100)
  }));

  res.json({
    totalRevenue,
    completedBills: orders.length,
    offlineTotal: offline.reduce((s, o) => s + o.grandTotal, 0),
    offlineCount: offline.length,
    onlineTotal: online.reduce((s, o) => s + o.grandTotal, 0),
    onlineCount: online.length,
    totalItemsSold: totalItems,
    avgOrderValue: orders.length ? totalRevenue / orders.length : 0,
    topProduct: rankedItems.length ? rankedItems[0][0] : '-',
    year: now.getFullYear(),
    week: getISOWeek(now),
    monthlyTrend: monthlyTrend(orders, now.getFullYear()),
    weeklyTrend: weeklyTrend(orders),
    topItemsByRevenue
  });
}));

router.get('/today', asyncHandler(async (req, res) => {
  const db = await load();
  const orders = filterOrders(db.orders.filter(o => o.status === 'Completed'), 'today');

  const revenue = orders.reduce((s, o) => s + o.grandTotal, 0);
  const items = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
  const offline = orders.filter(o => o.source === 'offline');
  const online = orders.filter(o => o.source === 'online');

  const itemMap = {};
  orders.forEach(o => o.items.forEach(i => {
    itemMap[i.name] = itemMap[i.name] || { qty: 0, revenue: 0 };
    itemMap[i.name].qty += i.qty;
    itemMap[i.name].revenue += i.qty * i.price;
  }));
  const topItems = Object.entries(itemMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5).map(([name, v]) => ({ name, ...v }));

  const transactions = orders
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(o => ({
      id: o.id, number: o.number, customer: o.customer, phone: o.phone, source: o.source,
      itemsCount: o.items.reduce((a, i) => a + i.qty, 0), grandTotal: o.grandTotal
    }));

  res.json({
    revenue,
    bills: orders.length,
    itemsSold: items,
    avgOrderValue: orders.length ? revenue / orders.length : 0,
    channelSplit: {
      offline: offline.reduce((s, o) => s + o.grandTotal, 0),
      online: online.reduce((s, o) => s + o.grandTotal, 0)
    },
    topItems,
    transactions
  });
}));

router.get('/products', asyncHandler(async (req, res) => {
  const db = await load();
  const { period, from, to } = req.query;
  const orders = filterOrders(db.orders.filter(o => o.status === 'Completed'), period, from, to);

  const totalRevenueAll = orders.reduce((s, o) => s + o.grandTotal, 0);
  const itemMap = {};
  orders.forEach(o => o.items.forEach(i => {
    itemMap[i.name] = itemMap[i.name] || { qty: 0, revenue: 0 };
    itemMap[i.name].qty += i.qty;
    itemMap[i.name].revenue += i.qty * i.price;
  }));

  const leaderboard = Object.entries(itemMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, v], idx) => ({
      rank: idx + 1,
      name,
      qty: v.qty,
      revenue: v.revenue,
      marketSharePct: totalRevenueAll ? (v.revenue / totalRevenueAll * 100) : 0
    }));

  res.json({ leaderboard });
}));

router.get('/discounts', asyncHandler(async (req, res) => {
  const db = await load();
  const { period, from, to } = req.query;
  const orders = filterOrders(db.orders.filter(o => o.status === 'Completed'), period, from, to);
  const discounted = orders.filter(o => o.manualDiscount > 0);

  const totalDiscountsGiven = discounted.reduce((s, o) => s + o.manualDiscount, 0);

  res.json({
    totalDiscountsGiven,
    discountedOrders: discounted.length,
    avgDiscountPerOrder: discounted.length ? totalDiscountsGiven / discounted.length : 0,
    transactions: discounted
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(o => ({ id: o.id, number: o.number, phone: o.phone, orderTotal: o.grandTotal, discount: o.manualDiscount }))
  });
}));

module.exports = router;
