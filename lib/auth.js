import { cookies } from "next/headers";
import { COOKIE, verify } from "./session";

export async function getSession() {
  const store = await cookies();
  return verify(store.get(COOKIE)?.value);
}

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export async function requireRole(...roles) {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Please sign in again.");
  if (roles.length && !roles.includes(s.role)) throw new HttpError(403, "Only the portal admin can do this.");
  return s;
}

export function handle(fn) {
  return async (req, ctx) => {
    try { return await fn(req, ctx); }
    catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(e);
      return Response.json({ error: status === 500 ? explain(e) : e.message }, { status });
    }
  };
}

// Turns setup problems into messages that say what to fix (never includes passwords or addresses).
export function explain(e) {
  if (e?.setup) return e.message;
  const code = e?.code || "";
  if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN", "ECONNRESET"].includes(code) || /timeout|terminated|connect/i.test(e?.message || ""))
    return `Could not reach the database (${code || "connection failed"}). In Vercel, check Storage → the Neon database is connected to this project, then Redeploy. Open /api/health for a full check.`;
  if (code === "28P01" || code === "28000") return "The database rejected the login. Reconnect the Neon database to this project in Vercel → Storage, then Redeploy.";
  if (code === "3D000") return "The database named in the connection address does not exist. Reconnect the Neon database in Vercel → Storage.";
  if (/blob/i.test(e?.name || "") || /blob/i.test(e?.message || "")) return `File storage problem: ${e.message}. Check that the Blob store is connected and BLOB_ACCESS matches it (private or public), then Redeploy.`;
  if (/SESSION_SECRET/.test(e?.message || "")) return e.message;
  return `Something went wrong on the server (${(e?.message || "unknown error").slice(0, 160)}). Open /api/health to check the setup.`;
}
