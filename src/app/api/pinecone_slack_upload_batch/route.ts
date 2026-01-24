import { NextResponse } from "next/server";
import { getBackendUrl } from "@/tools/backend-config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { uid, agent_id, namespace, channels, chunk_n, overlap_n } = body;

    if (
      !uid ||
      !agent_id ||
      !namespace ||
      !channels ||
      !Array.isArray(channels) ||
      channels.length === 0
    ) {
      return new NextResponse(
        JSON.stringify({
          error:
            "uid, agent_id, namespace, and channels array are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const backendUrl = getBackendUrl();
    const backendRes = await fetch(
      `${backendUrl}/api/pinecone_slack_upload_batch`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-solari-key": process.env.SOLARI_INTERNAL_KEY!,
        },
        body: JSON.stringify({
          uid,
          agent_id,
          namespace,
          chunk_n,
          overlap_n,
          channels,
        }),
      }
    );

    if (!backendRes.ok) {
      const errorText = await backendRes.text();
      return new NextResponse(errorText, {
        status: backendRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "Error in Pinecone Slack upload batch API route:",
      error
    );
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
