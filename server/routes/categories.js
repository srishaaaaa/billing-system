const router = require('express').Router();
const { v4: uuid } = require('uuid');
const { load, save } = require('../db');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
  const db = await load();
  res.json(db.categories || []);
}));

router.post('/', asyncHandler(async (req, res) => {
  const db = await load();
  const { name } = req.body || {};
  const trimmed = name ? String(name).trim() : '';

  if (!trimmed) {
    return res.status(400).json({ error: 'Category name is required.' });
  }
  if ((db.categories || []).some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
    return res.status(400).json({ error: 'That category already exists.' });
  }

  const category = { id: uuid(), name: trimmed };
  db.categories = [...(db.categories || []), category];
  await save(db);
  res.status(201).json(category);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const db = await load();
  const exists = (db.categories || []).some(c => c.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Category not found.' });

  db.categories = db.categories.filter(c => c.id !== req.params.id);
  await save(db);
  res.json({ success: true });
}));

module.exports = router;
