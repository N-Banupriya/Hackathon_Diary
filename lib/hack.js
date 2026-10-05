import { HttpError } from "./auth";
import { BATCHES, YEARS } from "./config";

export function cleanHack(b) {
  const title = String(b.title || "").trim().slice(0, 200);
  if (!title) throw new HttpError(400, "Give the hackathon a name.");
  const link = String(b.link || "").trim().slice(0, 1000);
  if (link && !/^https?:\/\//i.test(link)) throw new HttpError(400, "The link should start with http:// or https://");
  const description = String(b.description || "").trim().slice(0, 40000);
  if (!description && !link) throw new HttpError(400, "Add the link or the description.");
  const batches = (b.batches || []).filter((x) => BATCHES.includes(x));
  const years = (b.years || []).filter((x) => YEARS.includes(x));
  if (!batches.length || !years.length) throw new HttpError(400, "Pick at least one batch and one year.");
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(b.deadline || "") ? b.deadline : null;
  return { title, link, description, batches, years, deadline };
}

