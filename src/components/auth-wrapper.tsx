"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/tools/firebase";

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
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
    });

    return () => unsubscribe();
  }, [router, pathname]);

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




