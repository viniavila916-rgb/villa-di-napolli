import postgres from "postgres";

export class DbNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL não configurada");
    this.name = "DbNotConfiguredError";
  }
}

type Sql = ReturnType<typeof postgres>;
const globalRef = globalThis as unknown as { __vnSql?: Sql };

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Conexão única reaproveitada entre requisições.
 * `prepare: false` é necessário para o "Transaction pooler" do Supabase.
 */
export function db(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DbNotConfiguredError();
  if (!globalRef.__vnSql) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const sslOff = process.env.DATABASE_SSL === "disable" || local;
    globalRef.__vnSql = postgres(url, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: sslOff ? false : "require",
      onnotice: () => {},
    });
  }
  return globalRef.__vnSql;
}

/** Código de erro do PostgreSQL (ex.: 23505 = valor duplicado). */
export function pgCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return undefined;
}
