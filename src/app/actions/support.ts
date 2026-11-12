"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCustomer, requirePermissionApi } from "@/server/auth/guard";
import { assertSameOrigin, clientIp } from "@/server/csrf";
import { enforceRateLimit } from "@/server/rate-limit";
import { createSupportTicket, replySupportTicket, closeSupportTicket, SupportError } from "@/server/support";
import { writeAudit } from "@/server/audit";

export interface SupportState { error?: string; success?: string }

async function requestContext() {
  const h = await headers();
  assertSameOrigin(new Request("http://internal/action", { method: "POST", headers: h }));
  return { ip: clientIp(h) };
}
function failure(error: unknown): SupportState {
  if (error instanceof SupportError) return { error: error.message };
  if (error instanceof Error && error.name === "RateLimitError") return { error: "Terlalu sering. Tunggu sebentar lalu coba lagi." };
  throw error;
}

export async function createSupportAction(_state: SupportState, data: FormData): Promise<SupportState> {
  const { ip } = await requestContext();
  const viewer = await requireCustomer("/dashboard/bantuan");
  let id: string;
  try {
    await enforceRateLimit(`support-create:user:${viewer.user.id}`, 5, 3600);
    await enforceRateLimit(`support-create:ip:${ip}`, 20, 3600);
    id = await createSupportTicket(viewer.user.id, { subject: String(data.get("subject") ?? ""), body: String(data.get("body") ?? ""), orderId: String(data.get("orderId") ?? "") || null });
  } catch (error) { return failure(error); }
  revalidatePath("/dashboard/bantuan");
  redirect(`/dashboard/bantuan/${id}`);
}

export async function customerReplySupportAction(_state: SupportState, data: FormData): Promise<SupportState> {
  const { ip } = await requestContext();
  const viewer = await requireCustomer("/dashboard/bantuan");
  const id = String(data.get("ticketId") ?? "");
  try {
    await enforceRateLimit(`support-reply:user:${viewer.user.id}`, 20, 300);
    await enforceRateLimit(`support-reply:ip:${ip}`, 60, 300);
    await replySupportTicket(id, { id: viewer.user.id, staff: false }, String(data.get("body") ?? ""));
    return { success: "Balasan terkirim." };
  } catch (error) { return failure(error); }
}

export async function staffReplySupportAction(_state: SupportState, data: FormData): Promise<SupportState> {
  const { ip } = await requestContext();
  const viewer = await requirePermissionApi("orders.read");
  const id = String(data.get("ticketId") ?? "");
  try {
    await enforceRateLimit(`support-staff:${viewer.user.id}`, 40, 300);
    await replySupportTicket(id, { id: viewer.user.id, staff: true }, String(data.get("body") ?? ""));
    await writeAudit({ actor: { id: viewer.user.id, label: viewer.user.username }, action: "support.reply", targetType: "support_ticket", targetId: id, ip });
    return { success: "Balasan terkirim." };
  } catch (error) { return failure(error); }
}

export async function closeSupportAction(_state: SupportState, data: FormData): Promise<SupportState> {
  const { ip } = await requestContext();
  const viewer = await requirePermissionApi("orders.read");
  const id = String(data.get("ticketId") ?? "");
  try {
    await enforceRateLimit(`support-staff:${viewer.user.id}`, 40, 300);
    await closeSupportTicket(id);
    await writeAudit({ actor: { id: viewer.user.id, label: viewer.user.username }, action: "support.close", targetType: "support_ticket", targetId: id, ip });
    return { success: "Permintaan bantuan ditutup." };
  } catch (error) { return failure(error); }
}
