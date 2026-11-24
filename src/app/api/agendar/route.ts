import { NextResponse } from "next/server";
import { isDbConfigured, withTimeout } from "@/lib/db";
import { createBooking } from "@/lib/schedule";
import { clientKey, rateLimit, sameOrigin } from "@/lib/security";
import { bookingSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  slot_taken:
    "Este horário acabou de ser reservado por outra pessoa. Atualizamos a agenda: escolha outro horário disponível.",
  slot_blocked: "Este horário não está mais disponível. Escolha outro horário.",
  slot_past: "Este horário já passou. Escolha outro horário.",
  slot_missing: "Não encontramos este horário. Atualize a página e escolha novamente.",
  duplicate_phone:
    "Este WhatsApp já tem um horário reservado no plantão. Para trocar o horário, fale com a nossa equipe.",
  closed: "Os agendamentos online estão encerrados.",
  broker_required: "O agendamento é feito pelo link do seu corretor. Peça o link a ele e tente de novo.",
};

function fail(status: number, error: string, message: string) {
  return NextResponse.json({ ok: false, error, message }, { status });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "forbidden", "Requisição não permitida.");
  if (!isDbConfigured()) {
    return fail(503, "not_configured", "A agenda ainda não está disponível. Tente novamente em breve.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "invalid", "Dados inválidos.");
  }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    return NextResponse.json(
      { ok: false, error: "invalid", message: "Confira os campos destacados.", fields },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Limite folgado de propósito: operadoras de celular compartilham o mesmo IP entre muitos clientes.
  // Robôs: campo-armadilha preenchido ou envio em menos de 2 segundos.
  if (data.website || (data.startedAt && Date.now() - data.startedAt < 2000)) {
    return fail(400, "invalid", "Não foi possível enviar. Tente novamente.");
  }

  try {
    if (!(await withTimeout(() => rateLimit("booking", clientKey(req), 30, 10)))) {
      return fail(429, "rate_limited", "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.");
    }

    const result = await withTimeout(
      () =>
        createBooking({
          slotId: data.slotId,
          name: data.name.replace(/\s+/g, " "),
          whatsapp: data.whatsapp,
          email: data.email,
          incomeRange: data.incomeRange,
          marketingOptIn: data.marketingOptIn,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
          broker: data.broker,
        }),
      12000,
    );

    if (!result.ok) {
      return fail(409, result.reason, messages[result.reason]);
    }
    // Só chega aqui depois de a reserva estar gravada no banco.
    return NextResponse.json({ ok: true, token: result.token, code: result.code });
  } catch (err) {
    console.error("[agendar] erro ao reservar", err);
    return fail(500, "server", "Não conseguimos concluir a reserva agora. Tente novamente em instantes.");
  }
}
