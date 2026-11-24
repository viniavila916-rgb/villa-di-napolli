import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

/* ---------------- Limite de tentativas (anti-spam) ---------------- */

export function clientKey(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "desconhecido";
  const salt = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "vn";
  // Guardamos só um código embaralhado, nunca o IP em si.
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** true = pode seguir; false = passou do limite. */
export async function rateLimit(bucket: string, key: string, max: number, windowMin: number) {
  const sql = db();
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from request_log
     where bucket = ${bucket} and key_hash = ${key}
       and created_at > now() - make_interval(mins => ${windowMin})`;
  if (row.n >= max) return false;
  await sql`insert into request_log (bucket, key_hash) values (${bucket}, ${key})`;
  if (Math.random() < 0.02) {
    await sql`delete from request_log where created_at < now() - interval '2 days'`;
  }
  return true;
}

/* ---------------- Sessão do painel ---------------- */

const COOKIE = "vn_admin";
const SESSION_HOURS = 12;

export function adminEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8);
}

function secret() {
  return createHash("sha256")
    .update(`${process.env.ADMIN_PASSWORD}|${process.env.ADMIN_SESSION_SECRET ?? ""}`)
    .digest();
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function passwordMatches(input: string) {
  if (!adminEnabled()) return false;
  const h = (v: string) => createHash("sha256").update(v).digest("hex");
  return safeEqual(h(input), h(process.env.ADMIN_PASSWORD!));
}

export async function startAdminSession() {
  const exp = String(Date.now() + SESSION_HOURS * 3600_000);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  if (!adminEnabled()) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

/** Bloqueia chamadas vindas de outros sites (proteção CSRF simples). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
