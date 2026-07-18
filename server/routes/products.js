const router = require('express').Router();
const { v4: uuid } = require('uuid');
const { load, save } = require('../db');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
  const db = await load();
  res.json(db.products);
}));

router.post('/', asyncHandler(async (req, res) => {
  const db = await load();
  const { name, tamil, category, price } = req.body || {};

  if (!name || price === undefined || price === null || isNaN(Number(price))) {
    return res.status(400).json({ error: 'Product name and a valid price are required.' });
  }

  const product = {
    id: uuid(),
    name: String(name).trim(),
    tamil: tamil ? String(tamil).trim() : '',
    category: category ? String(category).trim() : 'General',
    price: Number(price),
    active: true
  };

  db.products.push(product);
  await save(db);
  res.status(201).json(product);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const db = await load();
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found.' });

  const updates = { ...req.body };
  if (updates.price !== undefined) updates.price = Number(updates.price);

  db.products[idx] = { ...db.products[idx], ...updates };
  await save(db);
  res.json(db.products[idx]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const db = await load();
  const exists = db.products.some(p => p.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Product not found.' });

  db.products = db.products.filter(p => p.id !== req.params.id);
  await save(db);
  res.json({ success: true });
}));

module.exports = router;
