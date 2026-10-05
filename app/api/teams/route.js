import { db } from "@/lib/db";
import { handle, requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const GET = handle(async (req) => {
  await requireRole();
  const sp = new URL(req.url).searchParams;
  const p = await db();
  const r = await p.query(
    `SELECT id, upload_id, batch, year, dept, section, team_no, title, mentor, domain, sector, domain_tags, sector_tags, members
       FROM teams WHERE batch = $1 AND year = $2 ORDER BY dept, section, id`, [sp.get("batch"), sp.get("year")]);
  return Response.json({ teams: r.rows });
});
