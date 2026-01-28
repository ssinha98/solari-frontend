import { NextResponse } from "next/server";
import { getBackendUrl } from "@/tools/backend-config";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const uid = url.searchParams.get("uid");

    if (!uid) {
      return new NextResponse(
        JSON.stringify({ error: "uid is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const backendUrl = getBackendUrl();
    const backendRes = await fetch(
      `${backendUrl}/api/slack/list_channels?uid=${encodeURIComponent(uid)}`,
    );

    if (!backendRes.ok) {
      const errorText = await backendRes.text();
      return new NextResponse(errorText, {
        status: backendRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contentType = backendRes.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await backendRes.json();
      return NextResponse.json(data);
    }

    const text = await backendRes.text();
    return new NextResponse(text, {
      status: backendRes.status,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("Error in Slack list_channels route:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
