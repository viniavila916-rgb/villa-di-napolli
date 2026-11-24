"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { campaign } from "@/config/campaign";
import type { AgendaResponse } from "@/lib/types";

type AgendaState = {
  /** null enquanto carrega pela primeira vez. */
  data: AgendaResponse | null;
  /** true se a última consulta falhou. */
  failed: boolean;
  refresh: () => Promise<AgendaResponse | null>;
  selectedDate: string | null;
  selectDate: (date: string) => void;
  /** Diferença entre o relógio do servidor e o do aparelho (ms). */
  clockOffset: number;
  endAt: number;
};

const Ctx = createContext<AgendaState | null>(null);

export function useAgenda() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAgenda precisa estar dentro de <AgendaProvider>");
  return v;
}

const REFRESH_MS = 20_000;

/** Busca a disponibilidade real e mantém atualizada enquanto a página está aberta. */
export function AgendaProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const inFlight = useRef<Promise<AgendaResponse | null> | null>(null);

  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const p = (async () => {
      try {
        const res = await fetch("/api/agenda", { cache: "no-store" });
        const json = (await res.json()) as AgendaResponse;
        setData(json);
        setFailed(!res.ok);
        setClockOffset(Date.parse(json.serverTime) - Date.now());
        return json;
      } catch {
        setFailed(true);
        return null;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = p;
    return p;
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const value = useMemo<AgendaState>(
    () => ({
      data,
      failed,
      refresh,
      selectedDate,
      selectDate: setSelectedDate,
      clockOffset,
      endAt: Date.parse(data?.campaignEndAt ?? campaign.defaultEndAt),
    }),
    [data, failed, refresh, selectedDate, clockOffset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
