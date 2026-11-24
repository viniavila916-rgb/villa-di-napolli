import { NextResponse } from "next/server";
import { z } from "zod";
import { campaign } from "@/config/campaign";
import {
  addBroker,
  addUnits,
  deleteBroker,
  setBrokerActive,
  setBrokerBlock,
  deleteSlot,
  deleteUnit,
  generateSlots,
  setBookingStatus,
  setSlotCapacity,
  setSlotStatus,
  updateUnit,
} from "@/lib/schedule";
import { isAdmin, sameOrigin } from "@/lib/security";
import { safeUrl, saveSettings, settingKeys, type Settings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const eventDate = z.enum(campaign.eventDates as unknown as [string, ...string[]]);

const action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate_slots"),
    date: eventDate,
    from: time,
    to: time,
    durationMin: z.number().int().min(5).max(480),
    capacity: z.number().int().min(1).max(50),
  }),
  z.object({ action: z.literal("slot_status"), id: z.uuid(), status: z.enum(["open", "blocked"]) }),
  z.object({ action: z.literal("slot_capacity"), id: z.uuid(), capacity: z.number().int().min(1).max(50) }),
  z.object({ action: z.literal("slot_delete"), id: z.uuid() }),
  z.object({
    action: z.literal("booking_status"),
    id: z.uuid(),
    status: z.enum(["confirmed", "attended", "no_show", "cancelled"]),
  }),
  z.object({ action: z.literal("units_add"), labels: z.array(z.string().trim().min(1).max(40)).max(500) }),
  z.object({
    action: z.literal("unit_update"),
    id: z.uuid(),
    available: z.boolean().optional(),
    in_campaign: z.boolean().optional(),
  }),
  z.object({ action: z.literal("unit_delete"), id: z.uuid() }),
  z.object({ action: z.literal("broker_add"), name: z.string().trim().min(2).max(60) }),
  z.object({ action: z.literal("broker_active"), slug: z.string().min(2).max(40), active: z.boolean() }),
  z.object({ action: z.literal("broker_delete"), slug: z.string().min(2).max(40) }),
  z.object({
    action: z.literal("broker_block"),
    slotId: z.uuid(),
    slug: z.string().min(2).max(40),
    blocked: z.boolean(),
  }),
  z.object({ action: z.literal("settings_save"), values: z.record(z.string(), z.string().max(600)) }),
]);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Dados inválidos. Confira os campos." }, { status: 400 });
  }
  const a = parsed.data;

  try {
    switch (a.action) {
      case "generate_slots": {
        if (a.to <= a.from) {
          return NextResponse.json({ ok: false, message: "O horário final precisa ser depois do inicial." }, { status: 400 });
        }
        const created = await generateSlots(a);
        return NextResponse.json({ ok: true, message: `${created} horário(s) criado(s).` });
      }
      case "slot_status":
        await setSlotStatus(a.id, a.status);
        return NextResponse.json({ ok: true });
      case "slot_capacity": {
        const r = await setSlotCapacity(a.id, a.capacity);
        return NextResponse.json(r, { status: r.ok ? 200 : 409 });
      }
      case "slot_delete": {
        const r = await deleteSlot(a.id);
        return NextResponse.json(r, { status: r.ok ? 200 : 409 });
      }
      case "booking_status": {
        const r = await setBookingStatus(a.id, a.status);
        return NextResponse.json(r, { status: r.ok ? 200 : 409 });
      }
      case "units_add": {
        const created = await addUnits([...new Set(a.labels)]);
        return NextResponse.json({ ok: true, message: `${created} unidade(s) adicionada(s).` });
      }
      case "unit_update":
        await updateUnit(a.id, a);
        return NextResponse.json({ ok: true });
      case "unit_delete":
        await deleteUnit(a.id);
        return NextResponse.json({ ok: true });
      case "broker_add": {
        const r = await addBroker(a.name);
        return NextResponse.json(r, { status: r.ok ? 200 : 400 });
      }
      case "broker_active":
        await setBrokerActive(a.slug, a.active);
        return NextResponse.json({ ok: true });
      case "broker_delete":
        await deleteBroker(a.slug);
        return NextResponse.json({ ok: true });
      case "broker_block":
        await setBrokerBlock(a.slotId, a.slug, a.blocked);
        return NextResponse.json({ ok: true });
      case "settings_save": {
        const values: Partial<Settings> = {};
        for (const key of settingKeys) {
          if (typeof a.values[key] === "string") values[key] = a.values[key].trim();
        }
        for (const key of ["plantao_maps_url", "whatsapp_group_url"] as const) {
          if (values[key]) {
            values[key] = safeUrl(values[key]!);
            if (!values[key]) {
              return NextResponse.json({ ok: false, message: "Use um link completo, começando com https://" }, { status: 400 });
            }
          }
        }
        if (values.campaign_end_at !== undefined && Number.isNaN(Date.parse(values.campaign_end_at))) {
          return NextResponse.json({ ok: false, message: "Data de encerramento inválida." }, { status: 400 });
        }
        await saveSettings(values);
        return NextResponse.json({ ok: true, message: "Configurações salvas." });
      }
    }
  } catch (err) {
    console.error("[admin] erro na ação", a.action, err);
    return NextResponse.json({ ok: false, message: "Erro ao salvar. Tente novamente." }, { status: 500 });
  }
}
