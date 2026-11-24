"use client";

import { campaign } from "@/config/campaign";
import { dayMonth, weekdayName } from "@/lib/dates";
import { useAgenda } from "./AgendaProvider";
import { CountdownLarge } from "./Countdown";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Urgência baseada só em dados reais: prazo configurado, horários
 * livres contados no banco e unidades cadastradas no painel.
 * Sem dado confiável, o bloco correspondente simplesmente não aparece.
 */
export function Scarcity() {
  const { data, selectDate } = useAgenda();
  const ready = Boolean(data?.configured && data.slots.length > 0 && !data.brokerRequired);
  const total = ready ? Object.values(data!.availableByDate).reduce((a, b) => a + b, 0) : 0;
  const units = data?.units ?? null;

  return (
    <section className="bg-ink px-5 py-16 sm:py-24">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:items-start">
        <div>
          <h2 className="text-[2rem] sm:text-5xl">São só três dias de plantão</h2>
          <p className="mt-4 max-w-md text-mist">
            O plantão presencial acontece somente em 27, 28 e 29 de novembro, e as condições
            exclusivas são apresentadas apenas nesses atendimentos.
          </p>
          <div className="mt-8">
            <CountdownLarge />
          </div>

          {units && (
            <div className="mt-8 max-w-md rounded-2xl border border-gold/40 bg-ink-2 p-5">
              <p className="text-sm text-mist">Unidades participantes da campanha ainda disponíveis</p>
              <p className="mt-1 font-display text-5xl text-gold-soft">{units.available}</p>
              <p className="mt-2 text-xs text-mist">
                Atualizado em{" "}
                {new Date(units.updatedAt).toLocaleString("pt-BR", {
                  timeZone: campaign.timeZone,
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}
        </div>

        {ready && (
          <div>
            <h3 className="text-2xl sm:text-3xl">Horários livres agora</h3>
            <p className="mt-2 text-sm text-mist">
              Contagem direta da agenda do plantão. Ela muda a cada nova reserva.
            </p>
            <ul className="mt-6 grid gap-3">
              {campaign.eventDates.map((date) => {
                const n = data!.availableByDate[date] ?? 0;
                return (
                  <li key={date}>
                    <a
                      href="#agenda"
                      onClick={() => selectDate(date)}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-ink-2 px-5 py-4 transition-colors hover:border-gold/60"
                    >
                      <span>
                        <span className="block font-display text-2xl">{dayMonth(date)}</span>
                        <span className="text-sm text-mist">{cap(weekdayName(date))}</span>
                      </span>
                      <span className={`text-right ${n > 0 ? "text-ok" : "text-mist"}`}>
                        <span className="block font-display text-3xl leading-none tabular-nums">{n}</span>
                        <span className="text-sm">
                          {n === 1 ? "horário disponível" : n === 0 ? "esgotado" : "horários disponíveis"}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
            {total === 0 && (
              <p className="mt-4 text-sm text-mist">
                Todos os horários online foram reservados. Novos horários podem ser liberados pela
                organização.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
