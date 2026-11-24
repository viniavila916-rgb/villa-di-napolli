import { campaign } from "@/config/campaign";

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-11-27" -> partes, sem depender do fuso do aparelho. */
export function parseDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday };
}

export function weekdayName(iso: string) {
  return WEEKDAYS[parseDate(iso).weekday];
}
export function weekdayShort(iso: string) {
  return WEEKDAYS_SHORT[parseDate(iso).weekday];
}
/** "27/11" */
export function dayMonth(iso: string) {
  const { d, m } = parseDate(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}
/** "sexta-feira, 27 de novembro de 2026" */
export function longDate(iso: string) {
  const { d, m, y } = parseDate(iso);
  return `${weekdayName(iso)}, ${d} de ${MONTHS[m - 1]} de ${y}`;
}
export function monthName(month: number) {
  return MONTHS[month - 1];
}

/** Instante real (UTC) de uma data + hora no horário de Brasília. */
export function slotInstant(date: string, time: string) {
  return new Date(`${date}T${time.length === 5 ? time + ":00" : time}${campaign.utcOffset}`);
}

/** Link "Adicionar ao Google Agenda" com a data e a hora reservadas. */
export function googleCalendarUrl(opts: {
  date: string;
  start: string;
  end: string;
  title: string;
  details: string;
  location: string;
}) {
  const fmt = (t: string) => `${opts.date.replaceAll("-", "")}T${t.replace(":", "")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(opts.start)}/${fmt(opts.end)}`,
    ctz: campaign.timeZone,
    details: opts.details,
  });
  if (opts.location) params.set("location", opts.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
