import pg from "pg";

let pool;
let ready;

export class SetupError extends Error { constructor(m) { super(m); this.setup = true; } }

// Finds the Postgres address whatever name the Vercel integration gave it.
export function findDbUrl() {
  const names = ["DATABASE_URL", "POSTGRES_URL", "DATABASE_POSTGRES_URL", "STORAGE_URL", "STORAGE_DATABASE_URL", "NEON_DATABASE_URL", "DATABASE_DATABASE_URL"];
  for (const n of names) if (/^postgres(ql)?:\/\//.test(process.env[n] || "")) return { name: n, url: process.env[n] };
  for (const [n, v] of Object.entries(process.env)) if (/_URL$/.test(n) && !/UNPOOLED|NON_POOLING/.test(n) && /^postgres(ql)?:\/\//.test(v || "")) return { name: n, url: v };
  return null;
}

export function getPool() {
  if (!pool) {
    const found = findDbUrl();
    if (!found) throw new SetupError("The database is not connected. In Vercel, open Storage, connect the Neon database to this project, then Redeploy.");
    const local = /localhost|127\.0\.0\.1|\/var\/run/.test(found.url);
    // Remove sslmode from the address so the ssl setting below is used as written.
    const url = found.url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
    pool = new pg.Pool({ connectionString: url, max: 5, ssl: local ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  }
  return pool;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch text NOT NULL,
  year text NOT NULL,
  file_name text NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  content_type text,
  file_url text NOT NULL,
  team_count integer NOT NULL DEFAULT 0,
  student_count integer NOT NULL DEFAULT 0,
  warnings jsonb NOT NULL DEFAULT '[]',
  uploaded_by text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uploads_slot ON uploads (batch, year);

CREATE TABLE IF NOT EXISTS teams (
  id bigserial PRIMARY KEY,
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  batch text NOT NULL,
  year text NOT NULL,
  dept text,
  section text,
  team_no text,
  title text,
  mentor text,
  domain text,
  sector text,
  domain_tags jsonb NOT NULL DEFAULT '[]',
  sector_tags jsonb NOT NULL DEFAULT '[]',
  members jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS teams_slot ON teams (batch, year);

CREATE TABLE IF NOT EXISTS hackathons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  link text,
  deadline date,
  description text,
  batches jsonb NOT NULL DEFAULT '[]',
  years jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  matches jsonb,
  themes jsonb,
  summary text,
  matched_at timestamptz,
  matched_with text,
  scanned integer
);
`;

export async function db() {
  const p = getPool();
  if (!ready) ready = p.query(SCHEMA).catch((e) => { ready = null; throw e; });
  await ready;
  return p;
}
