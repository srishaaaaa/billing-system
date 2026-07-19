require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./server/routes/auth');
const configRoutes = require('./server/routes/config');
const healthRoutes = require('./server/routes/health');
const productRoutes = require('./server/routes/products');
const categoryRoutes = require('./server/routes/categories');
const orderRoutes = require('./server/routes/orders');
const analyticsRoutes = require('./server/routes/analytics');
const { requireAuth, requireAdmin } = require('./server/middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Public — needed before anyone signs in, and for diagnosing deployment issues.
app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/health', healthRoutes);

// Any signed-in role (staff or admin). orders.js applies its own
// admin-only checks internally for the history/reporting endpoints.
app.use('/api/products', requireAuth, productRoutes);
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/orders', requireAuth, orderRoutes);

// Admin only.
app.use('/api/analytics', requireAdmin, analyticsRoutes);

// Local-dev convenience only. On Vercel, everything in /public is served
// directly by the CDN and never reaches this function — see README.
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Keep this last so it can catch errors from any route above. Express 4
// won't auto-catch rejected promises, which is why every async route
// handler is wrapped with asyncHandler — this is the final backstop.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 4000;

// On Vercel, this file is imported (not run directly), so app.listen()
// never executes there — Vercel's runtime calls the exported app itself.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ${process.env.SHOP_NAME || "11:11 Men's Wear & Sport's Wear"} POS running at http://localhost:${PORT}`);
    console.log(`  Staff password: ${process.env.STAFF_PASSWORD || 'Staff@123'}`);
    console.log(`  Admin password: ${process.env.ADMIN_PASSWORD || 'Admin@123'}\n`);
  });
}

module.exports = app;
