// Official lists from the "Lists" sheet of the Design Thinking template, with keyword rules
// so that free-text entries ("Iot", "web application development") land in the right filter.
export const DOMAINS = [
  ["AI", /\b(ai|artificial intelligence|aiml)\b/],
  ["Machine Learning", /machine learning|\bml\b|aiml/],
  ["Data Science & Analytics", /data science|analytics/],
  ["Computer Vision & Image Processing", /computer vision|image processing/],
  ["Natural Language Processing & Generative AI", /\bnlp\b|natural language|generative|gen ?ai|\bllm/],
  ["Web Development", /\bweb\b|full ?stack/],
  ["Mobile & App Development", /mobile|\bapps?\b/],
  ["Cloud Computing & DevOps", /cloud|devops/],
  ["Cybersecurity", /cyber|security/],
  ["Blockchain & Web3", /blockchain|web ?3/],
  ["AR VR XR", /\b(ar|vr|xr)\b|augmented|virtual reality/],
  ["Game Development", /\bgam(e|ing)\b/],
  ["IoT (Internet of Things)", /\b[il]ot\b|internet of things/],
  ["Embedded Systems", /embedded/],
  ["VLSI & Semiconductor", /vlsi|semiconductor/],
  ["Robotics & Drones", /robot|drone/],
  ["Signal Processing & Communication", /signal|communication/],
  ["Networking & 5G", /network|\b5g\b/],
  ["Power Electronics & Electrical Drives", /power electronics|electrical drive/],
  ["Control Systems & Automation", /control system|automation/],
  ["Edge AI & AI Hardware", /edge ai|ai hardware/],
  ["Mechanical Design & CAD", /mechanical|\bcad\b/],
  ["Materials & Manufacturing Technology", /material|manufacturing tech/],
  ["Biomedical & Biotechnology", /biomedical|biotech/],
  ["Mathematical Modelling & Optimization", /mathematical|optimi[sz]ation/],
  ["Quantum Computing", /quantum/],
];

export const SECTORS = [
  ["Healthcare & MedTech", /health|medtech|medical/],
  ["Biotechnology & Life Sciences", /biotech|life science/],
  ["Assistive & Inclusive Technology", /assistive|inclusive|disab/],
  ["Sports Fitness & Wellness", /sport|fitness|wellness/],
  ["Agriculture & AgriTech", /agri/],
  ["Food Technology & Nutrition", /\bfood\b|nutrition/],
  ["Marine Fisheries & Ocean", /marine|fisher|ocean/],
  ["Rural Development", /rural/],
  ["Energy & Power Systems", /energy|power system/],
  ["Renewable Energy & CleanTech", /renewable|clean ?tech/],
  ["Environment Climate & Waste Management", /environment|climate|waste|sustainab/],
  ["Water Resources & Sanitation", /water|sanitation/],
  ["Manufacturing & Industry 4.0", /manufactur|industry 4|industrial automation/],
  ["Automotive & Electric Vehicles", /automotive|electric vehicle|\bev\b/],
  ["Transportation & Mobility", /transport|mobility|aviation|airport/],
  ["Logistics & Supply Chain", /logistic|supply chain/],
  ["Construction & Infrastructure", /construction|infrastructure/],
  ["Smart Cities & Urban Systems", /smart cit|urban/],
  ["Mining Metals & Materials", /mining|metal/],
  ["Textile & Fashion", /textile|fashion/],
  ["FinTech Banking & Insurance", /fintech|financ|bank|insurance/],
  ["Retail & E-Commerce", /retail|e ?- ?commerce/],
  ["Tourism Travel & Hospitality", /touris|travel|hospitality/],
  ["Media Entertainment & Digital Content", /media|entertainment|digital content/],
  ["Education EdTech & Skill Development", /educat|edtech|skill/],
  ["Governance GovTech & Public Services", /govern|govtech|public service/],
  ["Social Impact & Community Welfare", /social|community|welfare/],
  ["Disaster Management & Emergency Response", /disaster|emergency/],
  ["Defence Security & Surveillance", /defen[cs]e|security|surveillance/],
  ["Space & Aerospace", /\bspace\b|aerospace/],
  ["Heritage Art & Culture", /heritage|\bart\b|culture/],
  ["Campus & Institutional Innovation", /campus|institution/],
];

const titleCase = (s) => s.replace(/\s+/g, " ").trim().replace(/\b([a-z])/g, (m) => m.toUpperCase());

export function classify(value, list) {
  const v = String(value || "").trim();
  if (!v) return [];
  const low = v.toLowerCase();
  const exact = list.find(([name]) => name.toLowerCase() === low);
  if (exact) return [exact[0]];
  const hits = list.filter(([, re]) => re.test(low)).map(([name]) => name);
  if (hits.length) return hits;
  return v.length > 2 ? [titleCase(v)] : [];
}
export const domainTags = (v) => classify(v, DOMAINS);
export const sectorTags = (v) => classify(v, SECTORS);
