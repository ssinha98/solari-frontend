import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Review",
};

export default function ForReviewDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
