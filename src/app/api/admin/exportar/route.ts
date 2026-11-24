import { NextResponse } from "next/server";
import { bookingsCsv } from "@/lib/csv";
import { readWithRetry } from "@/lib/db";
import { isAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Planilha (CSV) dos agendamentos — abre direto no Excel. */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  return new NextResponse(await readWithRetry(bookingsCsv), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="agendamentos-black-november.csv"',
      "Cache-Control": "no-store",
    },
  });
}
