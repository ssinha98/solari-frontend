"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getBackendUrl } from "@/tools/backend-config";
import { auth } from "@/tools/firebase";
import { signOut } from "@/tools/auth_tools";
import { useRouter } from "next/navigation";

export default function BillingCancelPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  const handleManageBilling = async () => {
    if (isLoading) {
      return;
    }

    const userId = auth.currentUser?.uid;
    if (!userId) {
      toast.error("Please sign in again to manage billing.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${getBackendUrl()}/api/stripe/create_portal_session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        },
      );

      const data = (await response.json()) as { url?: string };
      if (!response.ok || !data.url) {
        toast.error("Unable to open billing portal.");
        return;
      }

      window.location.assign(data.url);
    } catch (error) {
      console.error("Failed to open billing portal:", error);
      toast.error("Something went wrong opening billing portal.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    try {
      setIsSigningOut(true);
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Failed to sign out:", error);
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute right-6 top-6">
        <Button
          variant="outline"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? "Signing out..." : "Log out"}
        </Button>
      </div>
      <div className="max-w-md text-center space-y-4">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">Billing update needed</h1>
          <p className="text-muted-foreground">
            Your team does not currently have access. Please update your billing
            details to continue using Solari.
          </p>
        </div>
        <div className="space-y-3">
          <Button onClick={handleManageBilling} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading
              </>
            ) : (
              "Manage billing"
            )}
          </Button>
          <Button asChild variant="secondary">
            <a
              href="https://cal.com/sahil-sinha-hugr4z/30min"
              target="_blank"
              rel="noreferrer"
            >
              Something looks wrong? Grab time to get help
            </a>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Or, as always, contact the founder at{" "}
          <a className="underline" href="mailto:sahil@usesolari.ai">
            sahil@usesolari.ai
          </a>
          .
        </p>
      </div>
    </div>
  );
}
