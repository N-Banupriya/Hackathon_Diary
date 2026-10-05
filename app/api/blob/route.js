// Issues short-lived upload tokens so the browser can send files straight to Vercel Blob
// (avoids the 4.5 MB request limit of serverless functions).
import { handleUpload } from "@vercel/blob/client";
import { getSession } from "@/lib/auth";

export async function POST(req) {
  const body = await req.json();
  try {
    const result = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async () => {
        const s = await getSession();
        if (!s || s.role !== "admin") throw new Error("Only the portal admin can upload.");
        return {
          allowedContentTypes: [
            "application/pdf", "text/csv", "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          ],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
