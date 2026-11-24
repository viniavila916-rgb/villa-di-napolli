import { randomInt } from "node:crypto";
import { campaign } from "@/config/campaign";
import { db, isConnectionError, pgCode, withTimeout } from "./db";
import { cleanBroker } from "./format";
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

export type BrokerRow = { slug: string; name: string; active: boolean };

/** Corretores, bloqueios por corretor e vagas já ocupadas por corretor. */
async function loadBrokerState() {
  const sql = db();
  const [brokers, blocks, occupied] = await Promise.all([
    sql<BrokerRow[]>`select slug, name, active from brokers order by name`,
    sql<{ slot_id: string; broker_slug: string }[]>`
      select slot_id, broker_slug from broker_slot_blocks`,
    sql<{ slot_id: string; broker: string }[]>`
      select slot_id, broker from bookings
       where status <> 'cancelled' and broker is not null`,
  ]);
  return {
    brokers,
    blocks,
    blocked: new Set(blocks.map((k) => `${k.slot_id}|${k.broker_slug}`)),
    occupied: new Set(occupied.map((o) => `${o.slot_id}|${o.broker}`)),
  };
}

/**
 * Agenda pública: nunca expõe dados pessoais, só disponibilidade.
 * Com corretores cadastrados, a disponibilidade é a do corretor do link.
 * Não há distribuição: sem link de corretor, não há horários.
 */
export async function getPublicAgenda(brokerParam?: string | null): Promise<AgendaResponse> {
  const [rows, settings, state] = await Promise.all([loadSlots(), getSettings(), loadBrokerState()]);
  const ended = Date.now() >= Date.parse(settings.campaign_end_at);
  const bookingEnabled = settings.booking_enabled === "true" && !ended;

  const active = state.brokers.filter((b) => b.active);
  const brokerMode = active.length > 0;
  const wanted = cleanBroker(brokerParam);
  // Sem distribuição: vale o corretor do link; na falta dele, o "corretor
  // do link geral" definido no painel; sem nenhum dos dois, não há agenda.
  const mine = brokerMode
    ? (active.find((b) => b.slug === wanted) ??
      active.find((b) => b.slug === settings.default_broker) ??
      null)
    : null;
  const brokerRequired = brokerMode && !mine;

  const slots: PublicSlot[] = rows.map((r) => {
    let capacity = r.capacity;
    let remaining = Math.max(0, r.capacity - r.taken);
    if (brokerMode) {
      const free = active.filter(
        (b) => !state.blocked.has(`${r.id}|${b.slug}`) && !state.occupied.has(`${r.id}|${b.slug}`),
      );
      capacity = 1;
      remaining = mine && free.some((b) => b.slug === mine.slug) ? 1 : 0;
    }
    const state_ = r.is_past
      ? "past"
      : r.status === "open" && remaining > 0 && bookingEnabled
        ? "available"
        : "unavailable";
    return {
      id: r.id,
      date: r.date,
      start: r.start,
      end: r.end,
      state: state_,
      remaining: state_ === "available" ? remaining : 0,
      capacity,
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
    broker: mine ? { slug: mine.slug, name: mine.name } : null,
    brokerRequired,
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
      reason:
        | "slot_taken"
        | "slot_blocked"
        | "slot_past"
        | "slot_missing"
        | "duplicate_phone"
        | "closed"
        | "broker_required";
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
      if (code === "VN005") return { ok: false, reason: "broker_required" };
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
  /** Nome do corretor que vai atender (quando há corretores cadastrados). */
  broker_name: string | null;
};

export async function getBookingByToken(token: string): Promise<ConfirmedBooking | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const [row] = await db()<ConfirmedBooking[]>`
    select b.code, b.name, b.slot_date::text as date,
           to_char(b.start_time, 'HH24:MI') as start,
           to_char(b.end_time, 'HH24:MI')   as "end",
           b.status, k.name as broker_name
      from bookings b
      left join brokers k on k.slug = b.broker
     where b.public_token = ${token}`;
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
  broker_source: string | null;
  slot_id: string;
  created_at: string;
};

export async function getAdminData() {
  const sql = db();
  const [slots, bookings, units, settings, state] = await Promise.all([
    loadSlots(),
    sql<AdminBooking[]>`
      select id, code, name, whatsapp, email, income_range,
             slot_date::text as date, to_char(start_time, 'HH24:MI') as start,
             status, marketing_opt_in, utm_source, utm_campaign, broker, broker_source, slot_id,
             to_char(created_at at time zone ${campaign.timeZone}, 'DD/MM HH24:MI') as created_at
        from bookings
       order by slot_date, start_time, created_at`,
    sql<{ id: string; label: string; in_campaign: boolean; available: boolean }[]>`
      select id, label, in_campaign, available from campaign_units order by label`,
    getSettings(),
    loadBrokerState(),
  ]);
  return { slots, bookings, units, settings, brokers: state.brokers, brokerBlocks: state.blocks };
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
    if (code === "VN005") return { ok: false as const, message: "Esta reserva não tem corretor ativo. Reative o corretor antes." };
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

/* ------------------------------ Corretores ------------------------------ */

export async function addBroker(name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  const slug = cleanBroker(clean);
  if (slug.length < 2) return { ok: false as const, message: "Informe o nome do corretor." };
  await db()`
    insert into brokers (slug, name) values (${slug}, ${clean})
    on conflict (slug) do update set name = excluded.name, active = true`;
  return { ok: true as const, slug };
}

export async function setBrokerActive(slug: string, active: boolean) {
  await db()`update brokers set active = ${active} where slug = ${slug}`;
}

export async function deleteBroker(slug: string) {
  // As reservas já feitas continuam com o nome do corretor registrado.
  await db()`delete from brokers where slug = ${slug}`;
}

/** Marca (ou desmarca) um horário em que um corretor específico não atende. */
export async function setBrokerBlock(slotId: string, slug: string, blocked: boolean) {
  const sql = db();
  if (blocked) {
    await sql`
      insert into broker_slot_blocks (slot_id, broker_slug)
      select ${slotId}, ${slug}
       where exists (select 1 from brokers where slug = ${slug})
         and exists (select 1 from event_slots where id = ${slotId})
      on conflict do nothing`;
  } else {
    await sql`delete from broker_slot_blocks where slot_id = ${slotId} and broker_slug = ${slug}`;
  }
}

/**
 * Reserva com proteção contra falha de conexão. Se a conexão cair no meio,
 * não dá para saber se a reserva foi gravada; então primeiro procuramos a
 * reserva no banco e só tentamos gravar de novo se ela não existir.
 */
export async function createBookingSafely(input: BookingInput): Promise<BookingResult> {
  try {
    return await withTimeout(() => createBooking(input), 10000);
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    console.error("[agendar] falha de conexão; conferindo se a reserva foi gravada", err);
    const existing = await withTimeout(
      () => db()<{ public_token: string; code: string }[]>`
        select public_token, code from bookings
         where slot_id = ${input.slotId} and whatsapp = ${input.whatsapp}
           and status = 'confirmed' and created_at > now() - interval '2 minutes'`,
      8000,
    );
    if (existing[0]) return { ok: true, token: existing[0].public_token, code: existing[0].code };
    return withTimeout(() => createBooking(input), 10000);
  }
}
