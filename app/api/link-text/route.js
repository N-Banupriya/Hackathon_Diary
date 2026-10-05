import { handle, requireRole } from "@/lib/auth";
import { fetchLinkText } from "@/lib/match";
export const POST = handle(async (req) => {
  await requireRole();
  const { url } = await req.json();
  return Response.json(await fetchLinkText(url));
});
