const router = require('express').Router();

// Public (no auth) — the login screen needs the shop name before anyone signs in.
router.get('/', (req, res) => {
  res.json({
    shopName: process.env.SHOP_NAME || "11:11 Men's Wear & Sport's Wear",
    ownerName: process.env.OWNER_NAME || 'VITHYABATHI',
    address: process.env.SHOP_ADDRESS || 'AGS Complex, Near Aavin Palagam, Amarakundhi.',
    footerTagline: process.env.FOOTER_TAGLINE || 'TAILORED. TIMELESS. CRAFTED.',
    poweredByName: process.env.POWERED_BY_NAME || 'CENEXA SYSTEMS',
    poweredByUrl: process.env.POWERED_BY_URL || 'https://www.cenexasystems.com/',
    version: 'V2.1.0 • PREMIUM POS'
  });
});

module.exports = router;
