import { NextResponse } from "next/server";
import { DbTimeoutError, isDbConfigured, pgCode, readWithRetry } from "@/lib/db";
import { getAdminData } from "@/lib/schedule";
import { adminEnabled, isAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!adminEnabled()) {
    return NextResponse.json(
      { ok: false, error: "disabled", message: "Painel desativado: defina a variável ADMIN_PASSWORD (mínimo 8 caracteres)." },
      { status: 503 },
    );
  }
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  if (!isDbConfigured()) {
    return NextResponse.json(
      { ok: false, error: "db", message: "Banco de dados não conectado: defina a variável DATABASE_URL." },
      { status: 503 },
    );
  }
  try {
    const data = await readWithRetry(getAdminData);
    return NextResponse.json(
      {
        ok: true,
        ...data,
        integrations: {
          gtm: Boolean(process.env.NEXT_PUBLIC_GTM_ID),
          ga4: Boolean(process.env.NEXT_PUBLIC_GA4_ID),
          metaPixel: Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID),
          siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[admin] erro ao carregar dados", err);
    const code = pgCode(err) ?? "";
    // Mensagem específica para cada causa, para o conserto ser direto.
    const message =
      err instanceof DbTimeoutError || code === "CONNECT_TIMEOUT"
        ? "O banco de dados não respondeu. Confira no Supabase se o projeto está ativo (não pausado) e se a DATABASE_URL é a do Transaction pooler (porta 6543)."
        : code === "42703" || code === "42P01"
          ? "O banco está com a estrutura antiga. Abra o SQL Editor do Supabase, cole todo o arquivo db/schema.sql e clique em Run. Nenhum dado é apagado."
          : code === "28P01" || code === "28000"
            ? "A senha do banco na DATABASE_URL está incorreta. Copie de novo o endereço no Supabase (botão Connect) e atualize a variável na Vercel."
            : `Não foi possível ler o banco de dados${code ? ` (código ${code})` : ""}. Confira a variável DATABASE_URL.`;
    return NextResponse.json({ ok: false, error: "db", message }, { status: 500 });
  }
}
