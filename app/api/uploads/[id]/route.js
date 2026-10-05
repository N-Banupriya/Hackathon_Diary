import { db } from "@/lib/db";
import { handle, requireRole, HttpError } from "@/lib/auth";
import { removeFile } from "@/lib/storage";

export const DELETE = handle(async (req, { params }) => {
  await requireRole("admin");
  const { id } = await params;
  const p = await db();
  const r = await p.query("DELETE FROM uploads WHERE id = $1 RETURNING file_url", [id]);
  if (!r.rows.length) throw new HttpError(404, "That document was already deleted.");
  await removeFile(r.rows[0].file_url);
  return Response.json({ ok: true });
});
