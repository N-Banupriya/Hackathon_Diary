// Builds the recommendations workbook: a Consolidated sheet plus one sheet per department.
import ExcelJS from "exceljs";
import { batchLabel, SITE } from "./config";

const NAVY = "FF0A2A66", GOLD = "FFF2A900", STRIPE = "FFF3F6FB";
const thin = { style: "thin", color: { argb: "FFB8C3D9" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

function safeSheetName(name, used) {
  let base = String(name || "Other").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Other";
  let n = base, i = 2;
  while (used.has(n.toLowerCase())) n = `${base} ${i++}`;
  used.add(n.toLowerCase());
  return n;
}

function addSheet(wb, sheetName, h, teams, { withDept, withTrack, withSource, subtitle }) {
  const cols = [
    { key: "sno", header: "S.No", width: 6 },
    { key: "fit", header: "Recommendation", width: 15 },
    ...(withSource ? [{ key: "source", header: "Project List", width: 18 }] : []),
    ...(withDept ? [{ key: "dept", header: "Dept", width: 11 }] : []),
    { key: "batch", header: "Batch", width: 10 },
    { key: "year", header: "Year", width: 6 },
    ...(withTrack ? [{ key: "track", header: "Track", width: 28 }] : []),
    { key: "roll", header: "Roll No.", width: 15 },
    { key: "name", header: "Name of the Student", width: 26 },
    { key: "title", header: "Project Title", width: 44 },
    { key: "mentor", header: "Faculty Mentor", width: 26 },
  ];
  const teamKeys = ["sno", "fit", "source", "dept", "batch", "year", "track", "title", "mentor"];
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 3 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printTitlesRow: "3:3" },
  });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const last = cols.length;

  ws.mergeCells(1, 1, 1, last);
  const t = ws.getCell(1, 1);
  t.value = h.title;
  t.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  t.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, last);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF0F1B33" } };
  s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
  s.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getRow(2).height = 20;

  const head = ws.getRow(3);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = border;
  });
  head.height = 22;

  let r = 4;
  teams.forEach((m, ti) => {
    const members = m.members?.length ? m.members : [{ roll: "", name: "" }];
    const start = r;
    const team = { sno: ti + 1, fit: fitLabel(m.fit), source: m.collection || "Design Thinking", dept: `${m.dept || "–"}${m.section ? " - " + m.section : ""}`, batch: m.batch ? batchLabel(m.batch) : "–", year: m.year || "–", track: m.track || "", title: m.title, mentor: m.mentor };
    for (const x of members) {
      const row = ws.getRow(r);
      cols.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        cell.value = c.key === "roll" ? x.roll : c.key === "name" ? x.name : team[c.key];
        cell.alignment = { vertical: "middle", horizontal: ["sno", "fit", "batch", "year", "dept", "roll"].includes(c.key) ? "center" : "left", wrapText: true };
        cell.border = border;
        if (ti % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE } };
        if (c.key === "fit") {
          const strong = team.fit === "Strong";
          cell.font = { bold: true, color: { argb: strong ? "FF137A4B" : "FF9A6200" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: strong ? "FFE1F4EA" : "FFFFF4D6" } };
        }
      });
      r++;
    }
    if (members.length > 1) cols.forEach((c, i) => { if (teamKeys.includes(c.key)) ws.mergeCells(start, i + 1, r - 1, i + 1); });
  });
  if (!teams.length) {
    ws.mergeCells(4, 1, 4, last);
    ws.getCell(4, 1).value = "No recommendations.";
    ws.getCell(4, 1).alignment = { horizontal: "center" };
  }
  return ws;
}

const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const studentsOf = (list) => list.reduce((n, m) => n + (m.members?.length || 0), 0);
const RANK = { strong: 0, medium: 1, possible: 1 };
export const fitLabel = (f) => (f === "strong" ? "Strong" : "Medium");
function prepare(h) {
  const matches = (h.matches || []).filter((m) => m.fit in RANK);
  const sorted = [...matches].sort((a, b) => RANK[a.fit] - RANK[b.fit] || (a.dept || "").localeCompare(b.dept || "") || (a.section || "").localeCompare(b.section || "") || String(a.teamNo).localeCompare(String(b.teamNo), undefined, { numeric: true }));
  return {
    sorted,
    withTrack: sorted.some((m) => String(m.track || "").trim()),
    withSource: sorted.some((m) => m.collection),
    deadline: h.deadline ? ` · Deadline ${fmt(h.deadline)}` : "",
  };
}
const counts = (list) => {
  const st = list.filter((m) => m.fit === "strong").length;
  return `${st} strong + ${list.length - st} medium teams, ${studentsOf(list)} students`;
};
export const fileNameFor = (h) => (String(h.title).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 80) || "Hackathon") + "_Recommendations.xlsx";

// One hackathon: Consolidated sheet + one sheet per department.
export async function buildWorkbook(h) {
  const { sorted, withTrack, withSource, deadline } = prepare(h);
  const when = fmt(Date.now());
  const wb = new ExcelJS.Workbook();
  wb.creator = SITE.copyright;
  wb.created = new Date();
  const used = new Set();
  addSheet(wb, safeSheetName("Consolidated", used), h, sorted, {
    withDept: true, withTrack, withSource,
    subtitle: `Recommendations · All departments · ${counts(sorted)}${deadline} · Generated ${when}`,
  });
  const byDept = new Map();
  for (const m of sorted) { const d = m.dept || "Other"; if (!byDept.has(d)) byDept.set(d, []); byDept.get(d).push(m); }
  for (const [dept, list] of byDept) {
    addSheet(wb, safeSheetName(dept, used), h, list, {
      withDept: false, withTrack, withSource,
      subtitle: `Recommendations · Department of ${dept} · ${counts(list)}${deadline} · Generated ${when}`,
    });
  }
  return wb.xlsx.writeBuffer();
}

// Many hackathons in one workbook: a Summary sheet, then one consolidated sheet per hackathon.
export async function buildCombinedWorkbook(hacks) {
  const when = fmt(Date.now());
  const wb = new ExcelJS.Workbook();
  wb.creator = SITE.copyright;
  wb.created = new Date();
  const used = new Set(["summary"]);
  const sum = wb.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 3 }] });
  sum.columns = [{ width: 6 }, { width: 44 }, { width: 16 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 40 }, { width: 30 }];
  sum.mergeCells(1, 1, 1, 8);
  Object.assign(sum.getCell(1, 1), { value: "Hackathon Recommendations – Summary" });
  sum.getCell(1, 1).font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  sum.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  sum.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
  sum.getRow(1).height = 30;
  sum.mergeCells(2, 1, 2, 8);
  sum.getCell(2, 1).value = `${hacks.length} hackathons · Strong and Medium recommendations · Generated ${when}`;
  sum.getCell(2, 1).font = { size: 10, italic: true };
  sum.getCell(2, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
  sum.getCell(2, 1).alignment = { horizontal: "center" };
  const hdr = ["S.No", "Hackathon", "Deadline", "Strong", "Medium", "Students", "Departments", "Sheet"];
  hdr.forEach((v, i) => { const c = sum.getCell(3, i + 1); c.value = v; c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; c.border = border; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; });

  hacks.forEach((h, i) => {
    const { sorted, withTrack, withSource, deadline } = prepare(h);
    const name = safeSheetName(`${i + 1}. ${h.title}`, used);
    addSheet(wb, name, h, sorted, {
      withDept: true, withTrack, withSource,
      subtitle: `Recommendations · All departments · ${counts(sorted)}${deadline} · Generated ${when}`,
    });
    const r = sum.getRow(4 + i);
    const st = sorted.filter((m) => m.fit === "strong").length;
    const vals = [i + 1, h.title, h.deadline ? fmt(h.deadline) : "–", st, sorted.length - st, studentsOf(sorted), [...new Set(sorted.map((m) => m.dept).filter(Boolean))].sort().join(", ") || "–", name];
    vals.forEach((v, k) => { const c = r.getCell(k + 1); c.value = v; c.border = border; c.alignment = { vertical: "middle", wrapText: true, horizontal: [0, 2, 3, 4, 5].includes(k) ? "center" : "left" }; });
    r.getCell(8).value = { text: name, hyperlink: `#'${name.replace(/'/g, "''")}'!A1` };
    r.getCell(8).font = { color: { argb: "FF123A85" }, underline: true };
  });
  return wb.xlsx.writeBuffer();
}
