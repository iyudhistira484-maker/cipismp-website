import { eq } from "drizzle-orm";
import { db } from "../db";
import { emailOutbox } from "../db/schema";
import { env } from "../env";
import { ids } from "../ids";
import { logger } from "../logger";
import { enqueue } from "../queue";
import type { EmailContent } from "./templates";

export type { EmailContent } from "./templates";
export * from "./templates";

/**
 * Email keluar selalu lewat antrean: simpan ke outbox, lalu job `email.send`
 * mengirim dengan retry. Di dev, provider `outbox` menyimpan email di database
 * dan bisa dibaca di /admin/email (kotak surat pengembangan).
 */
export async function queueEmail(input: { to: string; content: EmailContent }): Promise<string> {
  const id = ids.email();
  await db.insert(emailOutbox).values({
    id,
    to: input.to.toLowerCase(),
    subject: input.content.subject,
    html: input.content.html,
    text: input.content.text,
    provider: env.EMAIL_PROVIDER,
  });
  await enqueue("email.send", { emailId: id }, { maxAttempts: 5, dedupeKey: `email:${id}` });
  return id;
}

export interface SendResult {
  ok: boolean;
  error?: string;
  provider: string;
}

export async function deliverEmail(emailId: string): Promise<SendResult> {
  const row = await db.query.emailOutbox.findFirst({ where: eq(emailOutbox.id, emailId) });
  if (!row) return { ok: false, error: "Email tidak ditemukan", provider: env.EMAIL_PROVIDER };
  if (row.status === "SENT") return { ok: true, provider: row.provider };

  let result: SendResult;
  try {
    result = await sendWithProvider({ to: row.to, subject: row.subject, html: row.html, text: row.text });
  } catch (error) {
    result = { ok: false, error: (error as Error).message, provider: env.EMAIL_PROVIDER };
  }

  await db
    .update(emailOutbox)
    .set({
      status: result.ok ? "SENT" : "FAILED",
      attempts: row.attempts + 1,
      lastError: result.error?.slice(0, 1000) ?? null,
      sentAt: result.ok ? new Date() : null,
      provider: result.provider,
    })
    .where(eq(emailOutbox.id, emailId));

  if (!result.ok) {
    logger.warn("email_send_failed", { emailId, provider: result.provider, error: result.error });
    throw new Error(result.error ?? "Pengiriman email gagal");
  }
  return result;
}

/** Eksekutor provider email; diekspor agar kontrak Resend/SMTP bisa diuji tanpa kredensial live. */
export async function sendWithProvider(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  switch (env.EMAIL_PROVIDER) {
    case "resend": {
      if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY belum diisi");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return { ok: true, provider: "resend" };
    }
    case "smtp": {
      if (!env.SMTP_HOST) throw new Error("SMTP_HOST belum diisi");
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? 587,
        secure: env.SMTP_SECURE ?? false,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } : undefined,
      });
      await transport.sendMail({
        from: env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return { ok: true, provider: "smtp" };
    }
    case "outbox":
    default:
      // Dev/test: email tetap tercatat di tabel email_outbox.
      return { ok: true, provider: "outbox" };
  }
}

/** Dipakai test & skrip untuk memastikan email benar-benar terkirim. */
export async function latestEmailFor(to: string) {
  return db.query.emailOutbox.findFirst({
    where: eq(emailOutbox.to, to.toLowerCase()),
    orderBy: (t, { desc }) => desc(t.createdAt),
  });
}
