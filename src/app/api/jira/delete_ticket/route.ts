import { NextResponse } from "next/server";
import { getBackendUrl } from "@/tools/backend-config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, agent_id, jira_id, namespace } = body;

    if (!user_id || !agent_id || !jira_id || !namespace) {
      return new NextResponse(
        JSON.stringify({
          error: "user_id, agent_id, jira_id, and namespace are required",
          status: "failure",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const backendUrl = getBackendUrl();
    const backendRes = await fetch(`${backendUrl}/api/jira/delete_ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-solari-key": process.env.SOLARI_INTERNAL_KEY!,
      },
      body: JSON.stringify({ user_id, agent_id, jira_id, namespace }),
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
    console.error("Error in Jira delete ticket API route:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error", status: "failure" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
