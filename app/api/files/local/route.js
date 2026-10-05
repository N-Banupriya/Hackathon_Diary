// Development-only file store, used when BLOB_READ_WRITE_TOKEN is not set.
import { handle, requireRole, HttpError } from "@/lib/auth";
import { saveLocal, useBlob } from "@/lib/storage";

export const POST = handle(async (req) => {
  await requireRole("admin");
  if (useBlob()) throw new HttpError(400, "Uploads go to Vercel Blob on this deployment.");
  const form = await req.formData();
  const f = form.get("file");
  if (!f || typeof f === "string") throw new HttpError(400, "No file received.");
  const url = await saveLocal(f.name, Buffer.from(await f.arrayBuffer()));
  return Response.json({ url });
});
