import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthWrapper } from "@/components/auth-wrapper";
import { BillingWrapper } from "@/components/billing-wrapper";
import { ConditionalLayout } from "@/components/conditional-layout";
import { Toaster } from "@/components/ui/toaster";
import { PostHogProvider } from "@/components/posthog-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Solari",
  description: "Solari Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PostHogProvider>
          <AuthWrapper>
            <BillingWrapper>
              <ConditionalLayout>{children}</ConditionalLayout>
            </BillingWrapper>
          </AuthWrapper>
          <Toaster />
        </PostHogProvider>
      </body>
    </html>
  );
}
