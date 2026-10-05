// Edit these to change names shown on the portal.
export const SITE = {
  institute: "Sri Eshwar College of Engineering",
  instituteShort: "SECE",
  place: "Coimbatore",
  unit: "Centre for Innovation",
  portalTitle: "Project Repository & Hackathon Portal",
  portalShort: "Project Repository",
  copyright: "N. Banupriya, AP/CCE",
  // Put your logo file in the public folder and set this to "/logo.png"
  logo: null,
};

export const BATCHES = ["2023-2027", "2024-2028", "2025-2029", "2026-2030", "2027-2031"];
export const YEARS = ["I", "II", "III", "IV"];
export const MAX_FILES_PER_YEAR = 5;
export const MAX_FILES_PER_COLLECTION = 20;
export const ALLOWED_EXT = ["xlsx", "csv", "pdf", "docx", "pptx"];

export const batchLabel = (b) => String(b).replace(/^20(\d\d)-20(\d\d)$/, "20$1–$2");

// Academic year starts in June: e.g. the 2025–29 batch is in Year II from June 2026 to May 2027.
export function currentYearOf(batch, now = new Date()) {
  const ay = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  const n = ay - parseInt(batch, 10) + 1;
  return n >= 1 && n <= 4 ? YEARS[n - 1] : null;
}
