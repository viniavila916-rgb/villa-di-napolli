// Cria (ou atualiza) as tabelas no banco indicado em DATABASE_URL.
// Uso: npm run db:setup
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL antes de rodar (veja .env.example).");
  process.exit(1);
}
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, {
  prepare: false,
  max: 1,
  ssl: process.env.DATABASE_SSL === "disable" || local ? false : "require",
  onnotice: () => {},
});
try {
  await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  console.log("Banco pronto: tabelas e regras criadas.");
} finally {
  await sql.end();
}
