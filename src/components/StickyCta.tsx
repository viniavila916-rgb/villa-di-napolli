"use client";

import { useEffect, useState } from "react";

/** Botão fixo no rodapé do celular. Some enquanto a agenda está na tela. */
export function StickyCta() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const agenda = document.getElementById("agenda");
    if (!agenda) return;
    let agendaVisible = false;
    const update = () => setHidden(agendaVisible || window.scrollY < 480);
    const io = new IntersectionObserver(
      ([entry]) => {
        agendaVisible = entry.isIntersecting;
        update();
      },
      { threshold: 0.05 },
    );
    io.observe(agenda);
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div
      aria-hidden={hidden}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-300 md:hidden ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <a href="#agenda" tabIndex={hidden ? -1 : 0} className="btn-gold w-full">
        Reservar meu horário
      </a>
    </div>
  );
}
