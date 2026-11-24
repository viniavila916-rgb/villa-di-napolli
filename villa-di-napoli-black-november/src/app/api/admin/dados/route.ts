import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
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
    const data = await getAdminData();
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
    return NextResponse.json(
      { ok: false, error: "db", message: "Não foi possível ler o banco. Confira se o arquivo db/schema.sql foi executado." },
      { status: 500 },
    );
  }
}
