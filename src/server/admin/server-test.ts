import { decryptSecret } from "../crypto";

export interface ServerTestResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/** Uji kredensial RCON dengan login lalu keluar tanpa menjalankan perintah yang mengubah data. */
export async function testRcon(host: string, port: number, encryptedPassword: string | null): Promise<ServerTestResult> {
  const password = decryptSecret(encryptedPassword);
  if (!password) return { ok: false, message: "Password RCON belum diatur." };
  const { execRconCommands } = await import("../delivery/rcon");
  try {
    await execRconCommands({ host, port, password }, ["list"]);
    return { ok: true, message: "Login RCON berhasil; perintah uji `list` dijalankan." };
  } catch (error) {
    return { ok: false, message: `RCON gagal: ${(error as Error).message}` };
  }
}
