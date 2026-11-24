"use client";

import { useEffect } from "react";
import { track, trackOnce } from "@/lib/tracking";

/**
 * Dispara a conversão uma única vez por reserva. Como esta página só é
 * renderizada para reservas gravadas no banco, não há conversão falsa.
 */
export function ConfirmationTracker({ token, date, time }: { token: string; date: string; time: string }) {
  useEffect(() => {
    trackOnce(`conv_${token}`, "complete_registration", { event_date: date, time_slot: time });
  }, [token, date, time]);
  return null;
}

export function WhatsappInvite({ url, isGroup }: { url: string; isGroup: boolean }) {
  if (!url) return null;
  return (
    <section className="mt-8 rounded-3xl border border-gold/50 bg-ink-2 p-6 sm:p-8">
      <h2 className="text-3xl sm:text-4xl">Mas falta um último passo</h2>
      <p className="mt-3 text-paper/85">
        Entre na Lista VIP do WhatsApp para receber informações, lembretes e novidades da Black
        November Villa di Napoli.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("click_whatsapp_group")}
        className="btn-gold mt-6 w-full"
      >
        Entrar na Lista VIP do WhatsApp
      </a>
      <p className="mt-4 text-sm text-mist">
        A entrada é voluntária e você pode sair quando quiser.
        {isGroup &&
          " Atenção: em grupos de WhatsApp, os outros participantes conseguem ver o seu número de telefone."}
      </p>
    </section>
  );
}
