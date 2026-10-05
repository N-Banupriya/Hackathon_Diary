"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SITE } from "@/lib/config";

export default function Header() {
  const path = usePathname();
  const [role, setRole] = useState(null);
  const onLogin = path === "/login";
  useEffect(() => {
    if (onLogin) { setRole(null); return; }
    fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((d) => setRole(d?.role || null)).catch(() => {});
  }, [onLogin, path]);
  async function logout() { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; }

  return (
    <header className="site-header">
      <div className="topstrip">
        <div className="container topstrip-in">
          <span>{SITE.institute}, {SITE.place}</span>
          {role && (
            <span className="topstrip-right">
              <span className="role">{role === "admin" ? "Admin" : "Staff"}</span>
              <button className="linkbtn" onClick={logout}>Sign out</button>
            </span>
          )}
        </div>
      </div>
      <div className="brandbar">
        <div className="container brandbar-in">
          <Link href="/" className="brand">
            {SITE.logo ? <img src={SITE.logo} alt="" className="brand-logo" /> : <span className="brand-mark" aria-hidden="true">{SITE.instituteShort}</span>}
            <span className="brand-text">
              <span className="brand-eyebrow">{SITE.unit}</span>
              <span className="brand-title">{SITE.portalTitle}</span>
            </span>
          </Link>
          {!onLogin && (
            <nav className="mainnav">
              <Link href="/" className={path === "/" ? "active" : ""}>Project Repository</Link>
              <Link href="/hackathons" className={path.startsWith("/hackathons") ? "active" : ""}>Hackathons</Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
