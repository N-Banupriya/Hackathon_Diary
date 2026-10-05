// Excel template for adding many hackathons at once.
import ExcelJS from "exceljs";
import { handle, requireRole } from "@/lib/auth";
import { BATCHES } from "@/lib/config";

export const GET = handle(async () => {
  await requireRole();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Hackathons", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Hackathon Name", key: "title", width: 34 },
    { header: "Link", key: "link", width: 36 },
    { header: "Deadline (DD-MM-YYYY)", key: "deadline", width: 20 },
    { header: "Themes / Tracks / Problem Statements", key: "description", width: 70 },
    { header: "Batches (blank = all current, All = every list)", key: "batches", width: 30 },
    { header: "Years (blank = II, III, IV)", key: "years", width: 22 },
  ];
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A2A66" } };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  ws.getRow(1).height = 32;
  const ex = ws.addRow({
    title: "e.g. Smart Health Hackathon 2026 (example row, it is skipped)",
    link: "https://example.org/hackathon",
    deadline: "15-11-2026",
    description: "Track 1 - Remote patient monitoring\nTrack 2 - AI for early disease detection\nTrack 3 - Assistive technology for elderly",
    batches: "2025-2029, 2024-2028",
    years: "II, III",
  });
  ex.eachCell((c) => { c.font = { italic: true, color: { argb: "FF7A869E" } }; c.alignment = { wrapText: true, vertical: "top" }; });
  for (let r = 3; r <= 52; r++) ws.getRow(r).alignment = { wrapText: true, vertical: "top" };

  const help = wb.addWorksheet("How to fill");
  help.columns = [{ width: 30 }, { width: 90 }];
  [
    ["How to fill this sheet", ""],
    ["One row per hackathon", "Fill rows from row 3 down. Row 2 is an example and is skipped. Up to 50 hackathons per file."],
    ["Hackathon Name", "Required. Becomes the heading of its Excel recommendations."],
    ["Link", "Optional. If the Themes column is empty, the portal tries to read the themes from this page."],
    ["Deadline", "Optional. Any of 15-11-2026, 15/11/2026 or 2026-11-15."],
    ["Themes / Tracks / Problem Statements", "Strongly recommended. Paste the tracks or problem statements. If the hackathon names tracks, the results include a Track column."],
    ["Batches", `Optional. Comma separated from: ${BATCHES.join(", ")} (short form like 25-29 also works). Blank = all batches currently studying. Type All to search every project list, including collections such as SIH and MSME.`],
    ["Years", "Optional. Comma separated: I, II, III, IV. Blank = II, III, IV."],
  ].forEach((r, i) => { const row = help.addRow(r); row.alignment = { wrapText: true, vertical: "top" }; if (i === 0) row.font = { bold: true, size: 14 }; else row.getCell(1).font = { bold: true }; });

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="Hackathons_Template.xlsx"`,
  } });
});
