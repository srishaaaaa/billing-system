const router = require('express').Router();
const { load } = require('../db');

// Public, no auth — visit /api/health directly in the browser after
// deploying to check whether the database is actually reachable.
router.get('/', async (req, res) => {
  const hasConnectionString = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);

  if (!hasConnectionString) {
    return res.status(500).json({
      status: 'error',
      database: 'not configured',
      message: 'No DATABASE_URL (or POSTGRES_URL) environment variable is set.'
    });
  }

  try {
    const db = await load();
    res.json({
      status: 'ok',
      database: 'connected',
      products: db.products.length,
      orders: db.orders.length
    });
  } catch (e) {
    res.status(500).json({
      status: 'error',
      database: 'connection failed',
      message: e.message
    });
  }
});

module.exports = router;
