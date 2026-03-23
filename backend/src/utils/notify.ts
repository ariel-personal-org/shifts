import { db } from '../db';
import { notifications, auditLogs } from '../db/schema';

export async function createNotification(params: {
  user_id: number;
  type: string;
  payload?: Record<string, unknown>;
}) {
  await db.insert(notifications).values({
    user_id: params.user_id,
    type: params.type,
    payload_json: params.payload ?? null,
    is_read: false,
  });
}

export async function createAuditLog(params: {
  actor_user_id?: number | null;
  affected_user_id?: number | null;
  schedule_id?: number | null;
  shift_id?: number | null;
  action: string;
  old_value?: unknown;
  new_value?: unknown;
}) {
  await db.insert(auditLogs).values({
    actor_user_id: params.actor_user_id ?? null,
    affected_user_id: params.affected_user_id ?? null,
    schedule_id: params.schedule_id ?? null,
    shift_id: params.shift_id ?? null,
    action: params.action,
    old_value_json: params.old_value ?? null,
    new_value_json: params.new_value ?? null,
  });
}
