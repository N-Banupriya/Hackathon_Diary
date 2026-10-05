import { db } from "@/lib/db";
import { handle, requireRole, HttpError } from "@/lib/auth";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireRole();
  const p = await db();
  const r = await p.query(`
    SELECT c.id, c.name, c.description, c.created_at,
      (SELECT count(*)::int FROM uploads u WHERE u.collection_id = c.id) AS files,
      (SELECT count(*)::int FROM teams t WHERE t.collection_id = c.id) AS teams,
      (SELECT coalesce(sum(jsonb_array_length(members)),0)::int FROM teams t WHERE t.collection_id = c.id) AS students
    FROM collections c ORDER BY c.created_at`);
  return Response.json({ collections: r.rows });
});

export const POST = handle(async (req) => {
  await requireRole("admin");
  const b = await req.json();
  const name = String(b.name || "").trim().slice(0, 120);
  if (!name) throw new HttpError(400, "Give the collection a name, e.g. SIH 2025.");
  const p = await db();
  const dup = await p.query(`SELECT 1 FROM collections WHERE lower(name)=lower($1)`, [name]);
  if (dup.rows.length) throw new HttpError(409, "A collection with that name already exists.");
  const r = await p.query(`INSERT INTO collections (name, description) VALUES ($1,$2) RETURNING id`, [name, String(b.description || "").trim().slice(0, 1000)]);
  return Response.json({ id: r.rows[0].id });
});
