import { NextResponse } from "next/server";
import { getBackendUrl } from "@/tools/backend-config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { uid, agent_id, channels, tz, limit } = body;

    if (!uid || !agent_id || !channels || !Array.isArray(channels) || channels.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: "uid, agent_id, and channels array are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const backendUrl = getBackendUrl();
    const backendRes = await fetch(`${backendUrl}/slack/sync_batch/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-solari-key": process.env.SOLARI_INTERNAL_KEY!,
      },
      body: JSON.stringify({
        uid,
        agent_id,
        channels,
        tz: tz || "America/New_York", // Default timezone if not provided
        limit: limit || 500, // Default limit if not provided
      }),
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
    console.error("Error in Slack batch sync start API route:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

