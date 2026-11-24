import { campaign } from "@/config/campaign";
import { db } from "./db";

/** Configurações editáveis pelo painel, com seus valores padrão. */
export const settingDefaults = {
  plantao_address: "",
  plantao_maps_url: "",
  plantao_guidance:
    "Chegue com 10 minutos de antecedência e traga um documento com foto. Se puder, traga também quem participa da decisão com você.",
  whatsapp_group_url: "",
  whatsapp_is_group: "true",
  campaign_end_at: campaign.defaultEndAt,
  booking_enabled: "true",
  show_units_counter: "false",
  company_legal_name: "",
  company_cnpj: "",
  privacy_contact_email: "",
} as const;

export type SettingKey = keyof typeof settingDefaults;
export type Settings = Record<SettingKey, string>;

export const settingKeys = Object.keys(settingDefaults) as SettingKey[];

export async function getSettings(): Promise<Settings> {
  const rows = await db()<{ key: string; value: string }[]>`
    select key, value from settings`;
  const out: Settings = { ...settingDefaults };
  for (const r of rows) {
    if ((settingKeys as string[]).includes(r.key)) out[r.key as SettingKey] = r.value;
  }
  // Data inválida nunca derruba o contador: volta ao padrão.
  if (Number.isNaN(Date.parse(out.campaign_end_at))) {
    out.campaign_end_at = campaign.defaultEndAt;
  }
  return out;
}

export async function saveSettings(values: Partial<Settings>) {
  const sql = db();
  for (const key of settingKeys) {
    const value = values[key];
    if (typeof value !== "string") continue;
    await sql`
      insert into settings (key, value, updated_at) values (${key}, ${value}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
  }
}

/** Só aceita links http(s); qualquer outra coisa vira vazio. */
export function safeUrl(value: string): string {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}
