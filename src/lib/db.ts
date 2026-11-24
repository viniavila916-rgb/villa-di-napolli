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
      // Conexões curtas: em hospedagem "serverless" uma conexão antiga pode
      // ficar muda depois que o servidor é pausado. Melhor abrir outra.
      idle_timeout: 10,
      max_lifetime: 300,
      connect_timeout: 8,
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

export class DbTimeoutError extends Error {
  constructor() {
    super("O banco de dados demorou demais para responder");
    this.name = "DbTimeoutError";
  }
}

/** Descarta a conexão atual; a próxima consulta abre uma nova. */
export function resetDb() {
  const old = globalRef.__vnSql;
  globalRef.__vnSql = undefined;
  old?.end({ timeout: 0 }).catch(() => {});
}

/**
 * Nenhuma consulta fica esperando para sempre: se o banco não responder
 * no prazo, a conexão é descartada e o erro aparece para quem chamou.
 */
export async function withTimeout<T>(run: () => Promise<T>, ms = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      resetDb();
      reject(new DbTimeoutError());
    }, ms);
  });
  try {
    return await Promise.race([run(), limit]);
  } finally {
    clearTimeout(timer);
  }
}

/** Para leituras: tenta uma segunda vez, já com conexão nova. */
export async function readWithRetry<T>(run: () => Promise<T>, ms = 6000): Promise<T> {
  try {
    return await withTimeout(run, ms);
  } catch (err) {
    if (!(err instanceof DbTimeoutError)) resetDb();
    return withTimeout(run, ms);
  }
}
