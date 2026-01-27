"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/tools/firebase";
import { usePostHog } from "posthog-js/react";
import { getUserDocument } from "@/tools/auth_tools";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/tools/firebase";

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const posthog = usePostHog();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      // If user is not logged in and not on login page, redirect to login
      if (!user && pathname !== "/login") {
        router.push("/login");
      }
      // If user is logged in and on login page, redirect to home
      if (user && pathname === "/login") {
        router.push("/");
      }

      if (!posthog) {
        return;
      }

      if (user) {
        const personProperties: Record<string, string> = {};
        if (user.email) {
          personProperties.email = user.email;
        }
        if (user.displayName) {
          personProperties.name = user.displayName;
        }

        try {
          const userSnap = await getUserDocument(user.uid);
          const teamId = userSnap.exists()
            ? (userSnap.data().teamId as string | undefined)
            : undefined;

          if (teamId) {
            personProperties.team_id = teamId;
            const teamSnap = await getDoc(doc(db, "teams", teamId));
            const teamName = teamSnap.data()?.team_name;
            if (typeof teamName === "string" && teamName.trim()) {
              personProperties.team_name = teamName.trim();
            }
          }
        } catch (error) {
          console.warn("Failed to load PostHog user properties:", error);
        }

        posthog.identify(user.uid, personProperties);
      } else {
        posthog.reset();
      }
    });

    return () => unsubscribe();
  }, [router, pathname, posthog]);

  // Show nothing while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If not logged in, don't render children (login page will be shown)
  if (!user && pathname !== "/login") {
    return null;
  }

  // If on login page, render children (login page)
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // If logged in, render children (protected pages)
  return <>{children}</>;
}















