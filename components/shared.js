"use client";
import { useEffect, useState } from "react";

export async function api(url, opts = {}) {
  const init = { method: opts.method || "GET", headers: {} };
  if (opts.json) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.json); }
  else if (opts.body) init.body = opts.body;
  const r = await fetch(url, init);
  if (r.status === 401 && typeof window !== "undefined") { window.location.href = "/login"; throw new Error("Please sign in again."); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
  return d;
}

let meCache = null;
export function useMe() {
  const [me, setMe] = useState(meCache);
  useEffect(() => { if (!meCache) api("/api/me").then((d) => { meCache = d; setMe(d); }).catch(() => {}); }, []);
  return me;
}

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
export const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB");

export function downloadCsv(filename, rows) {
  const csv = "﻿" + rows.map((r) => r.map((v) => { v = String(v ?? ""); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const EXT = { xlsx: ["XLS", "x"], csv: ["CSV", "x"], pdf: ["PDF", "p"], docx: ["DOC", "w"], pptx: ["PPT", "s"] };
export function FileIcon({ name }) {
  const [label, k] = EXT[String(name).split(".").pop().toLowerCase()] || ["FILE", ""];
  return <span className={`fileicon fi-${k}`} aria-hidden="true">{label}</span>;
}
