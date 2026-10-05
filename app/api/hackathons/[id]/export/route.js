import { db } from "@/lib/db";
import { handle, requireRole, HttpError } from "@/lib/auth";
import { buildWorkbook } from "@/lib/export";

export const GET = handle(async (req, { params }) => {
  await requireRole();
  const { id } = await params;
  const p = await db();
  const h = (await p.query(`SELECT title, to_char(deadline,'YYYY-MM-DD') AS deadline, matches FROM hackathons WHERE id=$1`, [id])).rows[0];
  if (!h) throw new HttpError(404, "That hackathon was deleted.");
  if (!h.matches) throw new HttpError(400, "Run matching first.");
  const buf = await buildWorkbook(h);
  const name = (h.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Hackathon") + "_Recommendations.xlsx";
  return new Response(buf, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    "Cache-Control": "no-store",
  } });
});
