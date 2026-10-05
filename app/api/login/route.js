import { COOKIE, sign } from "@/lib/session";
import { timingSafeEqual } from "crypto";

const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  const admin = process.env.ADMIN_PASSWORD, staff = process.env.STAFF_PASSWORD;
  if (!admin) return Response.json({ error: "The portal is not set up yet: ADMIN_PASSWORD is missing." }, { status: 500 });
  let role = null;
  if (password && same(password, admin)) role = "admin";
  else if (password && staff && same(password, staff)) role = "staff";
  if (!role) { await new Promise((r) => setTimeout(r, 600)); return Response.json({ error: "That password is not correct." }, { status: 401 }); }
  const days = 7;
  const token = await sign({ role, exp: Date.now() + days * 864e5 });
  const res = Response.json({ role });
  res.headers.append("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return res;
}
