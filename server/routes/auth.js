const router = require('express').Router();
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const staffPw = process.env.STAFF_PASSWORD || 'Staff@123';
  const adminPw = process.env.ADMIN_PASSWORD || 'Admin@123';

  if (!password) {
    return res.status(400).json({ error: 'Please enter a password.' });
  }

  let role = null;
  if (password === adminPw) role = 'admin';
  else if (password === staffPw) role = 'staff';

  if (!role) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  }

  const token = jwt.sign({ role }, SECRET, { expiresIn: '12h' });
  res.json({ token, role });
});

module.exports = router;
