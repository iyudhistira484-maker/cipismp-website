import { NextResponse } from "next/server";
import { getServerStatus } from "@/server/server-status";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const status = await getServerStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "public, max-age=20, stale-while-revalidate=40" },
  });
}
