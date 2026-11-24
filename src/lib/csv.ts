import { getAdminData } from "./schedule";
import { bookingStatusLabel } from "./types";

/** Monta a planilha (CSV) dos agendamentos — usada no painel e no Google Planilhas. */
export async function bookingsCsv() {
  const { bookings } = await getAdminData();
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    // Evita que a planilha interprete o texto como fórmula.
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  const header = [
    "Código", "Data", "Horário", "Nome", "WhatsApp", "E-mail", "Faixa de renda",
    "Situação", "Aceita novidades", "Corretor", "Origem", "Campanha", "Criado em",
  ];
  const lines = bookings.map((b) =>
    [
      b.code, b.date.split("-").reverse().join("/"), b.start, b.name, b.whatsapp, b.email,
      b.income_range, bookingStatusLabel[b.status], b.marketing_opt_in ? "Sim" : "Não",
      b.broker, b.utm_source, b.utm_campaign, b.created_at,
    ].map(cell).join(";"),
  );
  return "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
}
