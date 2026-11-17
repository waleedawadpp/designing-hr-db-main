import "server-only";
import { prisma } from "./db";
import { audit } from "./audit";

/** يحفظ رمز يوم في سطر حضور ويسجّله في سجل التدقيق. يعيد true إن تغيّر شيء. */
export async function setAttendanceCode(monthId: string, day: number, code: string | null, user: { email: string }) {
  const existing = await prisma.attendanceDay.findUnique({ where: { monthId_day: { monthId, day } } });
  if ((existing?.code ?? null) === code) return false;
  await prisma.attendanceDay.upsert({
    where: { monthId_day: { monthId, day } },
    update: { code },
    create: { monthId, day, code },
  });
  await audit(user, "update", "AttendanceDay", `${monthId}:${day}`, `يوم ${day}: ${existing?.code ?? "فارغ"} ← ${code ?? "فارغ"}`, existing?.code ?? null, code);
  return true;
}
