import { NextResponse } from "next/server";
import { COOKIE, verify } from "./lib/session";

export async function middleware(req) {
  const session = await verify(req.cookies.get(COOKIE)?.value);
  if (session) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const url = req.nextUrl.clone(); url.pathname = "/login"; url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the login page, login API, blob upload callback and static files.
  matcher: ["/((?!login|api/login|api/blob|api/health|_next/|favicon|icon|logo|.*\\.(?:png|svg|jpg|ico)$).*)"],
};
