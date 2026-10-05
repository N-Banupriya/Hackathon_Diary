// One ZIP: an Excel file per hackathon (consolidated + department sheets) and one combined workbook.
import JSZip from "jszip";
import { db } from "@/lib/db";
import { handle, requireRole, HttpError } from "@/lib/auth";
import { buildWorkbook, buildCombinedWorkbook, fileNameFor } from "@/lib/export";

export const maxDuration = 120;

export const GET = handle(async (req) => {
  await requireRole();
  const ids = (new URL(req.url).searchParams.get("ids") || "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 50);
  if (!ids.length) throw new HttpError(400, "Choose at least one hackathon.");
  const p = await db();
  const rows = (await p.query(`SELECT id, title, to_char(deadline,'YYYY-MM-DD') AS deadline, matches, created_at FROM hackathons WHERE id = ANY($1) AND matches IS NOT NULL ORDER BY deadline NULLS LAST, created_at`, [ids])).rows;
  if (!rows.length) throw new HttpError(400, "None of the chosen hackathons has been matched yet.");
  const zip = new JSZip();
  const used = new Set();
  for (const h of rows) {
    let name = fileNameFor(h), k = 2;
    while (used.has(name)) name = fileNameFor(h).replace(/\.xlsx$/, `_${k++}.xlsx`);
    used.add(name);
    zip.file(name, await buildWorkbook(h));
  }
  zip.file("00_All_Hackathons_Combined.xlsx", await buildCombinedWorkbook(rows));
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buf, { headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="Hackathon_Recommendations_${stamp}.zip"`,
    "Cache-Control": "no-store",
  } });
});
