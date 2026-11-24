"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { campaign } from "@/config/campaign";
import { dayMonth, monthName, parseDate, weekdayName } from "@/lib/dates";
import { isFullName, isValidWhatsapp, maskPhone } from "@/lib/format";
import { readUtm, track, trackOnce } from "@/lib/tracking";
import type { PublicSlot } from "@/lib/types";
import { useAgenda } from "./AgendaProvider";

const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type FormState = {
  name: string;
  whatsapp: string;
  email: string;
  incomeRange: string;
  privacyConsent: boolean;
  marketingOptIn: boolean;
  website: string;
};

const emptyForm: FormState = {
  name: "",
  whatsapp: "",
  email: "",
  incomeRange: "",
  privacyConsent: false,
  marketingOptIn: false,
  website: "",
};

export function Booking() {
  const router = useRouter();
  const { data, failed, refresh, selectedDate, selectDate, endAt, clockOffset } = useAgenda();
  const [slotId, setSlotId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef<number | null>(null);

  /* view_calendar: só quando o calendário aparece de fato na tela */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          trackOnce("view_calendar", "view_calendar");
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const loading = data === null && !failed;
  const ready = Boolean(data?.configured);
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    const check = () => setEnded(Date.now() + clockOffset >= endAt);
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, [endAt, clockOffset]);

  /* Se o visitante ainda não escolheu, mostramos o primeiro dia com vaga. */
  const activeDate = useMemo(() => {
    if (selectedDate) return selectedDate;
    if (!data) return null;
    return campaign.eventDates.find((d) => (data.availableByDate[d] ?? 0) > 0) ?? null;
  }, [selectedDate, data]);

  const daySlots = useMemo(
    () => (data && activeDate ? data.slots.filter((s) => s.date === activeDate) : []),
    [data, activeDate],
  );
  const selectedSlot = daySlots.find((s) => s.id === slotId && s.state === "available") ?? null;
  // O horário escolhido deixou de estar disponível enquanto a pessoa preenchia.
  const lostSelection = Boolean(slotId) && !selectedSlot && !submitting && data !== null;

  function pickDate(date: string) {
    selectDate(date);
    setSlotId(null);
    setServerMessage(null);
    track("select_event_date", { event_date: date });
  }

  function pickSlot(slot: PublicSlot) {
    if (slot.state !== "available") return;
    setSlotId(slot.id);
    setServerMessage(null);
    // eslint-disable-next-line react-hooks/purity -- executa no clique, não na renderização
    if (!startedAt.current) startedAt.current = Date.now();
    track("select_time_slot", { event_date: slot.date, time_slot: slot.start });
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    trackOnce("begin_registration", "begin_registration");
  }

  function validate() {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!isFullName(form.name)) e.name = "Informe seu nome e sobrenome.";
    if (!isValidWhatsapp(form.whatsapp)) e.whatsapp = "Informe um celular com DDD, por exemplo (47) 99999-9999.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) e.email = "Confira o e-mail informado.";
    if (!form.privacyConsent) e.privacyConsent = "Marque esta opção para confirmar o agendamento.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (submitting || !selectedSlot) return;
    setServerMessage(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/agendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          ...form,
          ...readUtm(),
          startedAt: startedAt.current ?? undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; token: string }
        | { ok: false; error: string; message: string; fields?: string[] }
        | null;

      if (res.ok && json?.ok) {
        // A reserva já está gravada. O evento de conversão é disparado
        // na página de confirmação, que só existe para reservas reais.
        router.push(`/confirmado/${json.token}`);
        return;
      }
      if (json && !json.ok) {
        setServerMessage(json.message);
        if (json.error === "invalid" && json.fields) {
          const map: Record<string, string> = {
            name: "Informe seu nome e sobrenome.",
            whatsapp: "Informe um celular com DDD válido.",
            email: "Confira o e-mail informado.",
            privacyConsent: "Marque esta opção para confirmar o agendamento.",
          };
          const e: Partial<Record<keyof FormState, string>> = {};
          for (const f of json.fields) if (map[f]) e[f as keyof FormState] = map[f];
          setErrors(e);
        }
        if (["slot_taken", "slot_blocked", "slot_past", "slot_missing"].includes(json.error)) {
          setSlotId(null);
          await refresh();
        }
      } else {
        setServerMessage("Não conseguimos concluir a reserva agora. Tente novamente em instantes.");
      }
    } catch {
      setServerMessage("Sem conexão. Verifique sua internet e tente novamente.");
    }
    setSubmitting(false);
  }

  /* ---------- Calendário do mês ---------- */
  const { calendarYear: year, calendarMonth: month } = campaign;
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const iso = (d: number) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const groups: [string, PublicSlot[]][] = [
    ["Manhã", daySlots.filter((s) => s.start < "12:00")],
    ["Tarde", daySlots.filter((s) => s.start >= "12:00" && s.start < "18:00")],
    ["Noite", daySlots.filter((s) => s.start >= "18:00")],
  ];

  return (
    <section
      id="agenda"
      ref={sectionRef}
      className="on-paper scroll-mt-4 bg-paper px-5 py-16 text-text sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="max-w-3xl text-[2rem] sm:text-5xl">
          Escolha o dia e garanta seu horário no plantão
        </h2>
        <p className="mt-4 max-w-2xl text-muted">
          Selecione uma das datas disponíveis e consulte os horários para participar da Black
          November Villa di Napoli.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          {/* ---------------- Calendário ---------------- */}
          <div className="overflow-hidden rounded-3xl bg-ink text-paper shadow-[0_30px_60px_-30px_rgba(19,20,23,0.55)]">
            <div className="tricolor" aria-hidden />
            <div className="p-5 sm:p-7">
              <div className="flex items-baseline justify-between">
                <p className="font-display text-2xl">
                  {cap(monthName(month))} <span className="text-gold-soft">{year}</span>
                </p>
                <p className="text-sm text-mist">Passo 1 de 3</p>
              </div>

              <div className="mt-5 grid grid-cols-7 gap-1 text-center" role="group" aria-label={`Calendário de ${monthName(month)} de ${year}`}>
                {WEEK.map((w) => (
                  <div key={w} className="pb-1 text-xs text-mist" aria-hidden>
                    {w}
                  </div>
                ))}
                {cells.map((d, i) => {
                  if (d === null) return <div key={`e${i}`} aria-hidden />;
                  const date = iso(d);
                  const isEvent = (campaign.eventDates as readonly string[]).includes(date);
                  if (!isEvent) {
                    return (
                      <div
                        key={d}
                        aria-hidden
                        className="flex aspect-square items-center justify-center text-sm text-paper/25"
                      >
                        {d}
                      </div>
                    );
                  }
                  const active = activeDate === date;
                  const count = data?.availableByDate[date];
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => pickDate(date)}
                      aria-pressed={active}
                      aria-label={`${cap(weekdayName(date))}, ${d} de ${monthName(month)}${
                        ready && count !== undefined ? `, ${count} horários disponíveis` : ""
                      }`}
                      className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-lg font-bold transition-colors ${
                        active
                          ? "border-gold bg-gold text-ink"
                          : "border-gold/70 bg-gold/10 text-gold-soft hover:bg-gold/20"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              <p className="mt-5 text-sm text-mist">
                Os dias em dourado são os únicos do plantão: sexta 27, sábado 28 e domingo 29 de
                novembro.
              </p>

              {/* Atalho dos três dias com a contagem real de horários */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {campaign.eventDates.map((date) => {
                  const active = activeDate === date;
                  const count = data?.availableByDate[date] ?? 0;
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => pickDate(date)}
                      aria-pressed={active}
                      className={`rounded-xl border px-2 py-3 text-left transition-colors ${
                        active ? "border-gold bg-ink-3" : "border-line hover:border-gold/60"
                      }`}
                    >
                      <span className="block text-xs text-mist">{cap(weekdayName(date).replace("-feira", ""))}</span>
                      <span className="block font-display text-2xl leading-tight">{dayMonth(date)}</span>
                      <span className={`mt-1 block text-xs ${ready && count > 0 ? "text-ok" : "text-mist"}`}>
                        {!ready
                          ? "Em breve"
                          : count > 0
                            ? `${count} ${count === 1 ? "horário" : "horários"}`
                            : "Sem horários"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---------------- Horários + formulário ---------------- */}
          <div className="rounded-3xl border border-paper-2 bg-white p-5 shadow-[0_20px_50px_-35px_rgba(19,20,23,0.4)] sm:p-7">
            {loading && (
              <div aria-busy="true" aria-label="Carregando horários">
                <div className="h-7 w-52 animate-pulse rounded bg-paper-2" />
                <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-paper" />
                  ))}
                </div>
              </div>
            )}

            {!loading && ended && (
              <EmptyState
                title="A Black November Villa di Napoli foi encerrada"
                text="Os agendamentos online para o plantão terminaram. Obrigado pelo interesse."
              />
            )}

            {!loading && !ended && !ready && (
              <EmptyState
                title="A agenda do plantão abre em breve"
                text="Os horários de atendimento ainda estão sendo liberados. Volte em instantes para reservar o seu."
              />
            )}

            {!loading && !ended && ready && data && !data.bookingEnabled && (
              <EmptyState
                title="Os agendamentos online estão pausados"
                text="Volte em instantes para consultar os horários do plantão."
              />
            )}

            {!loading && !ended && ready && data?.bookingEnabled && (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-2xl sm:text-[1.75rem]">
                    {activeDate
                      ? `${cap(weekdayName(activeDate))}, ${dayMonth(activeDate)}`
                      : "Escolha uma das três datas"}
                  </h3>
                  <p className="shrink-0 text-sm text-muted">Passo 2 de 3</p>
                </div>

                {!activeDate && (
                  <p className="mt-3 text-muted">
                    {data.slots.length === 0
                      ? "Os horários do plantão ainda não foram liberados. Volte em instantes."
                      : "Todos os horários online já foram reservados. Toque em um dos dias para conferir a agenda."}
                  </p>
                )}

                {activeDate && daySlots.length === 0 && (
                  <p className="mt-3 text-muted">
                    Os horários deste dia ainda não foram liberados. Confira as outras datas.
                  </p>
                )}

                {activeDate && daySlots.length > 0 && (
                  <>
                    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted" aria-label="Legenda">
                      <li className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-ok" aria-hidden /> Disponível
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-off/50" aria-hidden /> Indisponível
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="size-3 rounded-full bg-gold" aria-hidden /> Selecionado
                      </li>
                    </ul>

                    {groups.map(([label, list]) =>
                      list.length === 0 ? null : (
                        <div key={label} className="mt-5">
                          <p className="text-sm font-semibold text-muted">{label}</p>
                          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {list.map((slot) => (
                              <SlotButton
                                key={slot.id}
                                slot={slot}
                                selected={selectedSlot?.id === slot.id}
                                onPick={() => pickSlot(slot)}
                              />
                            ))}
                          </div>
                        </div>
                      ),
                    )}

                    <p className="mt-5 text-sm text-muted">
                      Os horários indisponíveis continuam visíveis para você consultar a agenda
                      real. Selecione somente um horário marcado como disponível.
                    </p>
                  </>
                )}

                <div aria-live="polite">
                  {lostSelection && !serverMessage && (
                    <Alert>
                      O horário que você tinha escolhido acabou de ficar indisponível. Escolha outro
                      horário disponível.
                    </Alert>
                  )}
                  {serverMessage && <Alert>{serverMessage}</Alert>}
                </div>

                {/* ---------------- Formulário ---------------- */}
                {selectedSlot && activeDate && (
                  <div ref={formRef} className="mt-7 scroll-mt-4 border-t border-paper-2 pt-7">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-2xl sm:text-[1.75rem]">
                        Falta pouco para confirmar sua participação
                      </h3>
                      <p className="shrink-0 text-sm text-muted">Passo 3 de 3</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-paper">
                      <div>
                        <p className="text-xs text-mist">Seu horário</p>
                        <p className="font-semibold">
                          {cap(weekdayName(activeDate))}, {dayMonth(activeDate)}{" "}
                          <span className="text-gold-soft">às {selectedSlot.start}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSlotId(null)}
                        className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold"
                      >
                        Trocar
                      </button>
                    </div>

                    <form onSubmit={submit} noValidate className="mt-5 grid gap-4">
                      {/* Preenchidos automaticamente com a escolha feita acima */}
                      <input type="hidden" name="dia" value={activeDate} readOnly />
                      <input type="hidden" name="horario" value={selectedSlot.start} readOnly />

                      <Field id="vn-name" label="Nome completo" error={errors.name} required>
                        <input
                          id="vn-name"
                          name="name"
                          autoComplete="name"
                          value={form.name}
                          onChange={(e) => setField("name", e.target.value)}
                          aria-invalid={Boolean(errors.name)}
                          aria-describedby={errors.name ? "vn-name-err" : undefined}
                          maxLength={120}
                          className={inputClass(errors.name)}
                        />
                      </Field>

                      <Field id="vn-whatsapp" label="WhatsApp com DDD" error={errors.whatsapp} required>
                        <input
                          id="vn-whatsapp"
                          name="whatsapp"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          placeholder="(47) 99999-9999"
                          value={form.whatsapp}
                          onChange={(e) => setField("whatsapp", maskPhone(e.target.value))}
                          aria-invalid={Boolean(errors.whatsapp)}
                          aria-describedby={errors.whatsapp ? "vn-whatsapp-err" : undefined}
                          className={inputClass(errors.whatsapp)}
                        />
                      </Field>

                      <Field id="vn-email" label="E-mail" hint="opcional" error={errors.email}>
                        <input
                          id="vn-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={(e) => setField("email", e.target.value.trim())}
                          aria-invalid={Boolean(errors.email)}
                          aria-describedby={errors.email ? "vn-email-err" : undefined}
                          maxLength={160}
                          className={inputClass(errors.email)}
                        />
                      </Field>

                      <Field
                        id="vn-income"
                        label="Faixa de renda familiar"
                        hint="opcional, ajuda na orientação sobre o financiamento"
                      >
                        <select
                          id="vn-income"
                          name="incomeRange"
                          value={form.incomeRange}
                          onChange={(e) => setField("incomeRange", e.target.value)}
                          className={inputClass()}
                        >
                          <option value="">Selecione</option>
                          {campaign.incomeRanges.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </Field>

                      {/* Campo-armadilha contra robôs (invisível para pessoas) */}
                      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                        <label>
                          Não preencha este campo
                          <input
                            tabIndex={-1}
                            autoComplete="off"
                            name="website"
                            value={form.website}
                            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                          />
                        </label>
                      </div>

                      <div className="grid gap-3 rounded-2xl bg-paper p-4 text-sm">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={form.privacyConsent}
                            onChange={(e) => setField("privacyConsent", e.target.checked)}
                            aria-invalid={Boolean(errors.privacyConsent)}
                            className="mt-0.5 size-5 shrink-0 accent-[#1c6f46]"
                          />
                          <span>
                            Concordo com o uso dos meus dados para organizar meu atendimento no
                            plantão e receber a confirmação e os lembretes deste agendamento,
                            conforme a{" "}
                            <Link href="/privacidade" target="_blank" className="font-semibold underline underline-offset-2">
                              Política de Privacidade
                            </Link>
                            . <span className="text-warn">(obrigatório)</span>
                          </span>
                        </label>
                        {errors.privacyConsent && (
                          <p className="text-warn" role="alert">
                            {errors.privacyConsent}
                          </p>
                        )}
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={form.marketingOptIn}
                            onChange={(e) => setField("marketingOptIn", e.target.checked)}
                            className="mt-0.5 size-5 shrink-0 accent-[#1c6f46]"
                          />
                          <span>
                            Quero receber novidades e ofertas da AMC Construções pelo WhatsApp.
                            (opcional)
                          </span>
                        </label>
                      </div>

                      <button type="submit" disabled={submitting} className="btn-gold w-full">
                        {submitting ? "Reservando seu horário…" : "Confirmar meu agendamento"}
                      </button>
                      <p className="text-center text-sm text-muted">
                        Gratuito e sem compromisso de compra.
                      </p>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function inputClass(error?: string) {
  return `block w-full min-h-13 rounded-xl border bg-white px-4 py-3 text-base text-text placeholder:text-muted/60 ${
    error ? "border-warn" : "border-[#cfc8b6]"
  }`;
}

function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
        {required && <span className="text-warn"> *</span>}
        {hint && <span className="font-normal text-muted"> ({hint})</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

function SlotButton({
  slot,
  selected,
  onPick,
}: {
  slot: PublicSlot;
  selected: boolean;
  onPick: () => void;
}) {
  if (slot.state !== "available") {
    return (
      <button
        type="button"
        disabled
        aria-label={`${slot.start}, ${slot.state === "past" ? "encerrado" : "indisponível"}`}
        className="cursor-not-allowed rounded-xl border border-dashed border-[#d9d4c7] bg-[#f3f1ec] px-1 py-2.5 text-center"
      >
        <span className="block text-lg font-semibold text-off line-through decoration-1">{slot.start}</span>
        <span className="block text-[0.72rem] text-off">
          {slot.state === "past" ? "Encerrado" : "Indisponível"}
        </span>
      </button>
    );
  }
  const lastSpot = slot.capacity > 1 && slot.remaining === 1;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={`${slot.start}, ${selected ? "selecionado" : "disponível"}`}
      className={`rounded-xl border-2 px-1 py-2.5 text-center transition-colors ${
        selected
          ? "border-gold-deep bg-gold text-ink"
          : "border-ok-deep/60 bg-ok-wash text-ok-deep hover:border-ok-deep"
      }`}
    >
      <span className="block text-lg font-bold">{slot.start}</span>
      <span className="block text-[0.72rem] font-semibold">
        {selected ? "Selecionado" : lastSpot ? "Última vaga" : "Disponível"}
      </span>
    </button>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="py-6">
      <h3 className="text-2xl">{title}</h3>
      <p className="mt-3 text-muted">{text}</p>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-5 rounded-xl border border-warn/40 bg-[#fbeeea] px-4 py-3 text-sm text-warn">
      {children}
    </p>
  );
}

/** Usado no topo da página: os três dias como atalho para o calendário. */
export function HeroDates() {
  const { selectDate, data } = useAgenda();
  return (
    <div className="grid max-w-md grid-cols-3 gap-2 sm:gap-3">
      {campaign.eventDates.map((date) => {
        const count = data?.configured ? data.availableByDate[date] : undefined;
        return (
          <a
            key={date}
            href="#agenda"
            onClick={() => {
              selectDate(date);
              track("select_event_date", { event_date: date, origin: "hero" });
            }}
            className="group rounded-2xl border border-gold/50 bg-ink/70 px-3 py-3 backdrop-blur-sm transition-colors hover:border-gold"
          >
            <span className="block text-sm text-mist">{cap(weekdayName(date).replace("-feira", ""))}</span>
            <span className="block font-display text-5xl leading-none text-gold-soft sm:text-6xl">
              {parseDate(date).d}
            </span>
            <span className="mt-1 block text-xs text-mist">
              {count === undefined ? "de novembro" : count > 0 ? `${count} ${count === 1 ? "horário" : "horários"}` : "sem horários"}
            </span>
          </a>
        );
      })}
    </div>
  );
}
