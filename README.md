# 11:11 Men's Wear & Sport's Wear — POS Billing System

A role-based POS system: staff can only bill sales, admins can also see
order history and analytics. Express backend, Postgres storage (works on
Vercel), unique invoice numbers, a men's-wear catalogue, and a
mobile-friendly layout that doesn't overlap on phones.

## Local setup

**Requirements:** [Node.js](https://nodejs.org) 20 or newer, and a Postgres
database (see "Getting a database" below -- a free Neon database takes
about a minute to create and works both locally and on Vercel).

```bash
cd pos-system
npm install
cp .env.example .env      # then paste your DATABASE_URL into it
npm start
```

Open **http://localhost:4000**.

- **Staff password:** `Staff@123` -> sees only the Billing Panel
- **Admin password:** `Admin@123` -> sees Billing Panel, Order History, and Analytics Dashboard

Change either password any time in `.env` (`STAFF_PASSWORD`, `ADMIN_PASSWORD`).

For auto-restart while editing:
```bash
npm run dev
```

## Getting a database

The app needs one Postgres database. **Neon** has a free tier and is the
option Vercel recommends:

1. Go to [neon.tech](https://neon.tech) -> sign up -> **Create a project**.
2. On the project dashboard, click **Connect** and copy the connection
   string (starts with `postgres://...`).
3. Paste it into `.env` as `DATABASE_URL=...` for local development.

You don't need to create any tables yourself -- the app creates the one
table it needs automatically the first time it runs.

## Deploying to Vercel

**1. Push this project to a GitHub repository.**
```bash
cd pos-system
git init
git add .
git commit -m "Initial commit"
```
Create a new repo on GitHub, then follow GitHub's instructions to push
(`git remote add origin ...` and `git push -u origin main`).

**2. Import the project into Vercel.**
- Go to [vercel.com/new](https://vercel.com/new) and sign in.
- Select **Import** next to your GitHub repo.
- Vercel auto-detects this as an Express app -- you don't need to change
  any build/output settings.

**3. Add a Postgres database from the Vercel Marketplace.**
- In your new Vercel project, go to the **Storage** tab.
- Click **Create Database** (or **Marketplace Database Integrations**) ->
  choose **Neon** (or Supabase -- either works).
- Follow the prompts. Vercel automatically creates a `DATABASE_URL`
  environment variable in your project pointing at the new database -- you
  don't need to copy/paste anything yourself for this step.
- *(If you already made a Neon database yourself in the step above, you
  can instead just add `DATABASE_URL` manually in Project Settings ->
  Environment Variables, using the connection string you copied.)*

**4. Add the rest of the environment variables.**
In **Project Settings -> Environment Variables**, add these (same names and
values as your `.env.example`, but pick real values for the passwords and
secret):

| Name | Example value |
|---|---|
| `STAFF_PASSWORD` | `Staff@123` |
| `ADMIN_PASSWORD` | `Admin@123` |
| `JWT_SECRET` | any long random string |
| `SHOP_NAME` | `11:11 Men's Wear & Sport's Wear` |
| `OWNER_NAME` | `VITHYABATHI` |
| `SHOP_ADDRESS` | `AGS Complex, Near Aavin Palagam, Amarakundhi.` |
| `FOOTER_TAGLINE` | `TAILORED. TIMELESS. CRAFTED.` |
| `POWERED_BY_NAME` | `CENEXA SYSTEMS` |
| `POWERED_BY_URL` | `https://www.cenexasystems.com/` |

Apply them to all three environments (Production, Preview, Development)
unless you want different passwords per environment.

**5. Deploy.**
- Click **Deploy**. Vercel builds and gives you a live URL
  (`your-project.vercel.app`).
- Every future `git push` to your main branch redeploys automatically.

**6. (Optional) Use a custom domain.**
Project Settings -> Domains -> add your own domain and follow Vercel's DNS
instructions.

That's it -- no `vercel.json` needed, and no code changes required beyond
what's already in this project.

### Why this needed a database at all

Vercel runs your backend as on-demand serverless functions rather than one
constantly-running server, so there's no persistent disk to keep a data
file on -- anything written to disk can disappear on the very next request
or on your next deploy. Every order, product, and invoice number now
lives in Postgres instead, which is exactly what's designed to persist
across serverless requests. Locally, `npm start` talks to the same
database over the internet, so your laptop and your live site always see
the same data.

## What's different from the previous version

- **Two separate logins.** One password field on the login screen; the
  server checks it against `STAFF_PASSWORD` or `ADMIN_PASSWORD` and issues
  a session for that role. Staff only ever see the Billing Panel + Log Out.
  Admins get Billing Panel, Order History, Analytics Dashboard, Log Out.
- **Men's-wear catalogue.** Shirt, Linen Shirts, Printed Shirt, Pant, Polo
  Fit Pant, Mom Fit, Linen Pant -- seeded with starter prices you can edit
  any time from the Billing Panel.
- **Unique invoice numbers.** Each sale gets `INV-<year>-XXXXX` with a
  random 5-character code, checked against every existing invoice.
- **No predefined coupon codes.** The Billing Panel has a Manual Discount
  field (Rs. or %); whatever's typed in during a sale shows up under
  **Analytics Dashboard -> Coupons** as "Promo Campaign Performance" -- a
  report of discounts actually given, not something created from that page.
- **Mobile-friendly.** Sidebar becomes a slide-in drawer under ~900px,
  Order History switches from a table to stacked cards under ~700px, and
  everything collapses gracefully down to a 360px-wide screen.
- **Branding from environment variables**, not hardcoded in the code --
  shop name, owner, address, and footer all come from the environment
  variables above.
- **"Powered by Cenexa Systems"** in the footer links to
  https://www.cenexasystems.com/ in a new tab.
- **Postgres storage** (this update) -- required for Vercel; see above.

## Project structure

```
pos-system/
|-- index.js               App entry point (Vercel requires this at the root)
|-- server/
|   |-- db.js               Postgres data layer (Neon serverless driver)
|   |-- seed.js              Demo catalogue + a few sample orders, used once
|   |                        the first time the database is empty
|   |-- middleware/
|   |   |-- auth.js          requireAuth (any role) / requireAdmin (admin only)
|   |   `-- asyncHandler.js  Wraps async routes so errors don't crash the app
|   `-- routes/
|       |-- auth.js          POST /api/auth/login (role-based)
|       |-- config.js        GET  /api/config (public -- shop branding)
|       |-- products.js      /api/products (staff + admin)
|       |-- orders.js        POST checkout (staff+admin); history/export (admin only)
|       `-- analytics.js     /api/analytics/* (admin only)
|-- public/                 Plain HTML/CSS/JS frontend -- served directly by
|   |-- index.html           Vercel's CDN in production (no build step)
|   |-- styles.css
|   `-- app.js
|-- package.json
`-- .env.example
```

## How billing works

Each item row in the Order Items list has its own **CATALOGUE** button --
tap it to pick a menswear item and auto-fill the name and price, or just
type a custom description directly into the row for one-off items. "Add
Custom Item" adds another blank row; "Add to Catalogue" opens the same
picker to manage your product list without it landing in the current sale.

Completing a sale ("Send Bill via WhatsApp") saves the order with a unique
invoice number, shows the invoice preview, and opens WhatsApp with the
bill pre-filled -- the customer still taps send on their end (true
auto-send needs the paid WhatsApp Business API).

## Notes on scope

- **"Download" on an invoice** saves a print-ready HTML file, not a binary
  PDF -- open it and use your browser's Print -> Save as PDF for an actual
  PDF file.
- **Concurrent writes**: the whole app's data is stored as one JSON
  document in a single database row, which keeps all the business logic
  simple but means two sales completed at the *exact* same instant could
  in theory overwrite each other. For a single shop with a handful of
  staff terminals this is extremely unlikely to matter in practice; if you
  later need guaranteed-safe concurrent writes at higher volume, the fix
  is to split `pos_store` into real `products` / `orders` tables -- ask and
  I can do that migration too.
- Forgot a password? Check/update it in your environment variables
  (`.env` locally, or Vercel Project Settings in production).
- Want to reset all data? Delete the row in your `pos_store` table (or
  drop the table) -- a fresh demo database is generated automatically the
  next time the app starts.
