import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import {
  adminEnabled,
  clientKey,
  passwordMatches,
  rateLimit,
  sameOrigin,
  startAdminSession,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  if (!adminEnabled()) {
    return NextResponse.json(
      { ok: false, message: "Painel desativado: defina a variável ADMIN_PASSWORD (mínimo 8 caracteres)." },
      { status: 503 },
    );
  }
  if (isDbConfigured()) {
    try {
      if (!(await rateLimit("admin_login", clientKey(req), 8, 15))) {
        return NextResponse.json(
          { ok: false, message: "Muitas tentativas. Aguarde 15 minutos." },
          { status: 429 },
        );
      }
    } catch (err) {
      console.error("[admin] limite de tentativas indisponível", err);
    }
  }
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (typeof body.password !== "string" || !passwordMatches(body.password)) {
    return NextResponse.json({ ok: false, message: "Senha incorreta." }, { status: 401 });
  }
  await startAdminSession();
  return NextResponse.json({ ok: true });
}
