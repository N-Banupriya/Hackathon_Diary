// File storage: Vercel Blob in production, the local .data folder during development.
import { promises as fs } from "fs";
import path from "path";

export const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
export const blobAccess = () => (process.env.BLOB_ACCESS === "public" ? "public" : "private");
const LOCAL_DIR = path.join(process.cwd(), ".data", "files");

export async function saveLocal(name, buf) {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const id = crypto.randomUUID() + "-" + name.replace(/[^\w.\-]+/g, "_");
  await fs.writeFile(path.join(LOCAL_DIR, id), buf);
  return "local:" + id;
}

export async function openFile(fileUrl) {
  if (fileUrl.startsWith("local:")) {
    const id = path.basename(fileUrl.slice(6));
    const data = await fs.readFile(path.join(LOCAL_DIR, id));
    return { body: data, contentType: null };
  }
  const { get } = await import("@vercel/blob");
  const r = await get(fileUrl, { access: blobAccess() });
  if (!r || r.statusCode !== 200) throw Object.assign(new Error("File not found in storage"), { status: 404 });
  return { body: r.stream, contentType: r.blob.contentType };
}

export async function removeFile(fileUrl) {
  try {
    if (fileUrl.startsWith("local:")) await fs.unlink(path.join(LOCAL_DIR, path.basename(fileUrl.slice(6))));
    else { const { del } = await import("@vercel/blob"); await del(fileUrl); }
  } catch (e) { console.warn("Could not remove file", fileUrl, e.message); }
}
