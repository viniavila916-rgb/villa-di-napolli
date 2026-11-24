import { NextResponse } from "next/server";
import { campaign } from "@/config/campaign";
import { isDbConfigured, readWithRetry } from "@/lib/db";
import { getPublicAgenda } from "@/lib/schedule";
import type { AgendaResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store, max-age=0" };

function emptyAgenda(): AgendaResponse {
  return {
    configured: false,
    serverTime: new Date().toISOString(),
    campaignEndAt: campaign.defaultEndAt,
    bookingEnabled: false,
    slots: [],
    availableByDate: {},
    broker: null,
    brokerRequired: false,
    units: null,
  };
}

/** Disponibilidade real da agenda. Não devolve nenhum dado pessoal. */
export async function GET(req: Request) {
  const broker = new URL(req.url).searchParams.get("corretor");
  if (!isDbConfigured()) return NextResponse.json(emptyAgenda(), { headers: noStore });
  try {
    return NextResponse.json(await readWithRetry(() => getPublicAgenda(broker)), { headers: noStore });
  } catch (err) {
    console.error("[agenda] falha ao consultar o banco", err);
    return NextResponse.json(emptyAgenda(), { status: 503, headers: noStore });
  }
}
