import { NextResponse } from "next/server";
import { getAdminData } from "@/lib/schedule";
import { isAdmin } from "@/lib/security";
import { bookingStatusLabel } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Planilha (CSV) dos agendamentos — abre direto no Excel. */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const { bookings } = await getAdminData();
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    // Evita que o Excel interprete o texto como fórmula.
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  const header = [
    "Código", "Data", "Horário", "Nome", "WhatsApp", "E-mail", "Faixa de renda",
    "Situação", "Aceita novidades", "Origem", "Campanha", "Criado em",
  ];
  const lines = bookings.map((b) =>
    [
      b.code, b.date.split("-").reverse().join("/"), b.start, b.name, b.whatsapp, b.email,
      b.income_range, bookingStatusLabel[b.status], b.marketing_opt_in ? "Sim" : "Não",
      b.utm_source, b.utm_campaign, b.created_at,
    ].map(cell).join(";"),
  );
  const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="agendamentos-black-november.csv"',
      "Cache-Control": "no-store",
    },
  });
}
