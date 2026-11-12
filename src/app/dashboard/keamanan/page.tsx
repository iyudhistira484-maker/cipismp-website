import type { Metadata } from "next";
import { requireCustomer } from "@/server/auth/guard";
import { AccountSecurityContent } from "@/components/dashboard/account-security-content";

export const metadata: Metadata = { title: "Keamanan", robots: { index: false, follow: false } };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ "email-berubah"?: string; discord?: string }> }) {
  const viewer = await requireCustomer("/dashboard/keamanan");
  return <AccountSecurityContent viewer={viewer} params={await searchParams} basePath="/dashboard/keamanan" />;
}
