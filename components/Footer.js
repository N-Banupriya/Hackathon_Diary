import { SITE } from "@/lib/config";
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer-in">
        <div>
          <div className="footer-title">{SITE.institute}</div>
          <div className="footer-sub">{SITE.unit} · {SITE.portalTitle}</div>
        </div>
        <div className="copyright">© {year} {SITE.copyright}, {SITE.institute}. All rights reserved.</div>
      </div>
    </footer>
  );
}
