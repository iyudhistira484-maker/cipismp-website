import { db } from "./db";
import { auditLogs } from "./db/schema";
import { ids } from "./ids";
import { logger } from "./logger";

export interface AuditActor {
  id: string | null;
  label: string;
}

export interface AuditInput {
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Setiap aksi admin wajib tercatat: siapa, apa, nilai sebelum/sesudah, IP. */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: ids.audit(),
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      reason: input.reason ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (error) {
    logger.error("audit_write_failed", { action: input.action, error: (error as Error).message });
  }
}
