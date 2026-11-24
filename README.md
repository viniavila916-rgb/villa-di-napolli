# Black November Villa di Napoli — Landing Page de agendamento

Landing page da campanha Black November do Residencial Villa di Napoli (AMC Construções, Tijucas/SC), com agenda real do plantão de 27, 28 e 29/11/2026.

**Para publicar, siga o [GUIA-DE-PUBLICACAO.md](./GUIA-DE-PUBLICACAO.md).**

## O que tem aqui

| Parte | Caminho |
|---|---|
| Página (11 seções) | `src/app/page.tsx` |
| Calendário, horários e formulário | `src/components/Booking.tsx` |
| Página de confirmação + WhatsApp | `src/app/confirmado/[token]/page.tsx` |
| Painel administrativo | `/admin` — `src/components/AdminPanel.tsx` |
| Política de privacidade | `src/app/privacidade/page.tsx` |
| Textos e dados da campanha | `src/config/campaign.ts` |
| Regras da agenda (servidor) | `src/lib/schedule.ts` |
| Banco de dados | `db/schema.sql` |
| Medição (GTM, GA4, Meta Pixel) | `src/lib/tracking.ts`, `src/components/Analytics.tsx` |

## Como a reserva é protegida

- A disponibilidade vem sempre do banco (`/api/agenda`); a página atualiza a cada 20 segundos.
- A reserva é um único `INSERT`. Uma regra no próprio banco (`enforce_slot_rules`) trava o horário, confere capacidade, bloqueio e data, e recusa o que não couber. Duas pessoas no mesmo instante: só uma confirma.
- Com corretores cadastrados, a agenda é por corretor: cada link (`?corretor=nome`) tem a própria disponibilidade, uma vaga por horário, sem distribuição automática.
- Um mesmo WhatsApp não mantém duas reservas confirmadas (índice único).
- A página de confirmação só existe para reservas gravadas; o evento de conversão é disparado nela.
- Dados pessoais só saem pelas rotas do painel, que exigem login. As tabelas têm RLS ligado sem políticas públicas.

## Tecnologia

Next.js 16 (App Router), TypeScript, Tailwind CSS 4, PostgreSQL (Supabase ou qualquer Postgres 13+) via `postgres`, validação com `zod`.
