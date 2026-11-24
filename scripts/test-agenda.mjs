// Teste de ponta a ponta da agenda.
// ATENÇÃO: cria horários e reservas de teste. Use SOMENTE em banco de testes.
// Uso: com o site rodando (npm run dev), execute:  npm run test:agenda
//
// Simula: painel cria horários -> visitante consulta -> reserva -> confirmação
// -> duas (e depois dez) pessoas disputando o mesmo horário -> bloqueios.

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!/localhost|127\.0\.0\.1/.test(BASE) && !process.argv.includes("--banco-de-testes")) {
  console.error("Recusado: este teste grava dados. Rode apenas contra um ambiente de testes.");
  process.exit(1);
}

let passed = 0;
let failed = 0;
function check(name, cond, extra = "") {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? "  OK  " : " FALHA"}  ${name}${extra ? `  (${extra})` : ""}`);
}

let ipSeq = 10;
const post = (path, body, headers = {}) =>
  fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": `10.0.0.${ipSeq++ % 250}`, ...headers },
    body: JSON.stringify(body),
  });
const agenda = async () => (await fetch(BASE + "/api/agenda")).json();
let phoneSeq = Math.floor(Math.random() * 8000) + 1000;
const person = (slotId, extra = {}) => ({
  slotId,
  name: "Pessoa de Teste",
  whatsapp: `(47) 9${String(phoneSeq++).padStart(4, "0")}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  email: "",
  incomeRange: "",
  privacyConsent: true,
  marketingOptIn: false,
  ...extra,
});

// ---------- Painel ----------
let res = await fetch(BASE + "/api/admin/dados");
check("Painel recusa acesso sem senha", res.status === 401, `status ${res.status}`);
res = await post("/api/admin/login", { password: "senha-errada-xyz" });
check("Painel recusa senha errada", res.status === 401);
res = await post("/api/admin/login", { password: PASSWORD });
check("Painel aceita a senha correta", res.ok);
const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
const admin = (body) => post("/api/admin/acao", body, { Cookie: cookie });
const adminData = async () => (await fetch(BASE + "/api/admin/dados", { headers: { Cookie: cookie } })).json();

res = await post("/api/admin/acao", { action: "slot_delete", id: "00000000-0000-4000-8000-000000000000" });
check("Ações do painel exigem login", res.status === 401);

res = await admin({ action: "generate_slots", date: "2026-11-29", from: "20:00", to: "23:00", durationMin: 30, capacity: 1 });
check("Painel cria horários", res.ok, (await res.json()).message);

let a = await agenda();
const testSlots = a.slots.filter((s) => s.date === "2026-11-29" && s.start >= "20:00");
check("Página enxerga os horários criados", testSlots.length === 6, `${testSlots.length} horários`);
check("Agenda pública não expõe dados pessoais", !JSON.stringify(a).match(/whatsapp|name|email/i));
const [s1, s2, s3, s4, s5] = testSlots;
const before = a.availableByDate["2026-11-29"];

// ---------- Fluxo normal ----------
res = await post("/api/agendar", person(s1.id, { name: "Maria Teste da Silva" }));
let json = await res.json();
check("Reserva em horário disponível é confirmada", res.ok && json.ok && json.token);
const page = await (await fetch(`${BASE}/confirmado/${json.token}`)).text();
check("Página de confirmação mostra nome, data e horário", page.includes("Maria Teste da Silva") && page.includes("29/11") && page.includes(s1.start));
check("Página de confirmação tem link do Google Agenda com a data certa", page.includes("calendar.google.com") && page.includes(`20261129T${s1.start.replace(":", "")}00`));
res = await fetch(`${BASE}/confirmado/00000000-0000-4000-8000-000000000000`);
check("Confirmação inexistente não abre (sem confirmação falsa)", res.status === 404);

a = await agenda();
check("Horário reservado passa a indisponível", a.slots.find((s) => s.id === s1.id).state === "unavailable");
check("Contagem de horários livres diminui em 1", a.availableByDate["2026-11-29"] === before - 1);

res = await post("/api/agendar", person(s1.id));
json = await res.json();
check("Segunda pessoa no mesmo horário é recusada", res.status === 409 && json.error === "slot_taken", json.message);

// ---------- Link do corretor ----------
res = await post("/api/agendar", person(testSlots[5].id, { name: "Cliente do Corretor", broker: "Vinícius Ávila!" }));
check("Reserva pelo link do corretor é confirmada", res.ok);
let dd = await adminData();
const viaBroker = dd.bookings.find((b) => b.name === "Cliente do Corretor");
check("Painel registra o corretor do link (nome limpo)", viaBroker?.broker === "viniciusavila", viaBroker?.broker);
check("Reserva sem link fica sem corretor", dd.bookings.find((b) => b.name === "Maria Teste da Silva")?.broker === null);
await admin({ action: "booking_status", id: viaBroker.id, status: "cancelled" });

// ---------- Validação ----------
res = await post("/api/agendar", person(s2.id, { name: "Maria" }));
check("Recusa nome incompleto", res.status === 400);
res = await post("/api/agendar", person(s2.id, { whatsapp: "(47) 1234" }));
check("Recusa telefone inválido", res.status === 400);
res = await post("/api/agendar", person(s2.id, { privacyConsent: false }));
check("Recusa sem aceite de privacidade", res.status === 400);
res = await post("/api/agendar", person(s2.id, { website: "http://spam" }));
check("Recusa robô (campo-armadilha)", res.status === 400);
res = await post("/api/agendar", person("00000000-0000-4000-8000-000000000000"));
check("Recusa horário inexistente", res.status === 409);
a = await agenda();
check("Tentativas inválidas não ocuparam o horário", a.slots.find((s) => s.id === s2.id).state === "available");

// ---------- Corrida: 2 pessoas, mesmo horário, mesmo instante ----------
let results = await Promise.all([post("/api/agendar", person(s2.id)), post("/api/agendar", person(s2.id))]);
let ok = results.filter((r) => r.ok).length;
check("Corrida de 2 pessoas: exatamente 1 confirma", ok === 1 && results.filter((r) => r.status === 409).length === 1, `${ok} confirmada(s)`);

// ---------- Corrida: 10 pessoas ----------
results = await Promise.all(Array.from({ length: 10 }, () => post("/api/agendar", person(s3.id))));
ok = results.filter((r) => r.ok).length;
check("Corrida de 10 pessoas: exatamente 1 confirma", ok === 1 && results.filter((r) => r.status === 409).length === 9, `${ok} confirmada(s)`);

// ---------- Capacidade 3 com 10 pessoas ----------
await admin({ action: "slot_capacity", id: s4.id, capacity: 3 });
results = await Promise.all(Array.from({ length: 10 }, () => post("/api/agendar", person(s4.id))));
ok = results.filter((r) => r.ok).length;
check("Horário com 3 vagas e 10 pessoas: exatamente 3 confirmam", ok === 3, `${ok} confirmada(s)`);

// ---------- Mesmo WhatsApp duas vezes ----------
const same = person(s5.id);
res = await post("/api/agendar", same);
check("Reserva para testar duplicidade", res.ok);
res = await post("/api/agendar", { ...same, slotId: testSlots[5].id });
json = await res.json();
check("Mesmo WhatsApp não reserva dois horários", res.status === 409 && json.error === "duplicate_phone");

// ---------- Bloqueio manual e cancelamento ----------
await admin({ action: "slot_status", id: testSlots[5].id, status: "blocked" });
a = await agenda();
check("Horário bloqueado no painel aparece indisponível", a.slots.find((s) => s.id === testSlots[5].id).state === "unavailable");
res = await post("/api/agendar", person(testSlots[5].id));
json = await res.json();
check("Servidor recusa reserva em horário bloqueado", res.status === 409 && json.error === "slot_blocked");
await admin({ action: "slot_status", id: testSlots[5].id, status: "open" });

let d = await adminData();
const first = d.bookings.find((b) => b.name === "Maria Teste da Silva");
check("Painel lista a reserva com nome e telefone", Boolean(first && first.whatsapp));
res = await admin({ action: "slot_delete", id: s1.id });
check("Painel não exclui horário com reserva", res.status === 409);
await admin({ action: "booking_status", id: first.id, status: "cancelled" });
a = await agenda();
check("Cancelar no painel libera o horário na página", a.slots.find((s) => s.id === s1.id).state === "available");
res = await post("/api/agendar", person(s1.id));
check("Horário liberado pode ser reservado de novo", res.ok);
res = await admin({ action: "booking_status", id: first.id, status: "confirmed" });
check("Reativar reserva cancelada em horário já ocupado é recusado", res.status === 409);

// ---------- Unidades e configurações ----------
a = await agenda();
check("Contador de unidades fica oculto por padrão", a.units === null);
await admin({ action: "units_add", labels: ["TESTE-A", "TESTE-B", "TESTE-C"] });
await admin({ action: "settings_save", values: { show_units_counter: "true" } });
a = await agenda();
check("Contador mostra a quantidade real cadastrada", a.units && a.units.available >= 3, `${a.units?.available}`);
res = await admin({ action: "settings_save", values: { whatsapp_group_url: "javascript:alert(1)" } });
check("Painel recusa link inválido", res.status === 400);

// encerramento no passado -> página para de aceitar reservas
d = await adminData();
const originalEnd = d.settings.campaign_end_at;
await admin({ action: "settings_save", values: { campaign_end_at: "2020-01-01T00:00:00-03:00" } });
res = await post("/api/agendar", person(testSlots[5].id));
json = await res.json();
check("Depois do encerramento o servidor não aceita reservas", res.status === 409 && json.error === "closed");
a = await agenda();
check("Depois do encerramento nenhum horário aparece disponível", a.slots.every((s) => s.state !== "available"));
await admin({ action: "settings_save", values: { campaign_end_at: originalEnd, show_units_counter: "false" } });

res = await fetch(BASE + "/api/admin/exportar", { headers: { Cookie: cookie } });
const csv = await res.text();
check("Planilha CSV dos agendamentos é gerada", res.ok && csv.includes("WhatsApp") && csv.includes("Pessoa de Teste"));
check("Planilha traz a coluna Corretor", csv.includes("Corretor") && csv.includes("viniciusavila"));
res = await fetch(BASE + "/api/admin/exportar");
check("Planilha exige login", res.status === 401);

// ---------- Planilha automática (Google Planilhas) ----------
if (process.env.PLANILHA_KEY) {
  res = await fetch(BASE + "/api/planilha");
  check("Planilha automática recusa acesso sem chave", res.status === 401);
  res = await fetch(BASE + "/api/planilha?chave=chave-errada-000000000000");
  check("Planilha automática recusa chave errada", res.status === 401);
  res = await fetch(BASE + "/api/planilha?chave=" + encodeURIComponent(process.env.PLANILHA_KEY));
  const auto = await res.text();
  check("Planilha automática entrega os agendamentos com a chave certa", res.ok && auto.includes("Corretor") && auto.includes("Pessoa de Teste"));
  const active = (await adminData()).bookings.length;
  check("Planilha automática tem uma linha por agendamento", auto.trim().split("\r\n").length === active + 1, `${active} agendamentos`);
}

// ---------- Agenda por corretor (links separados, sem distribuição) ----------
await admin({ action: "generate_slots", date: "2026-11-28", from: "20:00", to: "22:00", durationMin: 30, capacity: 1 });
const agendaDe = async (slug) => (await fetch(BASE + "/api/agenda" + (slug ? "?corretor=" + slug : ""))).json();
a = await agenda();
const [b1, b2, b3, b4] = a.slots.filter((s) => s.date === "2026-11-28" && s.start >= "20:00");
await admin({ action: "broker_add", name: "Teste Vinícius Ávila" });
await admin({ action: "broker_add", name: "Teste Rafael Souza" });
const V = "testeviniciusavila";
const R = "testerafaelsouza";

let av = await agendaDe(V);
check("Link do corretor mostra o nome dele e os horários livres", av.broker?.name === "Teste Vinícius Ávila" && av.slots.find((s) => s.id === b1.id).state === "available");
let ag = await agendaDe("");
check("Link sem corretor não mostra horários (sem distribuição)", ag.brokerRequired === true && ag.slots.every((s) => s.state !== "available"));
res = await post("/api/agendar", person(b1.id));
json = await res.json();
check("Servidor recusa reserva sem link de corretor", res.status === 409 && json.error === "broker_required", json.message);
res = await post("/api/agendar", person(b1.id, { broker: "corretor-que-nao-existe" }));
check("Servidor recusa link de corretor desconhecido", res.status === 409);

res = await post("/api/agendar", person(b1.id, { broker: V, name: "Cliente do Vinicius" }));
json = await res.json();
check("Cliente do Vinícius reserva o horário", res.ok);
const pageV = await (await fetch(`${BASE}/confirmado/${json.token}`)).text();
check("Confirmação mostra o nome do corretor", pageV.includes("Teste Vinícius Ávila"));
av = await agendaDe(V);
const ar = await agendaDe(R);
check("No link do Vinícius o horário fica indisponível", av.slots.find((s) => s.id === b1.id).state === "unavailable");
check("No link do Rafael o MESMO horário continua disponível", ar.slots.find((s) => s.id === b1.id).state === "available");
res = await post("/api/agendar", person(b1.id, { broker: R, name: "Cliente do Rafael" }));
check("Cliente do Rafael reserva o mesmo horário", res.ok);
res = await post("/api/agendar", person(b1.id, { broker: V }));
json = await res.json();
check("Segundo cliente no mesmo horário do Vinícius é recusado", res.status === 409 && json.error === "slot_taken");

results = await Promise.all(Array.from({ length: 10 }, () => post("/api/agendar", person(b2.id, { broker: V }))));
ok = results.filter((r) => r.ok).length;
check("Corrida de 10 pessoas no mesmo horário de um corretor: exatamente 1 confirma", ok === 1, `${ok} confirmada(s)`);
results = await Promise.all([
  ...Array.from({ length: 5 }, () => post("/api/agendar", person(b3.id, { broker: V }))),
  ...Array.from({ length: 5 }, () => post("/api/agendar", person(b3.id, { broker: R }))),
]);
ok = results.filter((r) => r.ok).length;
check("Corrida com 2 corretores no mesmo horário: exatamente 1 por corretor", ok === 2, `${ok} confirmada(s)`);
d = await adminData();
const onB3 = d.bookings.filter((b) => b.slot_id === b3.id && b.status !== "cancelled").map((b) => b.broker).sort();
check("Cada reserva ficou com o corretor do próprio link", onB3.join() === [R, V].sort().join(), onB3.join());

await admin({ action: "broker_block", slotId: b4.id, slug: R, blocked: true });
check("Bloqueio de um corretor em um horário vale só para ele",
  (await agendaDe(R)).slots.find((s) => s.id === b4.id).state === "unavailable" &&
  (await agendaDe(V)).slots.find((s) => s.id === b4.id).state === "available");
res = await post("/api/agendar", person(b4.id, { broker: R }));
check("Servidor recusa reserva em horário bloqueado do corretor", res.status === 409);

await admin({ action: "settings_save", values: { default_broker: V } });
ag = await agendaDe("");
check("Com corretor do link geral definido, o link geral usa a agenda dele", ag.brokerRequired === false && ag.broker?.slug === V && ag.slots.find((s) => s.id === b1.id).state === "unavailable" && ag.slots.find((s) => s.id === b4.id).state === "available");
res = await post("/api/agendar", person(b4.id, { name: "Cliente do Link Geral" }));
check("Reserva pelo link geral vai para o corretor definido", res.ok);
d = await adminData();
const geral = d.bookings.find((b) => b.name === "Cliente do Link Geral");
check("Painel registra corretor e tipo de link", geral?.broker === V && geral?.broker_source === "geral");
await admin({ action: "settings_save", values: { default_broker: "" } });

await admin({ action: "broker_active", slug: V, active: false });
await admin({ action: "broker_active", slug: R, active: false });
ag = await agendaDe("");
check("Sem corretores ativos, volta a agenda única", ag.brokerRequired === false);
d = await adminData();
for (const b of d.bookings.filter((b) => [V, R].includes(b.broker))) await admin({ action: "booking_status", id: b.id, status: "cancelled" });
await admin({ action: "broker_delete", slug: V });
await admin({ action: "broker_delete", slug: R });

// ---------- Limpeza dos dados de teste ----------
d = await adminData();
for (const u of d.units.filter((u) => u.label.startsWith("TESTE-"))) await admin({ action: "unit_delete", id: u.id });

console.log(`\n${passed} verificações OK, ${failed} falha(s).`);
console.log("Obs.: os horários e reservas de teste (29/11, 20:00–23:00) ficam no banco. Apague o banco de testes ao terminar.");
process.exit(failed ? 1 : 0);
