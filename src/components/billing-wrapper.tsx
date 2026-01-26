"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { auth, db } from "@/tools/firebase";

const allowedBillingStatuses = new Set([
  "active",
  "trialing",
  "booking_confirmed",
  "pending_payment",
  "pending_booking",
]);

const bypassPaths = new Set(["/login", "/billing/cancel", "/billing/success"]);

export function BillingWrapper({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const shouldBypass = useMemo(
    () => (pathname ? bypassPaths.has(pathname) : false),
    [pathname],
  );

  useEffect(() => {
    let isMounted = true;
    let unsubscribeTeam: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (!isMounted) {
        return;
      }

      setUser(nextUser);

      if (!nextUser) {
        setBillingStatus(null);
        setLoading(false);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", nextUser.uid));
        const teamId = userSnap.exists()
          ? (userSnap.data().teamId as string | undefined)
          : undefined;

        if (!teamId) {
          setBillingStatus(null);
          setLoading(false);
          return;
        }

        const teamRef = doc(db, "teams", teamId);
        unsubscribeTeam = onSnapshot(
          teamRef,
          (teamSnap) => {
            if (!isMounted) {
              return;
            }
            if (!teamSnap.exists()) {
              setBillingStatus(null);
              setLoading(false);
              return;
            }
            const status = teamSnap.data()?.billing?.status as
              | string
              | undefined;
            setBillingStatus(status ?? null);
            setLoading(false);
          },
          () => {
            if (!isMounted) {
              return;
            }
            setBillingStatus(null);
            setLoading(false);
          },
        );
      } catch (error) {
        console.error("Failed to load billing status:", error);
        setBillingStatus(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (unsubscribeTeam) {
        unsubscribeTeam();
      }
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (loading || shouldBypass) {
      return;
    }

    if (!user) {
      return;
    }

    if (billingStatus && !allowedBillingStatuses.has(billingStatus)) {
      router.push("/billing/cancel");
    }
  }, [billingStatus, loading, router, shouldBypass, user]);

  if (loading && !shouldBypass) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {billingStatus === "pending_payment" && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Payment pending</AlertTitle>
          <AlertDescription>
            Your payment is pending. We're still processing it, but you can keep
            using Solari.
          </AlertDescription>
        </Alert>
      )}
      {children}
    </>
  );
}
