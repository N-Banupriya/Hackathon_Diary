import { db } from "@/lib/db";
import { handle, requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const GET = handle(async () => {
  await requireRole();
  const p = await db();
  const [u, t, h] = await Promise.all([
    p.query(`SELECT id, batch, year, file_name, size_bytes, content_type, team_count, student_count, warnings, uploaded_at FROM uploads ORDER BY uploaded_at`),
    p.query(`SELECT count(*)::int AS teams, coalesce(sum(jsonb_array_length(members)),0)::int AS students, count(DISTINCT dept)::int AS depts FROM teams`),
    p.query(`SELECT count(*)::int AS n FROM hackathons`),
  ]);
  return Response.json({ uploads: u.rows, totals: { ...t.rows[0], hackathons: h.rows[0].n } });
});
