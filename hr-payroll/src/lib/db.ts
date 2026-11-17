import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

// على Hostinger قد يشير DATABASE_URL إلى localhost، وقد يُحلّ في Node إلى IPv6 (::1)
// فلا يقبله مستخدم MySQL؛ نستخدم 127.0.0.1 بدلًا منه.
const url = process.env.DATABASE_URL?.startsWith("mysql") ? process.env.DATABASE_URL.replace("@localhost:", "@127.0.0.1:") : undefined;

export const prisma = g.prisma ?? new PrismaClient(url ? { datasourceUrl: url } : undefined);
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
