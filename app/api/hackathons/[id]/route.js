import { db } from "@/lib/db";
import { handle, requireRole, HttpError } from "@/lib/auth";
import { cleanHack } from "@/lib/hack";

export const PUT = handle(async (req, { params }) => {
  await requireRole("admin", "staff");
  const { id } = await params;
  const h = cleanHack(await req.json());
  const p = await db();
  const r = await p.query(`UPDATE hackathons SET title=$2, link=$3, description=$4, batches=$5, years=$6, deadline=$7, collections=$8, scope_all=$9 WHERE id=$1`,
    [id, h.title, h.link, h.description, JSON.stringify(h.batches), JSON.stringify(h.years), h.deadline, JSON.stringify(h.collections), h.scopeAll]);
  if (!r.rowCount) throw new HttpError(404, "That hackathon was deleted.");
  return Response.json({ ok: true });
});

export const DELETE = handle(async (req, { params }) => {
  await requireRole("admin");
  const { id } = await params;
  const p = await db();
  await p.query(`DELETE FROM hackathons WHERE id=$1`, [id]);
  return Response.json({ ok: true });
});
