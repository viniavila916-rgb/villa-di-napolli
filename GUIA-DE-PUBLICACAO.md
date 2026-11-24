# Guia de publicação — Black November Villa di Napoli

Este guia leva a página do seu computador para a internet. São 5 etapas.
Os nomes dos botões do Supabase e da Vercel podem mudar um pouco com o tempo; a lógica é a mesma.

> Atalho: se você usa o Claude Code no Mac, abra esta pasta nele e peça:
> "Publique este projeto seguindo o arquivo GUIA-DE-PUBLICACAO.md". Ele executa as etapas com você.

## O que você vai precisar

| Item | Para que serve | Onde criar |
|---|---|---|
| Conta no Supabase | Guardar horários e agendamentos (banco de dados) | supabase.com |
| Conta no GitHub | Guardar os arquivos do projeto | github.com |
| Conta na Vercel | Colocar o site no ar | vercel.com |
| Domínio (opcional) | Endereço próprio, ex.: blacknovember.seudominio.com.br | Onde a AMC registra domínios |

Observação: o plano gratuito da Vercel é voltado a uso pessoal. Para uma campanha comercial, confira os termos e considere o plano pago. O projeto também roda no Railway, com o banco PostgreSQL do próprio Railway, usando as mesmas variáveis.

## Etapa 1 — Criar o banco de dados (Supabase)

1. Entre em supabase.com e clique em **New project**.
2. Dê um nome (ex.: `villa-di-napoli`), crie uma **senha do banco** e guarde-a. Escolha a região **South America (São Paulo)**.
3. Com o projeto criado, abra **SQL Editor** no menu lateral e clique em **New query**.
4. Abra o arquivo `db/schema.sql` deste projeto, copie todo o conteúdo, cole no editor e clique em **Run**. Deve aparecer "Success".
5. Clique no botão **Connect** (no topo). Em **Transaction pooler**, copie o endereço que começa com `postgresql://`. Troque `[YOUR-PASSWORD]` pela senha do passo 2.
   Esse endereço é o valor da variável `DATABASE_URL`. Não compartilhe com ninguém.

## Etapa 2 — Enviar o projeto para o GitHub

1. Instale o **GitHub Desktop** (desktop.github.com) e entre com a sua conta.
2. Menu **File > Add Local Repository** e escolha a pasta deste projeto.
3. Clique em **Publish repository** e deixe marcada a opção **Keep this code private**.

## Etapa 3 — Colocar o site no ar (Vercel)

1. Entre em vercel.com com a conta do GitHub e clique em **Add New > Project**.
2. Escolha o repositório que você acabou de publicar e clique em **Import**.
3. Antes de clicar em Deploy, abra **Environment Variables** e cadastre:

| Nome | Valor | Obrigatória |
|---|---|---|
| `DATABASE_URL` | O endereço copiado na Etapa 1 | Sim |
| `ADMIN_PASSWORD` | A senha do painel (mínimo 8 caracteres, forte) | Sim |
| `NEXT_PUBLIC_SITE_URL` | O endereço do site, ex.: `https://blacknovember.seudominio.com.br` | Sim |
| `ADMIN_SESSION_SECRET` | Um texto aleatório longo (pode bater no teclado 40 letras) | Recomendada |
| `NEXT_PUBLIC_META_PIXEL_ID` | ID do Pixel da Meta | Se usar |
| `NEXT_PUBLIC_GA4_ID` | ID do Google Analytics 4 (começa com `G-`) | Se usar |
| `NEXT_PUBLIC_GTM_ID` | ID do Google Tag Manager (começa com `GTM-`) | Se usar |
| `NEXT_PUBLIC_REQUIRE_COOKIE_CONSENT` | `true` (padrão) ou `false` | Opcional |
| `PLANILHA_KEY` | Chave secreta (20+ caracteres) para a planilha automática | Se usar |

4. Clique em **Deploy** e aguarde. A Vercel mostra o endereço do site.
5. Para usar domínio próprio: **Settings > Domains** e siga as instruções. O HTTPS é automático.

Use GTM **ou** GA4 + Pixel diretos. Se cadastrar os três e o GTM também tiver as tags, os eventos são contados em dobro.
Sempre que mudar uma variável, clique em **Redeploy** para valer.

## Etapa 4 — Preencher o painel

Abra `https://SEU-SITE/admin` e entre com a senha `ADMIN_PASSWORD`.
O painel mostra uma caixa amarela "Pendências antes de divulgar" até tudo estar preenchido.

| Aba | O que fazer |
|---|---|
| Horários | Em "Criar horários", escolha o dia, o horário inicial e final, os minutos por atendimento e quantos atendimentos acontecem ao mesmo tempo. Repita para os 3 dias. Use **Bloquear** para tirar um horário da página (almoço, corretor ausente). |
| Configurações | Endereço do plantão, link do mapa, orientações, link da Lista VIP do WhatsApp, horário de encerramento da campanha e dados da política de privacidade. |
| Unidades (opcional) | Cadastre as unidades participantes e ligue o contador só se a lista for mantida atualizada. |
| Agendamentos | Lista de inscritos com nome e WhatsApp, filtro por dia, mudança de situação e planilha (CSV) para o Excel. |

A página só mostra horários que existirem no painel. Enquanto não houver horários, aparece "A agenda do plantão abre em breve".

## Etapa 5 — Testar antes de divulgar

1. Abra o site no celular, escolha um dia e um horário, preencha com os seus dados e confirme.
2. Confira a página de confirmação, o botão do Google Agenda e o convite do WhatsApp.
3. Volte à página: o horário que você reservou deve aparecer como **Indisponível**.
4. No painel, marque o seu teste como **Cancelado**: o horário volta a ficar disponível.
5. Se configurou Pixel/GA4, confira nos painéis da Meta e do Google se os eventos chegaram.

## Link de cada corretor

Cada corretor divulga o endereço do site com o nome dele no final:

```
https://SEU-SITE/?corretor=viniciusavila
```

- O cliente vê a página normal. O agendamento fica registrado com o corretor.
- No painel, aba Agendamentos, o bloco "Link do corretor" monta o link: digite o nome e clique em Copiar link.
- A coluna **Corretor**, o filtro por corretor e o quadro "Agendamentos por corretor" mostram o resultado de cada um. A planilha (CSV) também traz a coluna.
- O nome no link usa só letras minúsculas e números, sem espaço e sem acento (o painel já gera assim).
- Quem entra pelo link normal, sem corretor, aparece como "Sem corretor".

## Planilha que se atualiza sozinha (Google Planilhas)

Os agendamentos aparecem em uma planilha do Google, atualizada a cada 1 minuto, sem baixar nada.

1. Na Vercel, em **Settings > Environment Variables**, crie `PLANILHA_KEY` com uma chave secreta de pelo menos 20 letras e números (invente uma, sem espaços nem símbolos). Depois faça **Redeploy**.
2. Crie uma planilha nova no Google Planilhas.
3. Menu **Extensões > Apps Script**. Apague o que estiver escrito.
4. Abra o arquivo `scripts/google-planilha.gs` deste projeto, copie tudo e cole lá.
5. Na linha `ENDERECO`, troque `SEU-SITE` pelo endereço do site e `SUA-CHAVE-SECRETA` pela chave do passo 1.
6. Clique em **Salvar**. No seletor de função (no topo), escolha `ligarAtualizacaoAutomatica` e clique em **Executar**.
7. O Google pede autorização na primeira vez: escolha a sua conta e clique em **Permitir**.

Pronto: a aba "Agendamentos" passa a se atualizar sozinha, incluindo cancelamentos e mudanças de situação.

- A aba "Agendamentos" é reescrita a cada atualização. Faça anotações em outra aba.
- Quem tiver acesso à planilha vê nomes e telefones. Compartilhe só com a equipe.
- Se a chave vazar, troque o valor de `PLANILHA_KEY` na Vercel, faça Redeploy e atualize a linha `ENDERECO`.
- Para desligar: execute a função `desligarAtualizacaoAutomatica`.

## Eventos de medição enviados

| Evento | Quando acontece |
|---|---|
| `page_view` | A página abre |
| `view_calendar` | O calendário aparece na tela |
| `select_event_date` | A pessoa toca em 27, 28 ou 29 |
| `select_time_slot` | A pessoa escolhe um horário disponível |
| `begin_registration` | A pessoa começa a preencher o formulário |
| `complete_registration` | A reserva foi gravada (enviado na página de confirmação; no Pixel vira `CompleteRegistration`) |
| `click_whatsapp_group` | A pessoa toca no botão da Lista VIP do WhatsApp |

## Onde mudar cada coisa

| Quero mudar | Onde |
|---|---|
| Horários, bloqueios, vagas por horário | Painel > Horários |
| Endereço, WhatsApp, encerramento, pausar agenda | Painel > Configurações |
| Textos das perguntas frequentes, faixas de renda, dados do empreendimento | Arquivo `src/config/campaign.ts` |
| Tirar a chamada "só em dezembro" | `src/config/campaign.ts`, linha `showDecemberOffer: false` |
| Fotos do café | Coloque em `public/images` e informe o caminho em `coffeeImages`, no mesmo arquivo |
| Textos das seções | Arquivo `src/app/page.tsx` |
| Fotos e plantas | Pasta `public/images` (mantenha os mesmos nomes de arquivo) |

## Rodar no seu computador (opcional)

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL e ADMIN_PASSWORD
npm run db:setup             # cria as tabelas (alternativa ao SQL Editor)
npm run dev                  # abre em http://localhost:3000
```

`npm run test:agenda` executa 47 verificações automáticas, incluindo duas e dez pessoas disputando o mesmo horário. Ele grava dados de teste: use somente em um banco de testes.
