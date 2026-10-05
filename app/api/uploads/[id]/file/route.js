import { db } from "@/lib/db";
import { handle, requireRole, HttpError } from "@/lib/auth";
import { openFile } from "@/lib/storage";

const TYPES = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };

export const GET = handle(async (req, { params }) => {
  await requireRole();
  const { id } = await params;
  const p = await db();
  const r = await p.query("SELECT file_name, file_url FROM uploads WHERE id = $1", [id]);
  if (!r.rows.length) throw new HttpError(404, "Document not found.");
  const { file_name, file_url } = r.rows[0];
  const f = await openFile(file_url);
  const ext = file_name.split(".").pop().toLowerCase();
  return new Response(f.body, { headers: {
    "Content-Type": TYPES[ext] || f.contentType || "application/octet-stream",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file_name)}`,
    "Cache-Control": "private, no-store",
  } });
});
