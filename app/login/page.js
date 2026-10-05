"use client";
import { useState } from "react";
import { SITE } from "@/lib/config";

export default function Login() {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error || "Sign in failed."); return; }
    window.location.href = "/";
  }
  return (
    <div className="container login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="eyebrow">{SITE.unit}</div>
        <h1 className="login-title">Sign in to the portal</h1>
        <p className="muted">Faculty and staff of {SITE.institute} can view student projects and shortlist teams for hackathons.</p>
        <label className="field"><span>Portal password</span>
          <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus required />
        </label>
        {err && <div className="alert err">{err}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
