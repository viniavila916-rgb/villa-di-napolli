import { randomInt } from "node:crypto";
import { campaign } from "@/config/campaign";
import { db, pgCode } from "./db";
import { getSettings } from "./settings";
import type { AgendaResponse, BookingStatus, PublicSlot } from "./types";

type SlotRow = {
  id: string;
  date: string;
  start: string;
  end: string;
  status: "open" | "blocked";
  capacity: number;
  taken: number;
  is_past: boolean;
};

async function loadSlots(): Promise<SlotRow[]> {
  return db()<SlotRow[]>`
    select s.id,
           s.slot_date::text                as date,
           to_char(s.start_time, 'HH24:MI') as start,
           to_char(s.end_time, 'HH24:MI')   as "end",
           s.status,
           s.capacity,
           count(b.id) filter (where b.status <> 'cancelled')::int as taken,
           ((s.slot_date + s.start_time) at time zone ${campaign.timeZone}) <= now() as is_past
      from event_slots s
      left join bookings b on b.slot_id = s.id
     where s.slot_date = any(${campaign.eventDates as unknown as string[]}::date[])
     group by s.id
     order by s.slot_date, s.start_time`;
}

/** Agenda pública: nunca expõe dados pessoais, só disponibilidade. */
export async function getPublicAgenda(): Promise<AgendaResponse> {
  const [rows, settings] = await Promise.all([loadSlots(), getSettings()]);
  const ended = Date.now() >= Date.parse(settings.campaign_end_at);
  const bookingEnabled = settings.booking_enabled === "true" && !ended;

  const slots: PublicSlot[] = rows.map((r) => {
    const remaining = Math.max(0, r.capacity - r.taken);
    const state = r.is_past
      ? "past"
      : r.status === "open" && remaining > 0 && bookingEnabled
        ? "available"
        : "unavailable";
    return {
      id: r.id,
      date: r.date,
      start: r.start,
      end: r.end,
      state,
      remaining: state === "available" ? remaining : 0,
      capacity: r.capacity,
    };
  });

  const availableByDate: Record<string, number> = {};
  for (const d of campaign.eventDates) availableByDate[d] = 0;
  for (const s of slots) if (s.state === "available") availableByDate[s.date] += 1;

  let units: AgendaResponse["units"] = null;
  if (settings.show_units_counter === "true") {
    const [u] = await db()<{ available: number; updated_at: Date | null }[]>`
      select count(*) filter (where in_campaign and available)::int as available,
             max(updated_at) as updated_at
        from campaign_units`;
    if (u && u.updated_at && u.available > 0) {
      units = { available: u.available, updatedAt: u.updated_at.toISOString() };
    }
  }

  return {
    configured: true,
    serverTime: new Date().toISOString(),
    campaignEndAt: settings.campaign_end_at,
    bookingEnabled,
    slots,
    availableByDate,
    units,
  };
}

export type BookingInput = {
  slotId: string;
  name: string;
  whatsapp: string;
  email: string | null;
  incomeRange: string | null;
  marketingOptIn: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  broker: string | null;
};

export type BookingResult =
  | { ok: true; token: string; code: string }
  | {
      ok: false;
      reason: "slot_taken" | "slot_blocked" | "slot_past" | "slot_missing" | "duplicate_phone" | "closed";
    };

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  let c = "";
  for (let i = 0; i < 5; i++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `VN-${c}`;
}

/**
 * Reserva um horário. A decisão é do banco: o INSERT dispara a regra
 * `enforce_slot_rules`, que trava o horário e confere capacidade,
 * bloqueio e data. O site só confirma se o INSERT der certo.
 */
export async function createBooking(input: BookingInput): Promise<BookingResult> {
  const settings = await getSettings();
  if (settings.booking_enabled !== "true" || Date.now() >= Date.parse(settings.campaign_end_at)) {
    return { ok: false, reason: "closed" };
  }
  const sql = db();
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const [row] = await sql<{ public_token: string; code: string }[]>`
        insert into bookings
          (code, slot_id, slot_date, start_time, end_time, name, whatsapp, email,
           income_range, privacy_consent_at, marketing_opt_in,
           utm_source, utm_medium, utm_campaign, broker)
        select ${newCode()}, s.id, s.slot_date, s.start_time, s.end_time,
               ${input.name}, ${input.whatsapp}, ${input.email},
               ${input.incomeRange}, now(), ${input.marketingOptIn},
               ${input.utmSource}, ${input.utmMedium}, ${input.utmCampaign}, ${input.broker}
          from event_slots s
         where s.id = ${input.slotId}
           and s.slot_date = any(${campaign.eventDates as unknown as string[]}::date[])
        returning public_token, code`;
      if (!row) return { ok: false, reason: "slot_missing" };
      return { ok: true, token: row.public_token, code: row.code };
    } catch (err) {
      const code = pgCode(err);
      if (code === "VN001") return { ok: false, reason: "slot_taken" };
      if (code === "VN002") return { ok: false, reason: "slot_blocked" };
      if (code === "VN003") return { ok: false, reason: "slot_past" };
      if (code === "VN404") return { ok: false, reason: "slot_missing" };
      if (code === "23505") {
        const constraint = String((err as { constraint_name?: string }).constraint_name ?? "");
        if (constraint.includes("whatsapp")) return { ok: false, reason: "duplicate_phone" };
        continue; // código de reserva repetido: sorteia outro
      }
      throw err;
    }
  }
  throw new Error("Não foi possível gerar o código da reserva");
}

export type ConfirmedBooking = {
  code: string;
  name: string;
  date: string;
  start: string;
  end: string;
  status: BookingStatus;
};

export async function getBookingByToken(token: string): Promise<ConfirmedBooking | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const [row] = await db()<ConfirmedBooking[]>`
    select code, name, slot_date::text as date,
           to_char(start_time, 'HH24:MI') as start,
           to_char(end_time, 'HH24:MI')   as "end",
           status
      from bookings where public_token = ${token}`;
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Painel administrativo                                               */
/* ------------------------------------------------------------------ */

export type AdminBooking = {
  id: string;
  code: string;
  name: string;
  whatsapp: string;
  email: string | null;
  income_range: string | null;
  date: string;
  start: string;
  status: BookingStatus;
  marketing_opt_in: boolean;
  utm_source: string | null;
  utm_campaign: string | null;
  broker: string | null;
  created_at: string;
};

export async function getAdminData() {
  const sql = db();
  const [slots, bookings, units, settings] = await Promise.all([
    loadSlots(),
    sql<AdminBooking[]>`
      select id, code, name, whatsapp, email, income_range,
             slot_date::text as date, to_char(start_time, 'HH24:MI') as start,
             status, marketing_opt_in, utm_source, utm_campaign, broker,
             to_char(created_at at time zone ${campaign.timeZone}, 'DD/MM HH24:MI') as created_at
        from bookings
       order by slot_date, start_time, created_at`,
    sql<{ id: string; label: string; in_campaign: boolean; available: boolean }[]>`
      select id, label, in_campaign, available from campaign_units order by label`,
    getSettings(),
  ]);
  return { slots, bookings, units, settings };
}

/** Cria vários horários de uma vez. Horários que já existem são mantidos. */
export async function generateSlots(opts: {
  date: string;
  from: string;
  to: string;
  durationMin: number;
  capacity: number;
}) {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const toStr = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const rows: { slot_date: string; start_time: string; end_time: string; capacity: number }[] = [];
  for (let t = toMin(opts.from); t + opts.durationMin <= toMin(opts.to); t += opts.durationMin) {
    rows.push({
      slot_date: opts.date,
      start_time: toStr(t),
      end_time: toStr(t + opts.durationMin),
      capacity: opts.capacity,
    });
  }
  if (rows.length === 0) return 0;
  if (rows.length > 200) throw new Error("Muitos horários de uma vez");
  const sql = db();
  const inserted = await sql`
    insert into event_slots ${sql(rows, "slot_date", "start_time", "end_time", "capacity")}
    on conflict (slot_date, start_time) do nothing
    returning id`;
  return inserted.length;
}

export async function setSlotStatus(id: string, status: "open" | "blocked") {
  await db()`update event_slots set status = ${status} where id = ${id}`;
}

export async function setSlotCapacity(id: string, capacity: number) {
  const sql = db();
  const [row] = await sql<{ taken: number }[]>`
    select count(*)::int as taken from bookings where slot_id = ${id} and status <> 'cancelled'`;
  if (row && capacity < row.taken) {
    return { ok: false as const, message: `Este horário já tem ${row.taken} reserva(s).` };
  }
  await sql`update event_slots set capacity = ${capacity} where id = ${id}`;
  return { ok: true as const };
}

export async function deleteSlot(id: string) {
  try {
    await db()`delete from event_slots where id = ${id}`;
    return { ok: true as const };
  } catch (err) {
    if (pgCode(err) === "23503") {
      return {
        ok: false as const,
        message: "Este horário tem reservas no histórico. Use Bloquear em vez de excluir.",
      };
    }
    throw err;
  }
}

export async function setBookingStatus(id: string, status: BookingStatus) {
  try {
    await db()`update bookings set status = ${status} where id = ${id}`;
    return { ok: true as const };
  } catch (err) {
    const code = pgCode(err);
    if (code === "VN001") return { ok: false as const, message: "O horário já foi ocupado por outra reserva." };
    if (code === "VN002") return { ok: false as const, message: "O horário está bloqueado. Libere-o antes." };
    if (code === "VN003") return { ok: false as const, message: "O horário já passou." };
    if (code === "23505") return { ok: false as const, message: "Este WhatsApp já tem outra reserva confirmada." };
    throw err;
  }
}

export async function addUnits(labels: string[]) {
  if (labels.length === 0) return 0;
  const sql = db();
  const rows = labels.map((label) => ({ label }));
  const res = await sql`
    insert into campaign_units ${sql(rows, "label")}
    on conflict (label) do nothing returning id`;
  return res.length;
}

export async function updateUnit(id: string, patch: { available?: boolean; in_campaign?: boolean }) {
  const sql = db();
  if (typeof patch.available === "boolean") {
    await sql`update campaign_units set available = ${patch.available}, updated_at = now() where id = ${id}`;
  }
  if (typeof patch.in_campaign === "boolean") {
    await sql`update campaign_units set in_campaign = ${patch.in_campaign}, updated_at = now() where id = ${id}`;
  }
}

export async function deleteUnit(id: string) {
  await db()`delete from campaign_units where id = ${id}`;
}
