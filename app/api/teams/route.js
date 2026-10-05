import { db } from "@/lib/db";
import { handle, requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
const COLS = "id, upload_id, collection_id, batch, year, dept, section, team_no, title, mentor, domain, sector, domain_tags, sector_tags, members, extra";
export const GET = handle(async (req) => {
  await requireRole();
  const sp = new URL(req.url).searchParams;
  const p = await db();
  const r = sp.get("collection")
    ? await p.query(`SELECT ${COLS} FROM teams WHERE collection_id = $1 ORDER BY dept, section, id`, [sp.get("collection")])
    : await p.query(`SELECT ${COLS} FROM teams WHERE collection_id IS NULL AND batch = $1 AND year = $2 ORDER BY dept, section, id`, [sp.get("batch"), sp.get("year")]);
  return Response.json({ teams: r.rows });
});
