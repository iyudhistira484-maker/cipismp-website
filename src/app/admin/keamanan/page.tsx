import { requireStaff } from "@/server/auth/guard";
import { AccountSecurityContent } from "@/components/dashboard/account-security-content";

export const metadata = { title: "Keamanan admin" };

export default async function AdminSecurityPage({ searchParams }: { searchParams: Promise<{ "email-berubah"?: string; discord?: string }> }) {
  const viewer = await requireStaff();
  return <AccountSecurityContent viewer={viewer} params={await searchParams} basePath="/admin/keamanan" />;
}
