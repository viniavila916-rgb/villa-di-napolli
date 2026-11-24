export type SlotState = "available" | "unavailable" | "past";

export type PublicSlot = {
  id: string;
  date: string; // AAAA-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  state: SlotState;
  /** Vagas restantes neste horário (0 quando indisponível). */
  remaining: number;
  capacity: number;
};

export type AgendaResponse = {
  /** false quando o banco de dados ainda não foi conectado. */
  configured: boolean;
  serverTime: string;
  campaignEndAt: string;
  bookingEnabled: boolean;
  slots: PublicSlot[];
  /** Horários disponíveis por dia (dado real do banco). */
  availableByDate: Record<string, number>;
  /** Corretor do link (quando o link é de um corretor cadastrado e ativo). */
  broker: { slug: string; name: string } | null;
  /** true = a agenda é por corretor e este link não identifica nenhum. */
  brokerRequired: boolean;
  /** null = contador de unidades desligado ou sem dado. */
  units: { available: number; updatedAt: string } | null;
};

export type BookingStatus = "confirmed" | "attended" | "no_show" | "cancelled";

export const bookingStatusLabel: Record<BookingStatus, string> = {
  confirmed: "Confirmado",
  attended: "Compareceu",
  no_show: "Não compareceu",
  cancelled: "Cancelado",
};
