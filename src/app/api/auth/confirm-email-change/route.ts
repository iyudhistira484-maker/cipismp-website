import { NextResponse } from "next/server";
import { consumeEmailChange } from "@/server/auth/flows";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

/** Konfirmasi perubahan email (dipanggil dari form halaman verifikasi). */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const target = new URL("/verifikasi-perubahan-email?status=berhasil", url.origin);
  try {
    const email = await consumeEmailChange(token);
    logger.info("email_changed", { email });
    return NextResponse.redirect(target, { status: 303 });
  } catch (error) {
    logger.warn("email_change_failed", { error: (error as Error).message });
    return NextResponse.redirect(new URL("/verifikasi-perubahan-email?status=gagal", url.origin), { status: 303 });
  }
}
