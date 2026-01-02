"use client";

import { usePathname } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't wrap login page with DashboardLayout
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Wrap all other pages with DashboardLayout
  return <DashboardLayout>{children}</DashboardLayout>;
}
