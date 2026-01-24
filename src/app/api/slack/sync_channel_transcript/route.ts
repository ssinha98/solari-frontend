import { NextResponse } from "next/server";
import { getBackendUrl } from "@/tools/backend-config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { uid, agent_id, channel_id, channel_name } = body;

    if (!uid || !agent_id || !channel_id || !channel_name) {
      return new NextResponse(
        JSON.stringify({
          error: "uid, agent_id, channel_id, and channel_name are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const backendUrl = getBackendUrl();
    const backendRes = await fetch(
      `${backendUrl}/slack/sync_channel_transcript?uid=${uid}&agent_id=${agent_id}&channel_id=${encodeURIComponent(channel_id)}&channel_name=${encodeURIComponent(channel_name)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-solari-key": process.env.SOLARI_INTERNAL_KEY!,
        },
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
    console.error("Error in Slack sync channel transcript API route:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
