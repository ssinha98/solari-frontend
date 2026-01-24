import { NextResponse } from "next/server";
import { getBackendUrl } from "@/tools/backend-config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      uid,
      agent_id,
      channel_id,
      channel_name,
      batch_id,
      team_id,
      tz,
      limit,
    } = body;

    if (!uid || !agent_id || !channel_id || !channel_name || !batch_id) {
      return new NextResponse(
        JSON.stringify({
          error:
            "uid, agent_id, channel_id, channel_name, and batch_id are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const backendUrl = getBackendUrl();
    let url = `${backendUrl}/slack/batch_channel_retry?uid=${uid}&agent_id=${agent_id}&channel_id=${encodeURIComponent(channel_id)}&channel_name=${encodeURIComponent(channel_name)}&batch_id=${encodeURIComponent(batch_id)}`;

    // Add optional parameters if provided
    if (team_id) {
      url += `&team_id=${encodeURIComponent(team_id)}`;
    }
    if (tz) {
      url += `&tz=${encodeURIComponent(tz)}`;
    }
    if (limit) {
      url += `&limit=${limit}`;
    }

    const backendRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-solari-key": process.env.SOLARI_INTERNAL_KEY!,
      },
    });

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
    console.error("Error in Slack batch channel retry API route:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
