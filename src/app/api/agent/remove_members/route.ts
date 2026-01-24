import { NextResponse } from "next/server";
import { getBackendUrl } from "@/tools/backend-config";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const backendUrl = getBackendUrl();

    const backendRes = await fetch(`${backendUrl}/api/agent/remove_members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-solari-key": process.env.SOLARI_INTERNAL_KEY!,
      },
      body,
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
    console.error("Error in API route:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

