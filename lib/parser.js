// Reads a Design Thinking batch workbook (one sheet per department/section) into project teams.
// Only the columns up to "Sector" are kept.
import { domainTags, sectorTags } from "./taxonomy";

export function parseWorkbook(XLSX, wb) {
  const clean = (v) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());
  const out = [];
  const warnings = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, blankrows: true, raw: true });
    let hdr = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const r = (rows[i] || []).map((c) => clean(c).toLowerCase());
      if (r.some((c) => c.startsWith("roll")) && r.some((c) => c.includes("name"))) { hdr = i; break; }
    }
    if (hdr < 0) continue; // e.g. the "Lists" sheet
    const H = rows[hdr].map((c) => clean(c).toLowerCase());
    const find = (...keys) => H.findIndex((h) => keys.some((k) => h.includes(k)));
    const col = {
      no: find("batch no", "team no", "s.no", "sl"),
      roll: find("roll"),
      name: find("name of the student", "student name", "student"),
      mentor: find("mentor", "faculty", "guide"),
      title: find("project title", "title"),
      domain: find("technology domain", "domain"),
      sector: find("sector"),
    };
    if (col.name < 0) col.name = H.findIndex((h, i) => h.includes("name") && i !== col.mentor);
    const top = rows.slice(0, hdr).map((r) => (r || []).map(clean).join(" ")).join(" | ");
    let dept = "", section = "";
    const dm = top.match(/Department of\s+(.+?)\s*\|/i);
    if (dm) dept = dm[1].trim();
    const sm = top.match(/Section\s*:\s*([A-Z])\b/i);
    if (sm) section = sm[1].toUpperCase();
    const sn = sheetName.match(/^\s*(.+?)\s*[-–]\s*([A-Z])\s*$/);
    if (!dept) dept = sn ? sn[1] : sheetName.trim();
    if (!section && sn) section = sn[2];
    dept = dept.replace(/^Mechanical Engineering$/i, "MECH").replace(/^Cybersecurity$/i, "CYBER");
    const g = (r, k) => (col[k] >= 0 ? clean(r[col[k]]) : "");
    const hasNos = col.no >= 0;
    let cur = null, blanks = 0, count = 0;
    for (let i = hdr + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const roll = g(r, "roll").toUpperCase(), name = g(r, "name");
      const no = g(r, "no"), title = g(r, "title");
      if (!roll && !name && !title && !no) { if (++blanks > 25) break; continue; }
      blanks = 0;
      const startsNew = no || !cur || (!hasNos && title && cur.title);
      if (!startsNew) {
        for (const k of ["title", "mentor", "domain", "sector"]) if (!cur[k]) cur[k] = g(r, k);
      } else {
        count++;
        cur = { dept, section, teamNo: no || String(count), title, mentor: g(r, "mentor"), domain: g(r, "domain"), sector: g(r, "sector"), members: [] };
        out.push(cur);
      }
      if (roll || name) cur.members.push({ roll, name });
    }
  }
  const teams = out.filter((t) => t.members.length || t.title).map((t) => ({ ...t, domainTags: domainTags(t.domain), sectorTags: sectorTags(t.sector) }));
  const noTitle = teams.filter((t) => !t.title).length;
  if (noTitle) warnings.push(`${noTitle} team${noTitle > 1 ? "s have" : " has"} no project title yet`);
  if (!teams.length) warnings.push("No project table found (expected a 'Roll No.' column)");
  return { teams, warnings };
}
