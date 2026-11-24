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
      max: 4,
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

/**
 * Troca a conexão por uma nova, SOMENTE se a conexão com problema ainda
 * for a atual. Assim, várias requisições que falham ao mesmo tempo não
 * derrubam a conexão nova umas das outras. A antiga é encerrada com
 * calma, para não cortar consultas que ainda estejam terminando.
 */
function replaceDb(failed: Sql | undefined) {
  if (!failed || globalRef.__vnSql !== failed) return;
  globalRef.__vnSql = undefined;
  failed.end({ timeout: 5 }).catch(() => {});
}

const CONNECTION_ERRORS = new Set([
  "CONNECTION_DESTROYED",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECT_TIMEOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "57P01", // conexão encerrada pelo servidor do banco
  "08006",
  "08003",
]);

/** true quando o problema foi de conexão (e não de dados ou de SQL). */
export function isConnectionError(err: unknown) {
  return err instanceof DbTimeoutError || CONNECTION_ERRORS.has(pgCode(err) ?? "");
}

/**
 * Nenhuma consulta fica esperando para sempre: se o banco não responder
 * no prazo, quem chamou recebe o erro e a conexão é trocada por uma nova.
 */
export async function withTimeout<T>(run: () => Promise<T>, ms = 8000): Promise<T> {
  const used = isDbConfigured() ? db() : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DbTimeoutError()), ms);
  });
  try {
    return await Promise.race([run(), limit]);
  } catch (err) {
    if (isConnectionError(err)) replaceDb(used);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Para leituras: se a falha foi de conexão, tenta de novo (até 3 vezes),
 * já com conexão nova. Erros de dados ou de SQL não são repetidos.
 */
export async function readWithRetry<T>(run: () => Promise<T>, ms = 7000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await withTimeout(run, ms);
    } catch (err) {
      lastError = err;
      if (!isConnectionError(err)) throw err;
    }
  }
  throw lastError;
}
