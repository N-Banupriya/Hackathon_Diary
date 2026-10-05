import { HttpError } from "./auth";
import { BATCHES, YEARS } from "./config";

const UUID = /^[0-9a-f-]{36}$/i;

// Validates a hackathon. Where to search: every project list (scopeAll), or the chosen
// Design Thinking batches/years and/or the chosen collections.
export function cleanHack(b) {
  const title = String(b.title || "").trim().slice(0, 200);
  if (!title) throw new HttpError(400, "Give the hackathon a name.");
  const link = String(b.link || "").trim().slice(0, 1000);
  if (link && !/^https?:\/\//i.test(link)) throw new HttpError(400, "The link should start with http:// or https://");
  const description = String(b.description || "").trim().slice(0, 40000);
  if (!description && !link) throw new HttpError(400, "Add the link or the description.");
  const scopeAll = !!b.scopeAll;
  const batches = (b.batches || []).filter((x) => BATCHES.includes(x));
  const years = (b.years || []).filter((x) => YEARS.includes(x));
  const collections = [...new Set((b.collections || []).filter((x) => UUID.test(String(x))))];
  const dtOk = batches.length && years.length;
  if (!scopeAll && !dtOk && !collections.length) throw new HttpError(400, "Choose where to look: All project lists, or at least one batch and year, or a collection.");
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(b.deadline || "") ? b.deadline : null;
  return { title, link, description, scopeAll, batches: dtOk ? batches : [], years: dtOk ? years : [], collections, deadline };
}
