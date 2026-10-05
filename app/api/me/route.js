import { handle, requireRole } from "@/lib/auth";
import { useBlob, blobAccess } from "@/lib/storage";
export const GET = handle(async () => {
  const s = await requireRole();
  return Response.json({ role: s.role, blob: useBlob(), blobAccess: blobAccess(), ai: !!process.env.ANTHROPIC_API_KEY });
});
