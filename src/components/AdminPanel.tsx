"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { campaign } from "@/config/campaign";
import { dayMonth, weekdayName } from "@/lib/dates";
import { cleanBroker, maskPhone } from "@/lib/format";
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
  broker: string | null;
  broker_source: string | null;
  slot_id: string;
  created_at: string;
};
type Broker = { slug: string; name: string; active: boolean };
type Unit = { id: string; label: string; in_campaign: boolean; available: boolean };
type Data = {
  slots: Slot[];
  bookings: Booking[];
  units: Unit[];
  brokers: Broker[];
  brokerBlocks: { slot_id: string; broker_slug: string }[];
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
  const [tab, setTab] = useState<"agendamentos" | "horarios" | "corretores" | "unidades" | "config">("agendamentos");
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      // Espera no máximo 25 segundos; depois disso mostra o motivo na tela.
      const res = await fetch("/api/admin/dados", {
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) return setView("login");
      if (!res.ok) {
        setBlockedMsg(
          json.message ||
            `O servidor respondeu com erro (${res.status}). Abra a Vercel, aba Logs, para ver o detalhe.`,
        );
        return setView("blocked");
      }
      setData(json as Data);
      setView("panel");
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      setBlockedMsg(
        timedOut
          ? "O servidor demorou demais para responder. Normalmente é o banco de dados: confira no Supabase se o projeto está ativo e tente de novo."
          : "Não foi possível falar com o servidor. Confira sua internet e tente de novo.",
      );
      setView("blocked");
    }
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

  if (view === "loading")
    return (
      <Shell>
        <p>Carregando…</p>
        <noscript>Ative o JavaScript do navegador para usar o painel.</noscript>
      </Shell>
    );
  if (view === "blocked")
    return (
      <Shell>
        <h1 className="text-3xl">Painel indisponível</h1>
        <p className="mt-3 rounded-xl bg-white p-4">{blockedMsg}</p>
        <button
          className={`${btnDark} mt-4`}
          onClick={() => {
            setView("loading");
            load();
          }}
        >
          Tentar de novo
        </button>
        <p className="mt-3 text-sm text-muted">Veja o passo a passo no arquivo GUIA-DE-PUBLICACAO.md.</p>
      </Shell>
    );
  if (view === "login") return <Login onDone={load} />;
  if (!data) return null;

  const tabs: [typeof tab, string][] = [
    ["agendamentos", `Agendamentos (${data.bookings.filter((b) => b.status !== "cancelled").length})`],
    ["horarios", `Horários (${data.slots.length})`],
    ["corretores", `Corretores (${data.brokers.length})`],
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
        {tab === "corretores" && <Corretores data={data} act={act} busy={busy} />}
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
  if (data.brokers.length === 0)
    items.push("Cadastrar os corretores para ativar a agenda por corretor (aba Corretores).");
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
  const [broker, setBroker] = useState<string>("todos");
  const [q, setQ] = useState("");
  const brokerLabel = (slug: string) => data.brokers.find((b) => b.slug === slug)?.name ?? slug;
  // Agendamentos ativos por corretor (quem não veio por link fica em "sem corretor").
  const byBroker = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of data.bookings) {
      if (b.status === "cancelled") continue;
      const k = b.broker || "";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.bookings]);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.bookings.filter(
      (b) =>
        (day === "todos" || b.date === day) &&
        (broker === "todos" || (b.broker || "") === broker) &&
        (!term ||
          b.name.toLowerCase().includes(term) ||
          b.whatsapp.includes(term.replace(/\D/g, "") || "§") ||
          b.code.toLowerCase().includes(term)),
    );
  }, [data.bookings, day, broker, q]);

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
        <label className="grid gap-1 text-sm font-semibold">
          Corretor
          <select value={broker} onChange={(e) => setBroker(e.target.value)} className={input}>
            <option value="todos">Todos</option>
            {byBroker.map(([name, n]) => (
              <option key={name || "-"} value={name}>
                {name ? brokerLabel(name) : "Sem corretor"} ({n})
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
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-paper-2 text-muted">
            <tr>
              {["Dia e hora", "Nome", "WhatsApp", "Renda / e-mail", "Corretor", "Origem", "Situação"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
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
                <td className="px-4 py-3 font-semibold">
                  {b.broker ? brokerLabel(b.broker) : "—"}
                  {b.broker_source === "geral" && (
                    <span className="block text-xs font-normal text-muted">Pelo link geral</span>
                  )}
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

      <BrokerTotals byBroker={byBroker} label={brokerLabel} />
    </section>
  );
}

function BrokerTotals({ byBroker, label }: { byBroker: [string, number][]; label: (s: string) => string }) {
  if (byBroker.length === 0) return null;
  return (
    <div className="mt-8 max-w-xl rounded-2xl bg-white p-5">
      <h2 className="text-xl">Agendamentos por corretor</h2>
      <table className="mt-2 w-full text-left text-sm">
        <tbody>
          {byBroker.map(([b, n]) => (
            <tr key={b || "-"} className="border-b border-paper-2 last:border-0">
              <td className="py-2 font-semibold">{b ? label(b) : "Sem corretor"}</td>
              <td className="py-2 text-right tabular-nums">{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">Não conta agendamentos cancelados.</p>
    </div>
  );
}

/* ------------------------------- Corretores ------------------------------- */
function Corretores({ data, act, busy }: TabProps) {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const activeCount = data.brokers.filter((b) => b.active).length;
  const count = (slug: string) =>
    data.bookings.filter((b) => b.broker === slug && b.status !== "cancelled").length;
  return (
    <section className="grid gap-5">
      <div className="rounded-2xl bg-white p-5">
        <h2 className="text-xl">Agenda por corretor</h2>
        <p className="mt-1 text-sm text-muted">
          {activeCount > 0
            ? `Ligada, com ${activeCount} corretor(es) ativo(s). Cada corretor tem o próprio link e atende 1 cliente por horário. Quem abre o link de um corretor só vê os horários livres dele. Não há distribuição entre corretores.`
            : "Desligada. Cadastre os corretores abaixo para ligar. Enquanto não houver corretor ativo, vale a quantidade de vagas definida em cada horário."}
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ action: "broker_add", name })) setName("");
          }}
        >
          <label className="grid flex-1 gap-1 text-sm font-semibold">
            Nome do corretor
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Vinicius Avila" className={input} />
          </label>
          <button className={btnDark} disabled={busy || cleanBroker(name).length < 2}>
            Adicionar corretor
          </button>
        </form>
      </div>

      {data.brokers.length > 0 && (
        <div className="overflow-x-auto rounded-2xl bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-paper-2 text-muted">
              <tr>
                {["Corretor", "Link para divulgar", "Agendamentos", "Situação", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.brokers.map((b) => {
                const link = `${origin}/?corretor=${b.slug}`;
                return (
                  <tr key={b.slug} className={`border-b border-paper-2 last:border-0 ${b.active ? "" : "opacity-55"}`}>
                    <td className="px-4 py-3 font-semibold">{b.name}</td>
                    <td className="px-4 py-3">
                      <span className="break-all">{link}</span>
                      <button
                        type="button"
                        className={`${btnLine} ml-2`}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(link);
                            setCopied(b.slug);
                          } catch {
                            setCopied("");
                          }
                        }}
                      >
                        {copied === b.slug ? "Copiado" : "Copiar"}
                      </button>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{count(b.slug)}</td>
                    <td className="px-4 py-3">
                      <button
                        className={btnLine}
                        disabled={busy}
                        onClick={() => act({ action: "broker_active", slug: b.slug, active: !b.active })}
                      >
                        {b.active ? "Ativo (pausar)" : "Pausado (ativar)"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {count(b.slug) === 0 && (
                        <button className={btnLine} disabled={busy} onClick={() => act({ action: "broker_delete", slug: b.slug })}>
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {activeCount > 0 && (
        <div className="rounded-2xl bg-white p-5">
          <h2 className="text-xl">Link geral (sem corretor)</h2>
          <p className="mt-1 text-sm text-muted">
            É o endereço do site sem nada no final, por exemplo o de um anúncio. Como não há
            distribuição, escolha o que acontece com quem entra por ele.
          </p>
          <select
            aria-label="Corretor do link geral"
            className={`${input} mt-3 max-w-md`}
            disabled={busy}
            value={data.settings.default_broker ?? ""}
            onChange={(e) => act({ action: "settings_save", values: { default_broker: e.target.value } })}
          >
            <option value="">Não agenda: pede o link do corretor</option>
            {data.brokers
              .filter((b) => b.active)
              .map((b) => (
                <option key={b.slug} value={b.slug}>
                  Agenda com {b.name}
                </option>
              ))}
          </select>
        </div>
      )}
      <p className="text-sm text-muted">
        Para marcar um horário em que um corretor não atende (almoço, ausência), use a aba
        Horários: cada horário mostra os corretores, e um clique no nome bloqueia ou libera.
      </p>
    </section>
  );
}

/* -------------------------------- Horários -------------------------------- */
function Horarios({ data, act, busy }: TabProps) {
  const activeBrokers = data.brokers.filter((b) => b.active);
  const brokerMode = activeBrokers.length > 0;
  const blocked = new Set(data.brokerBlocks.map((k) => `${k.slot_id}|${k.broker_slug}`));
  const occupied = new Set(
    data.bookings.filter((b) => b.status !== "cancelled" && b.broker).map((b) => `${b.slot_id}|${b.broker}`),
  );
  const [form, setForm] = useState({
    date: campaign.eventDates[0] as string,
    from: "",
    to: "",
    durationMin: "",
    capacity: "1",
  });
  const valid = form.from && form.to && Number(form.durationMin) >= 5 && Number(form.capacity) >= 1;
  // Na agenda por corretor as vagas vêm dos corretores; o campo de capacidade fica oculto.

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
        {brokerMode ? (
          <p className="self-end pb-2 text-sm text-muted">
            Vagas por horário: {activeBrokers.length} (uma por corretor ativo)
          </p>
        ) : (
          <label className="grid gap-1 text-sm font-semibold">
            Atendimentos ao mesmo tempo
            <input type="number" min={1} max={50} required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className={input} />
          </label>
        )}
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
                      {["Horário", "Situação na página", "Reservas", brokerMode ? "Corretores (clique para bloquear ou liberar)" : "Vagas no horário", "Ações"].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((s) => {
                      const freeBrokers = activeBrokers.filter(
                        (b) => !blocked.has(`${s.id}|${b.slug}`) && !occupied.has(`${s.id}|${b.slug}`),
                      ).length;
                      const full = brokerMode ? freeBrokers === 0 : s.taken >= s.capacity;
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
                            {brokerMode ? (
                              <div className="flex flex-wrap gap-1.5">
                                {activeBrokers.map((b) => {
                                  const isBusy = occupied.has(`${s.id}|${b.slug}`);
                                  const isBlocked = blocked.has(`${s.id}|${b.slug}`);
                                  return (
                                    <button
                                      key={b.slug}
                                      type="button"
                                      disabled={busy || isBusy}
                                      title={isBusy ? "Tem cliente agendado" : isBlocked ? "Bloqueado: clique para liberar" : "Livre: clique para bloquear"}
                                      onClick={() => act({ action: "broker_block", slotId: s.id, slug: b.slug, blocked: !isBlocked })}
                                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                        isBusy
                                          ? "bg-ink text-paper"
                                          : isBlocked
                                            ? "bg-paper-2 text-muted line-through"
                                            : "bg-ok-wash text-ok-deep"
                                      }`}
                                    >
                                      {b.name}
                                      {isBusy ? " · agendado" : isBlocked ? " · bloqueado" : " · livre"}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
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
                            )}
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
