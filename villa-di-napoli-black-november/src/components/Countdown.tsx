"use client";

import { useEffect, useState } from "react";
import { useAgenda } from "./AgendaProvider";

function useRemaining() {
  const { endAt, clockOffset } = useAgenda();
  // null até o navegador assumir: evita diferença entre servidor e aparelho.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now() + clockOffset);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockOffset]);
  if (now === null) return null;
  const ms = Math.max(0, endAt - now);
  const s = Math.floor(ms / 1000);
  return {
    ended: ms <= 0,
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Versão compacta, para a barra do topo. */
export function CountdownInline() {
  const r = useRemaining();
  if (!r) return <span className="tabular-nums opacity-0">00d 00h 00m 00s</span>;
  if (r.ended) return <span className="font-semibold">Campanha encerrada</span>;
  return (
    <span role="timer" aria-label="Tempo até o encerramento da campanha">
      <span className="text-mist">Encerra em </span>
      <span className="font-semibold tabular-nums text-gold-soft">
        {r.d}d {pad(r.h)}h {pad(r.m)}m {pad(r.s)}s
      </span>
    </span>
  );
}

/** Versão grande, para a seção de urgência. */
export function CountdownLarge() {
  const r = useRemaining();
  if (r?.ended) {
    return (
      <p className="font-display text-3xl text-gold-soft">
        A Black November Villa di Napoli foi encerrada.
      </p>
    );
  }
  const cells: [string, string][] = [
    [r ? String(r.d) : "–", "dias"],
    [r ? pad(r.h) : "–", "horas"],
    [r ? pad(r.m) : "–", "min"],
    [r ? pad(r.s) : "–", "seg"],
  ];
  return (
    <div
      role="timer"
      aria-label="Tempo até o encerramento da campanha"
      className="grid max-w-md grid-cols-4 gap-2 sm:gap-3"
    >
      {cells.map(([value, label]) => (
        <div
          key={label}
          className="rounded-xl border border-line bg-ink-2 px-1 py-4 text-center sm:py-5"
        >
          <div className="font-display text-4xl leading-none tabular-nums text-gold-soft sm:text-5xl">
            {value}
          </div>
          <div className="mt-2 text-xs text-mist">{label}</div>
        </div>
      ))}
    </div>
  );
}
