import { createConnection, type Socket } from "node:net";

/**
 * Client RCON minimal (Source RCON). Dipakai sebagai fallback pengiriman bila
 * plugin companion tidak terpasang. Setiap perintah menunggu respons server.
 */
export interface RconOptions {
  host: string;
  port: number;
  password: string;
  timeoutMs?: number;
}

const SERVERDATA_AUTH = 3;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_RESPONSE_VALUE = 0;
const SERVERDATA_AUTH_RESPONSE = 2;

export class RconError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RconError";
  }
}

export async function execRconCommands(options: RconOptions, commands: string[]): Promise<string[]> {
  if (commands.length === 0) return [];
  const socket = createConnection({ host: options.host, port: options.port });
  const timeoutMs = options.timeoutMs ?? 8000;
  const outputs: string[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new RconError("Koneksi RCON timeout")), timeoutMs);
      socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(new RconError(`RCON gagal tersambung: ${error.message}`));
      });
    });

    let nextId = 1;
    const pending = new Map<
      number,
      { resolve: (value: { id: number; body: string }) => void; reject: (error: Error) => void }
    >();
    let buffer = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4) {
        const length = buffer.readInt32LE(0);
        if (buffer.length < length + 4) break;
        const packet = buffer.subarray(4, length + 4);
        buffer = buffer.subarray(length + 4);
        const id = packet.readInt32LE(0);
        const body = packet.subarray(8, packet.length - 2).toString("utf8");
        const waiter = pending.get(id);
        if (waiter) {
          pending.delete(id);
          waiter.resolve({ id, body });
        }
      }
    });

    const send = (id: number, type: number, body: string) =>
      new Promise<{ id: number; body: string }>((resolve, reject) => {
        const payload = Buffer.from(body, "utf8");
        const packet = Buffer.alloc(payload.length + 14);
        packet.writeInt32LE(payload.length + 10, 0);
        packet.writeInt32LE(id, 4);
        packet.writeInt32LE(type, 8);
        payload.copy(packet, 12);
        packet.writeInt16LE(0, packet.length - 2);
        pending.set(id, { resolve, reject });
        socket.write(packet);
        setTimeout(() => {
          if (pending.delete(id)) reject(new RconError(`RCON tidak menjawab perintah ${id}`));
        }, timeoutMs);
      });

    const authId = nextId++;
    const auth = await send(authId, SERVERDATA_AUTH, options.password);
    // Source RCON menjawab dengan id = -1 bila password salah.
    if (auth.id === -1) throw new RconError("Autentikasi RCON ditolak");

    for (const command of commands) {
      const id = nextId++;
      const response = await send(id, SERVERDATA_EXECCOMMAND, command);
      outputs.push(response.body);
    }

    return outputs;
  } finally {
    socket.destroy();
  }
}

export type { Socket };
export { SERVERDATA_RESPONSE_VALUE, SERVERDATA_AUTH_RESPONSE };
