"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { campaign } from "@/config/campaign";
import { dayMonth, weekdayName } from "@/lib/dates";
import { maskPhone } from "@/lib/format";
import { bookingStatusLabel, type BookingStatus } from "@/lib/types";

type Slot = {
  id: string;
  date: string;
  start: string;
  end: string;
  status: "open" | "blocked";
  capacity: number;
  taken: number;
  is_past: boolean;
};
type Booking = {
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
  created_at: string;
};
type Unit = { id: string; label: string; in_campaign: boolean; available: boolean };
type Data = {
  slots: Slot[];
  bookings: Booking[];
  units: Unit[];
  settings: Record<string, string>;
  integrations: { gtm: boolean; ga4: boolean; metaPixel: boolean; siteUrl: boolean };
};

type View = "loading" | "login" | "panel" | "blocked";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dayLabel = (d: string) => `${cap(weekdayName(d))}, ${dayMonth(d)}`;

const input =
  "min-h-11 w-full rounded-lg border border-[#cfc8b6] bg-white px-3 py-2 text-base text-text";
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50";
const btnDark = `${btn} bg-ink text-paper`;
const btnLine = `${btn} border border-[#cfc8b6] bg-white text-text`;

export function AdminPanel() {
  const [view, setView] = useState<View>("loading");
  const [blockedMsg, setBlockedMsg] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"agendamentos" | "horarios" | "unidades" | "config">("agendamentos");
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/dados", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) return setView("login");
    if (!res.ok) {
      setBlockedMsg(json.message || "Painel indisponível.");
      return setView("blocked");
    }
    setData(json as Data);
    setView("panel");
  }, []);

  useEffect(() => {
    // Busca inicial dos dados; o estado só muda depois da resposta do servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const act = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      setFlash(null);
      try {
        const res = await fetch("/api/admin/acao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setView("login");
          return false;
        }
        if (json.message || !res.ok) {
          setFlash({ ok: res.ok, text: json.message || "Não foi possível salvar." });
        }
        await load();
        return res.ok;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  if (view === "loading") return <Shell><p>Carregando…</p></Shell>;
  if (view === "blocked")
    return (
      <Shell>
        <h1 className="text-3xl">Painel indisponível</h1>
        <p className="mt-3 rounded-xl bg-white p-4">{blockedMsg}</p>
        <p className="mt-3 text-sm text-muted">Veja o passo a passo no arquivo GUIA-DE-PUBLICACAO.md.</p>
      </Shell>
    );
  if (view === "login") return <Login onDone={load} />;
  if (!data) return null;

  const tabs: [typeof tab, string][] = [
    ["agendamentos", `Agendamentos (${data.bookings.filter((b) => b.status !== "cancelled").length})`],
    ["horarios", `Horários (${data.slots.length})`],
    ["unidades", `Unidades (${data.units.length})`],
    ["config", "Configurações"],
  ];

  return (
    <Shell wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Painel do plantão</h1>
        <div className="flex gap-2">
          <button className={btnLine} onClick={load} disabled={busy}>
            Atualizar
          </button>
          <button
            className={btnLine}
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              setView("login");
            }}
          >
            Sair
          </button>
        </div>
      </div>

      <Pendencias data={data} />

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Seções do painel">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setFlash(null);
            }}
            aria-current={tab === key}
            className={`${btn} ${tab === key ? "bg-ink text-paper" : "border border-[#cfc8b6] bg-white"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {flash && (
        <p
          role="status"
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
            flash.ok ? "bg-ok-wash text-ok-deep" : "bg-[#fbeeea] text-warn"
          }`}
        >
          {flash.text}
        </p>
      )}

      <div className="mt-6">
        {tab === "agendamentos" && <Agendamentos data={data} act={act} busy={busy} />}
        {tab === "horarios" && <Horarios data={data} act={act} busy={busy} />}
        {tab === "unidades" && <Unidades data={data} act={act} busy={busy} />}
        {tab === "config" && <Config data={data} act={act} busy={busy} />}
      </div>
    </Shell>
  );
}

function Shell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="on-paper min-h-dvh bg-paper px-4 py-8 text-text sm:px-6">
      <div className={`mx-auto ${wide ? "max-w-6xl" : "max-w-md"}`}>{children}</div>
    </main>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) onDone();
    else setError(json.message || "Não foi possível entrar.");
  }
  return (
    <Shell>
      <h1 className="text-3xl">Painel do plantão</h1>
      <p className="mt-2 text-muted">Área restrita à equipe da {campaign.builder}.</p>
      <form onSubmit={submit} className="mt-6 grid gap-3 rounded-2xl bg-white p-5">
        <label htmlFor="adm-pass" className="text-sm font-semibold">
          Senha
        </label>
        <input
          id="adm-pass"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
        {error && <p role="alert" className="text-sm text-warn">{error}</p>}
        <button className={btnDark} disabled={busy || !password}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </Shell>
  );
}

/** Lista o que ainda falta configurar antes de divulgar a página. */
function Pendencias({ data }: { data: Data }) {
  const s = data.settings;
  const items: string[] = [];
  if (data.slots.length === 0) items.push("Cadastrar os horários reais do plantão (aba Horários).");
  if (!s.plantao_address) items.push("Informar o endereço do plantão (aba Configurações).");
  if (!s.whatsapp_group_url) items.push("Informar o link da Lista VIP do WhatsApp (aba Configurações).");
  if (!s.company_cnpj || !s.privacy_contact_email)
    items.push("Preencher CNPJ e e-mail de contato da política de privacidade (aba Configurações).");
  if (!data.integrations.siteUrl) items.push("Definir o endereço do site na variável NEXT_PUBLIC_SITE_URL.");
  if (!data.integrations.gtm && !data.integrations.ga4 && !data.integrations.metaPixel)
    items.push("Nenhuma ferramenta de medição configurada (GTM, GA4 ou Meta Pixel).");
  if (items.length === 0) return null;
  return (
    <section className="mt-5 rounded-2xl border border-[#e2c27a] bg-[#fdf6e3] p-5">
      <h2 className="text-xl">Pendências antes de divulgar</h2>
      <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

type TabProps = { data: Data; act: (p: Record<string, unknown>) => Promise<boolean>; busy: boolean };

/* ------------------------------ Agendamentos ------------------------------ */
function Agendamentos({ data, act, busy }: TabProps) {
  const [day, setDay] = useState<string>("todos");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.bookings.filter(
      (b) =>
        (day === "todos" || b.date === day) &&
        (!term ||
          b.name.toLowerCase().includes(term) ||
          b.whatsapp.includes(term.replace(/\D/g, "") || "§") ||
          b.code.toLowerCase().includes(term)),
    );
  }, [data.bookings, day, q]);

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-3">
        {campaign.eventDates.map((d) => {
          const slots = data.slots.filter((s) => s.date === d);
          const active = data.bookings.filter((b) => b.date === d && b.status !== "cancelled").length;
          const free = slots.filter((s) => s.status === "open" && !s.is_past && s.taken < s.capacity).length;
          return (
            <div key={d} className="rounded-2xl bg-white p-4">
              <p className="text-sm text-muted">{dayLabel(d)}</p>
              <p className="mt-1 font-display text-3xl">{active} reservas</p>
              <p className="text-sm text-ok-deep">{free} horários livres</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Dia
          <select value={day} onChange={(e) => setDay(e.target.value)} className={input}>
            <option value="todos">Todos os dias</option>
            {campaign.eventDates.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid flex-1 gap-1 text-sm font-semibold">
          Buscar por nome, telefone ou código
          <input value={q} onChange={(e) => setQ(e.target.value)} className={input} />
        </label>
        <a href="/api/admin/exportar" className={btnDark}>
          Baixar planilha (CSV)
        </a>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-paper-2 text-muted">
            <tr>
              {["Dia e hora", "Nome", "WhatsApp", "Renda / e-mail", "Origem", "Situação"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Nenhum agendamento encontrado.
                </td>
              </tr>
            )}
            {list.map((b) => (
              <tr key={b.id} className={`border-b border-paper-2 last:border-0 ${b.status === "cancelled" ? "opacity-55" : ""}`}>
                <td className="px-4 py-3 font-semibold whitespace-nowrap">
                  {dayMonth(b.date)} às {b.start}
                  <span className="block text-xs font-normal text-muted">{b.code}</span>
                </td>
                <td className="px-4 py-3">
                  {b.name}
                  <span className="block text-xs text-muted">Reservou em {b.created_at}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <a
                    className="font-semibold text-ok-deep underline underline-offset-2"
                    href={`https://wa.me/55${b.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {maskPhone(b.whatsapp)}
                  </a>
                  {b.marketing_opt_in && <span className="block text-xs text-muted">Aceita novidades</span>}
                </td>
                <td className="px-4 py-3">
                  {b.income_range || "—"}
                  {b.email && <span className="block text-xs text-muted">{b.email}</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {b.utm_source || "—"}
                  {b.utm_campaign && <span className="block">{b.utm_campaign}</span>}
                </td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`Situação de ${b.name}`}
                    value={b.status}
                    disabled={busy}
                    onChange={(e) => act({ action: "booking_status", id: b.id, status: e.target.value })}
                    className="min-h-10 rounded-lg border border-[#cfc8b6] bg-white px-2"
                  >
                    {(Object.keys(bookingStatusLabel) as BookingStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {bookingStatusLabel[s]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted">
        Ao marcar como Cancelado, o horário volta a ficar disponível na página automaticamente.
      </p>
    </section>
  );
}

/* -------------------------------- Horários -------------------------------- */
function Horarios({ data, act, busy }: TabProps) {
  const [form, setForm] = useState({
    date: campaign.eventDates[0] as string,
    from: "",
    to: "",
    durationMin: "",
    capacity: "1",
  });
  const valid = form.from && form.to && Number(form.durationMin) >= 5 && Number(form.capacity) >= 1;

  return (
    <section>
      <form
        className="grid gap-3 rounded-2xl bg-white p-5 sm:grid-cols-6 sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          await act({
            action: "generate_slots",
            date: form.date,
            from: form.from,
            to: form.to,
            durationMin: Number(form.durationMin),
            capacity: Number(form.capacity),
          });
        }}
      >
        <h2 className="text-xl sm:col-span-6">Criar horários</h2>
        <p className="-mt-2 text-sm text-muted sm:col-span-6">
          Exemplo: das 09:00 às 12:00, com 30 minutos por atendimento, cria 6 horários. Para ter
          intervalo de almoço, crie a manhã e a tarde separadamente.
        </p>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
          Dia
          <select value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input}>
            {campaign.eventDates.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Das
          <input type="time" required value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className={input} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Até
          <input type="time" required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className={input} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Minutos por atendimento
          <input type="number" min={5} max={480} required value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} className={input} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Atendimentos ao mesmo tempo
          <input type="number" min={1} max={50} required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className={input} />
        </label>
        <button className={`${btnDark} sm:col-span-6 sm:justify-self-start`} disabled={busy || !valid}>
          Criar horários
        </button>
      </form>

      {campaign.eventDates.map((d) => {
        const slots = data.slots.filter((s) => s.date === d);
        return (
          <div key={d} className="mt-6">
            <h2 className="text-xl">{dayLabel(d)}</h2>
            {slots.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nenhum horário cadastrado para este dia.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-2xl bg-white">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-paper-2 text-muted">
                    <tr>
                      {["Horário", "Situação na página", "Reservas", "Vagas no horário", "Ações"].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((s) => {
                      const full = s.taken >= s.capacity;
                      const label = s.is_past
                        ? "Encerrado"
                        : s.status === "blocked"
                          ? "Bloqueado"
                          : full
                            ? "Ocupado"
                            : "Disponível";
                      return (
                        <tr key={s.id} className="border-b border-paper-2 last:border-0">
                          <td className="px-4 py-2.5 font-semibold whitespace-nowrap">
                            {s.start} – {s.end}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                label === "Disponível" ? "bg-ok-wash text-ok-deep" : "bg-paper-2 text-muted"
                              }`}
                            >
                              {label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">{s.taken}</td>
                          <td className="px-4 py-2.5">
                            <select
                              aria-label={`Vagas do horário ${s.start}`}
                              value={s.capacity}
                              disabled={busy}
                              onChange={(e) => act({ action: "slot_capacity", id: s.id, capacity: Number(e.target.value) })}
                              className="min-h-10 rounded-lg border border-[#cfc8b6] bg-white px-2"
                            >
                              {Array.from({ length: Math.max(10, s.capacity) }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-2">
                              <button
                                className={btnLine}
                                disabled={busy}
                                onClick={() =>
                                  act({ action: "slot_status", id: s.id, status: s.status === "open" ? "blocked" : "open" })
                                }
                              >
                                {s.status === "open" ? "Bloquear" : "Liberar"}
                              </button>
                              {s.taken === 0 && (
                                <button className={btnLine} disabled={busy} onClick={() => act({ action: "slot_delete", id: s.id })}>
                                  Excluir
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

/* -------------------------------- Unidades -------------------------------- */
function Unidades({ data, act, busy }: TabProps) {
  const [text, setText] = useState("");
  const showing = data.settings.show_units_counter === "true";
  const count = data.units.filter((u) => u.in_campaign && u.available).length;
  return (
    <section className="grid gap-5">
      <div className="rounded-2xl bg-white p-5">
        <h2 className="text-xl">Contador de unidades na página</h2>
        <p className="mt-1 text-sm text-muted">
          Mostra na página quantas unidades participantes ainda estão disponíveis. Ligue somente se
          esta lista estiver sempre atualizada. Hoje: <strong>{count}</strong> disponíveis.
        </p>
        <button
          className={`${showing ? btnLine : btnDark} mt-3`}
          disabled={busy}
          onClick={() => act({ action: "settings_save", values: { show_units_counter: showing ? "false" : "true" } })}
        >
          {showing ? "Desligar contador (está visível)" : "Ligar contador (está oculto)"}
        </button>
      </div>

      <form
        className="rounded-2xl bg-white p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const labels = text.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);
          if (await act({ action: "units_add", labels })) setText("");
        }}
      >
        <h2 className="text-xl">Adicionar unidades participantes</h2>
        <label htmlFor="units-text" className="mt-1 block text-sm text-muted">
          Uma unidade por linha, com o nome que a equipe usa (por exemplo, bloco e número).
        </label>
        <textarea id="units-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} className={`${input} mt-2`} />
        <button className={`${btnDark} mt-3`} disabled={busy || !text.trim()}>
          Adicionar
        </button>
      </form>

      {data.units.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-paper-2 text-muted">
              <tr>
                {["Unidade", "Participa da campanha", "Disponível", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.units.map((u) => (
                <tr key={u.id} className="border-b border-paper-2 last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{u.label}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`${u.label} participa da campanha`}
                      className="size-5"
                      checked={u.in_campaign}
                      disabled={busy}
                      onChange={(e) => act({ action: "unit_update", id: u.id, in_campaign: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`${u.label} disponível`}
                      className="size-5"
                      checked={u.available}
                      disabled={busy}
                      onChange={(e) => act({ action: "unit_update", id: u.id, available: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button className={btnLine} disabled={busy} onClick={() => act({ action: "unit_delete", id: u.id })}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Configurações ------------------------------ */
function toLocalInput(isoValue: string) {
  // Converte para o formato do campo de data e hora, no horário de Brasília.
  const d = new Date(Date.parse(isoValue) - 3 * 3600_000);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

function Config({ data, act, busy }: TabProps) {
  const [v, setV] = useState<Record<string, string>>({ ...data.settings, campaign_end_local: toLocalInput(data.settings.campaign_end_at) });
  const set = (k: string, value: string) => setV((p) => ({ ...p, [k]: value }));
  const text = (key: string, label: string, hint?: string, placeholder?: string) => (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      {hint && <span className="font-normal text-muted">{hint}</span>}
      <input value={v[key] ?? ""} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} className={input} />
    </label>
  );
  return (
    <form
      className="grid gap-4 rounded-2xl bg-white p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const { campaign_end_local, ...rest } = v;
        await act({
          action: "settings_save",
          values: {
            ...rest,
            campaign_end_at: campaign_end_local ? `${campaign_end_local}:00${campaign.utcOffset}` : data.settings.campaign_end_at,
          },
        });
      }}
    >
      <h2 className="text-xl">Plantão</h2>
      {text("plantao_address", "Endereço do plantão", "Aparece na confirmação e no convite do Google Agenda.")}
      {text("plantao_maps_url", "Link do mapa (opcional)", "Cole o link do Google Maps.", "https://")}
      <label className="grid gap-1 text-sm font-semibold">
        Orientações para comparecimento
        <textarea rows={3} value={v.plantao_guidance ?? ""} onChange={(e) => set("plantao_guidance", e.target.value)} className={input} />
      </label>

      <h2 className="mt-3 text-xl">WhatsApp</h2>
      {text("whatsapp_group_url", "Link da Lista VIP do WhatsApp", "Enquanto estiver vazio, o convite não aparece.", "https://chat.whatsapp.com/…")}
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-5"
          checked={v.whatsapp_is_group === "true"}
          onChange={(e) => set("whatsapp_is_group", e.target.checked ? "true" : "false")}
        />
        <span>
          O link é de um <strong>grupo</strong> tradicional (os participantes veem os números uns
          dos outros). Desmarque se for um canal ou comunidade em que os números ficam ocultos.
        </span>
      </label>

      <h2 className="mt-3 text-xl">Campanha</h2>
      <label className="grid gap-1 text-sm font-semibold">
        Encerramento da campanha (horário de Brasília)
        <span className="font-normal text-muted">
          O contador da página conta até este momento e os agendamentos param de ser aceitos.
        </span>
        <input type="datetime-local" value={v.campaign_end_local} onChange={(e) => set("campaign_end_local", e.target.value)} className={input} />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-5"
          checked={v.booking_enabled === "true"}
          onChange={(e) => set("booking_enabled", e.target.checked ? "true" : "false")}
        />
        <span>Aceitar agendamentos online (desmarque para pausar a agenda).</span>
      </label>

      <h2 className="mt-3 text-xl">Política de privacidade</h2>
      {text("company_legal_name", "Razão social da empresa responsável")}
      {text("company_cnpj", "CNPJ")}
      {text("privacy_contact_email", "E-mail para pedidos sobre dados pessoais")}

      <button className={`${btnDark} justify-self-start`} disabled={busy}>
        Salvar configurações
      </button>
    </form>
  );
}
