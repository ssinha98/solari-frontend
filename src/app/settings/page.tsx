"use client";

import { useState } from "react";
import { signOut } from "@/tools/auth_tools";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      // Redirect will be handled by AuthWrapper automatically
      router.push("/login");
    } catch (error) {
      console.error("Failed to sign out:", error);
      setIsSigningOut(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground">
          Configure your application settings.
        </p>
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Account</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your account settings and sign out.
          </p>
          <Button
            onClick={handleSignOut}
            disabled={isSigningOut}
            variant="outline"
          >
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </Button>
        </div>
      </div>
    </div>
  );
}
