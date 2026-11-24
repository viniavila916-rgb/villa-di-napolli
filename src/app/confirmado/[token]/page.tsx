import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmationTracker, WhatsappInvite } from "@/components/ConfirmationActions";
import { campaign } from "@/config/campaign";
import { dayMonth, googleCalendarUrl, longDate } from "@/lib/dates";
import { isDbConfigured } from "@/lib/db";
import { getBookingByToken } from "@/lib/schedule";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agendamento confirmado | Black November Villa di Napoli",
  robots: { index: false, follow: false },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function Confirmado({ params }: PageProps<"/confirmado/[token]">) {
  const { token } = await params;
  if (!isDbConfigured()) notFound();

  // Esta página só existe para reservas realmente gravadas no banco.
  const booking = await getBookingByToken(token);
  if (!booking) notFound();
  const settings = await getSettings();

  const cancelled = booking.status === "cancelled";
  const firstName = booking.name.split(" ")[0];
  const calendarUrl = googleCalendarUrl({
    date: booking.date,
    start: booking.start,
    end: booking.end,
    title: "Plantão Black November Villa di Napoli",
    details: `Atendimento reservado em nome de ${booking.name}. Código da reserva: ${booking.code}.`,
    location: settings.plantao_address,
  });

  return (
    <main className="min-h-dvh bg-ink px-5 py-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Image
          src="/images/logo-villa-di-napoli-claro.png"
          alt="Villa di Napoli"
          width={792}
          height={440}
          className="h-auto w-24 sm:w-32"
          priority
        />

        {cancelled ? (
          <div className="mt-10">
            <h1 className="text-4xl sm:text-5xl">Este agendamento foi cancelado</h1>
            <p className="mt-4 text-mist">
              Se ainda quiser participar do plantão, escolha um novo horário disponível.
            </p>
            <Link href="/#agenda" className="btn-gold mt-8">
              Escolher novo horário
            </Link>
          </div>
        ) : (
          <>
            <ConfirmationTracker token={token} date={booking.date} time={booking.start} />

            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-ok/15 px-4 py-1.5 text-sm font-semibold text-ok">
              <span className="size-2 rounded-full bg-ok" aria-hidden /> Reserva registrada
            </p>
            <h1 className="mt-3 text-[2rem] sm:text-6xl">Seu agendamento foi confirmado</h1>
            <p className="mt-3 text-paper/85 sm:text-lg">
              {firstName}, seu horário está reservado para {dayMonth(booking.date)} às{" "}
              {booking.start}.
            </p>

            {/* O convite do WhatsApp vem primeiro: é a ação mais importante depois da reserva */}
            <WhatsappInvite
              url={settings.whatsapp_group_url}
              isGroup={settings.whatsapp_is_group === "true"}
            />

            {/* Cartão da reserva */}
            <section
              aria-label="Dados da sua reserva"
              className="on-paper mt-8 overflow-hidden rounded-3xl bg-paper text-text"
            >
              <div className="tricolor" aria-hidden />
              <dl className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted">Participante</dt>
                  <dd className="text-xl font-semibold">{booking.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Data</dt>
                  <dd className="font-display text-4xl leading-tight">{dayMonth(booking.date)}</dd>
                  <dd className="text-muted">{cap(longDate(booking.date))}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Horário</dt>
                  <dd className="font-display text-4xl leading-tight">{booking.start}</dd>
                  <dd className="text-muted">Horário de Brasília</dd>
                </div>
                {booking.broker_name && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-muted">Quem vai atender você</dt>
                    <dd className="text-xl font-semibold">{booking.broker_name}</dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted">Endereço do plantão</dt>
                  <dd className="font-semibold">
                    {settings.plantao_address ||
                      "Nossa equipe confirma o endereço do plantão pelo WhatsApp informado."}
                  </dd>
                  {settings.plantao_maps_url && (
                    <dd className="mt-1">
                      <a
                        href={settings.plantao_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-gold-deep underline underline-offset-2"
                      >
                        Abrir no mapa
                      </a>
                    </dd>
                  )}
                </div>
                {settings.plantao_guidance && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-muted">Orientações</dt>
                    <dd>{settings.plantao_guidance}</dd>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted">Código da reserva</dt>
                  <dd className="text-lg font-bold tracking-wider">{booking.code}</dd>
                </div>
              </dl>
              <div className="border-t border-paper-2 p-6 sm:px-8">
                <a
                  href={calendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-13 w-full items-center justify-center rounded-full border-2 border-text px-6 py-3 text-center font-bold"
                >
                  Adicionar ao Google Agenda
                </a>
                <p className="mt-3 text-center text-sm text-muted">
                  Guarde esta página: tire um print ou salve o link.
                </p>
              </div>
            </section>

            <p className="mt-10 text-sm text-mist">
              Precisa trocar o horário? Fale com a equipe do plantão informando o código{" "}
              {booking.code}. {campaign.development}, {campaign.builder}.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
