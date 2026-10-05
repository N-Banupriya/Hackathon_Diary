// Adds many hackathons at once (rows read from the Excel template in the browser).
import { db } from "@/lib/db";
import { handle, requireRole, HttpError } from "@/lib/auth";
import { cleanHack } from "@/lib/hack";
import { BATCHES, YEARS, currentYearOf } from "@/lib/config";

const norm = (s) => String(s || "").replace(/[–—]/g, "-").replace(/\s+/g, "");
function parseBatches(v) {
  if (!String(v || "").trim()) return BATCHES.filter((b) => currentYearOf(b));
  const out = [];
  for (const part of String(v).split(/[,;/]+/)) {
    const p = norm(part); if (!p) continue;
    const m = p.match(/^(20)?(\d\d)-(20)?(\d\d)$/);
    const full = m ? `20${m[2]}-20${m[4]}` : p;
    if (BATCHES.includes(full)) out.push(full);
  }
  return [...new Set(out)];
}
function parseYears(v) {
  if (!String(v || "").trim()) return ["II", "III", "IV"];
  const map = { "1": "I", "2": "II", "3": "III", "4": "IV" };
  const out = String(v).toUpperCase().split(/[,;/\s]+/).map((x) => map[x] || x.replace(/YEAR/, "")).filter((x) => YEARS.includes(x));
  return [...new Set(out)];
}

export const POST = handle(async (req) => {
  const s = await requireRole("admin", "staff");
  const { items } = await req.json();
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, "No hackathons found in the file.");
  if (items.length > 50) throw new HttpError(400, "Add at most 50 hackathons at a time.");
  const ok = [], errors = [];
  items.forEach((it, i) => {
    try {
      ok.push(cleanHack({ title: it.title, link: it.link, deadline: it.deadline, description: it.description, batches: parseBatches(it.batches), years: parseYears(it.years) }));
    } catch (e) { errors.push({ row: it.row ?? i + 2, title: it.title || "", error: e.message }); }
  });
  if (errors.length) return Response.json({ added: 0, errors }, { status: 400 });
  const p = await db();
  const c = await p.connect();
  const ids = [];
  try {
    await c.query("BEGIN");
    for (const h of ok) {
      const r = await c.query(`INSERT INTO hackathons (title, link, description, batches, years, deadline, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [h.title, h.link, h.description, JSON.stringify(h.batches), JSON.stringify(h.years), h.deadline, s.role]);
      ids.push(r.rows[0].id);
    }
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
  return Response.json({ added: ids.length, ids });
});
