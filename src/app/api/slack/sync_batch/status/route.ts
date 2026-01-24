import { NextResponse } from "next/server";
import { getBackendUrl } from "@/tools/backend-config";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    const agent_id = searchParams.get("agent_id");
    const batch_id = searchParams.get("batch_id");

    if (!uid || !agent_id || !batch_id) {
      return new NextResponse(
        JSON.stringify({ error: "uid, agent_id, and batch_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const backendUrl = getBackendUrl();
    const backendRes = await fetch(
      `${backendUrl}/slack/sync_batch/status?uid=${uid}&agent_id=${agent_id}&batch_id=${encodeURIComponent(batch_id)}`,
      {
        method: "GET",
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
    console.error("Error in Slack batch sync status API route:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

