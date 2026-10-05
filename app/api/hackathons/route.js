import { db } from "@/lib/db";
import { handle, requireRole } from "@/lib/auth";
import { cleanHack } from "@/lib/hack";
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireRole();
  const p = await db();
  const r = await p.query(`SELECT *, to_char(deadline,'YYYY-MM-DD') AS deadline FROM hackathons ORDER BY created_at DESC`);
  return Response.json({ hackathons: r.rows });
});

export const POST = handle(async (req) => {
  const s = await requireRole("admin", "staff");
  const h = cleanHack(await req.json());
  const p = await db();
  const r = await p.query(`INSERT INTO hackathons (title, link, description, batches, years, collections, scope_all, deadline, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [h.title, h.link, h.description, JSON.stringify(h.batches), JSON.stringify(h.years), JSON.stringify(h.collections), h.scopeAll, h.deadline, s.role]);
  return Response.json({ id: r.rows[0].id });
});
