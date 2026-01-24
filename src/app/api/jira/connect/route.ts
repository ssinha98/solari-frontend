import { NextResponse } from "next/server";
import { getBackendUrl } from "@/tools/backend-config";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid");
    if (!uid) {
      return new NextResponse(JSON.stringify({ error: "uid is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Construct the callback URL - this should point to the backend callback endpoint
    // The backend will handle the OAuth callback from Jira, then redirect to frontend
    const backendUrl = getBackendUrl();
    const callbackUrl = `${backendUrl}/auth/jira/callback`;

    const backendRes = await fetch(
      `${backendUrl}/auth/jira/connect?uid=${uid}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-solari-key": process.env.SOLARI_INTERNAL_KEY!,
        },
        redirect: "manual", // Don't follow redirects, we'll handle it
      },
    );

    // If backend returns a redirect, follow it
    if (backendRes.status >= 300 && backendRes.status < 400) {
      const location = backendRes.headers.get("location");
      if (location) {
        return NextResponse.redirect(location);
      }
    }

    // If not a redirect, return the response
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
    console.error("Error in Jira connect route:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
