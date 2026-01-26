"use client";

import { usePathname } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't wrap login or billing pages with DashboardLayout
  if (
    pathname === "/login" ||
    pathname === "/billing/cancel" ||
    pathname === "/billing/success"
  ) {
    return <>{children}</>;
  }

  // Wrap all other pages with DashboardLayout
  return <DashboardLayout>{children}</DashboardLayout>;
}
