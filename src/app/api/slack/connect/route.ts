import { NextResponse } from "next/server";
import { getBackendUrl } from "@/tools/backend-config";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userid } = body;
    
    if (!userid) {
      return new NextResponse(
        JSON.stringify({ error: "userid is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const backendUrl = getBackendUrl();
    const backendRes = await fetch(
      `${backendUrl}/slack/start_auth`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-solari-key": process.env.SOLARI_INTERNAL_KEY!,
        },
        body: JSON.stringify({ userid }),
        redirect: "manual", // Don't follow redirects, we'll handle it
      }
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

    // Return JSON response to client so it can handle the authorize_url and show loading state
    const contentType = backendRes.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await backendRes.json();
      // Return the JSON response as-is - client will extract authorize_url and redirect
      return NextResponse.json(data);
    }

    // If it's not JSON, return as-is
    const text = await backendRes.text();
    return new NextResponse(text, {
      status: backendRes.status,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("Error in Slack connect route:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

