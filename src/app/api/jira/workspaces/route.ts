import { NextResponse } from "next/server";
import { getBackendUrl } from "@/tools/backend-config";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    
    if (!userId) {
      return new NextResponse(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const backendUrl = getBackendUrl();
    const backendRes = await fetch(
      `${backendUrl}/api/jira/workspaces?user_id=${userId}`,
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
    console.error("Error in API route:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}












