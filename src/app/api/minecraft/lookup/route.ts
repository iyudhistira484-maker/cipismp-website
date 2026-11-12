import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/server/csrf";
import { rateLimit } from "@/server/rate-limit";
import { InvalidUsernameError, getProfileByUuidSafe, resolvePlayer } from "@/server/minecraft";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().min(1).max(32) });

/** Validasi username Minecraft + preview kepala. Tidak menyimpan data apa pun. */
export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const limit = await rateLimit(`mc-lookup:${ip}`, 30, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Terlalu banyak pencarian. Tunggu sebentar." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Nama pemain wajib diisi." }, { status: 400 });
  }

  try {
    const player = await resolvePlayer(parsed.data.name);
    if (env.MINECRAFT_LOOKUP_MODE === "offline" && player.source !== "cache") {
      return NextResponse.json({ ok: false, message: "Akun belum diverifikasi di server. Hubungkan melalui dashboard terlebih dahulu." }, { status: 422 });
    }
    const profile = await getProfileByUuidSafe(player.uuid);
    return NextResponse.json({
      ok: true,
      player: {
        uuid: player.uuid,
        name: player.name,
        edition: player.edition,
        headUrl: `https://mc-heads.net/avatar/${encodeURIComponent(player.uuid)}/96`,
        linked: Boolean(profile?.verifiedAt),
      },
    });
  } catch (error) {
    if (error instanceof InvalidUsernameError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 422 });
    }
    return NextResponse.json({ ok: false, message: "Tidak bisa menghubungi layanan Minecraft." }, { status: 502 });
  }
}
