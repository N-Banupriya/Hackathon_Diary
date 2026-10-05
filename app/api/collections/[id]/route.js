import { db } from "@/lib/db";
import { handle, requireRole, HttpError } from "@/lib/auth";
import { removeFile } from "@/lib/storage";

export const PUT = handle(async (req, { params }) => {
  await requireRole("admin");
  const { id } = await params;
  const b = await req.json();
  const name = String(b.name || "").trim().slice(0, 120);
  if (!name) throw new HttpError(400, "Give the collection a name.");
  const p = await db();
  const r = await p.query(`UPDATE collections SET name=$2, description=$3 WHERE id=$1`, [id, name, String(b.description || "").trim().slice(0, 1000)]);
  if (!r.rowCount) throw new HttpError(404, "That collection was deleted.");
  return Response.json({ ok: true });
});

// Deletes the collection, its documents (files too) and its teams.
export const DELETE = handle(async (req, { params }) => {
  await requireRole("admin");
  const { id } = await params;
  const p = await db();
  const files = (await p.query(`SELECT file_url FROM uploads WHERE collection_id=$1`, [id])).rows;
  await p.query(`DELETE FROM teams WHERE collection_id=$1`, [id]);
  await p.query(`DELETE FROM collections WHERE id=$1`, [id]);
  for (const f of files) await removeFile(f.file_url);
  return Response.json({ ok: true });
});
