const { neon } = require('@neondatabase/serverless');
const buildSeed = require('./seed');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.warn(
    '\n  \u26a0 No DATABASE_URL (or POSTGRES_URL) set. Add a Postgres integration ' +
    '(e.g. Neon, from the Vercel Marketplace) and set the connection string ' +
    'as an environment variable \u2014 the app cannot read or save data until then.\n'
  );
}

const sql = connectionString ? neon(connectionString) : null;

// The whole app's data (products + orders) is kept as a single JSON
// document in one row. This keeps every existing route's logic
// (discount math, invoice numbering, analytics) completely unchanged --
// only this file knows it's talking to Postgres instead of a local file.
let schemaReady = null;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS pos_store (
        key text PRIMARY KEY,
        value jsonb NOT NULL
      )
    `;
  }
  return schemaReady;
}

function requireDb() {
  if (!sql) {
    throw new Error('Database is not configured. Set DATABASE_URL in your environment.');
  }
}

async function load() {
  requireDb();
  await ensureSchema();
  const rows = await sql`SELECT value FROM pos_store WHERE key = 'main'`;
  if (rows.length === 0) {
    const seed = buildSeed();
    await sql`INSERT INTO pos_store (key, value) VALUES ('main', ${JSON.stringify(seed)}::jsonb)`;
    return seed;
  }

  const data = rows[0].value;
  // Older databases were seeded before "categories" existed as its own
  // list — backfill it from whatever products already have, so existing
  // deployments don't need a manual migration.
  if (!Array.isArray(data.categories)) {
    const names = [...new Set((data.products || []).map(p => p.category).filter(Boolean))];
    data.categories = names.map((name, i) => ({ id: 'c-' + i + '-' + name.toLowerCase().replace(/\s+/g, '-'), name }));
    await save(data);
  }
  return data;
}

async function save(data) {
  requireDb();
  await ensureSchema();
  await sql`
    INSERT INTO pos_store (key, value) VALUES ('main', ${JSON.stringify(data)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

module.exports = { load, save };
