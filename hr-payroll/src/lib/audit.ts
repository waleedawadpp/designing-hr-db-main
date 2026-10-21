import "server-only";
import { prisma } from "./db";
import type { SessionUser } from "./session";

export async function audit(
  user: Pick<SessionUser, "email">,
  action: "create" | "update" | "delete",
  entity: string,
  entityId: string,
  summary: string,
  before?: unknown,
  after?: unknown,
) {
  await prisma.auditLog.create({
    data: {
      userEmail: user.email,
      action,
      entity,
      entityId,
      summary,
      before: before === undefined ? null : JSON.stringify(before),
      after: after === undefined ? null : JSON.stringify(after),
    },
  });
}
