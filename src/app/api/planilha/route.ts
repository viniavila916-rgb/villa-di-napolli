import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { bookingsCsv } from "@/lib/csv";
import { isDbConfigured, readWithRetry } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Entrega os agendamentos para o Google Planilhas atualizar sozinho.
 * Só responde com a chave secreta definida em PLANILHA_KEY
 * (mínimo 20 caracteres). Sem a variável, este endereço fica desligado.
 */
export async function GET(req: Request) {
  const expected = process.env.PLANILHA_KEY ?? "";
  if (expected.length < 20 || !isDbConfigured()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const given = new URL(req.url).searchParams.get("chave") ?? "";
  const h = (v: string) => createHash("sha256").update(v).digest();
  if (!timingSafeEqual(h(given), h(expected))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    return new NextResponse(await readWithRetry(bookingsCsv), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (err) {
    console.error("[planilha] erro ao gerar", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
