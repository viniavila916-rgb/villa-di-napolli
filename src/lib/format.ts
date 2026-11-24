/** Mantém só os números do telefone. */
export function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

/** Máscara de telefone brasileiro: (47) 99999-9999 */
export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Celular brasileiro com DDD: 11 dígitos, começando por 9 após o DDD. */
export function isValidWhatsapp(v: string) {
  const d = onlyDigits(v);
  if (d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (d[2] !== "9") return false;
  return !/^(\d)\1+$/.test(d.slice(2));
}

export function isFullName(v: string) {
  const parts = v.trim().split(/\s+/).filter((p) => p.length >= 2);
  return parts.length >= 2 && /^[\p{L}\s.'-]+$/u.test(v.trim());
}

/**
 * Identificação do corretor no link (?corretor=viniciusavila).
 * Fica só com letras minúsculas, números, ponto, hífen e sublinhado.
 */
export function cleanBroker(v: string | null | undefined) {
  if (!v) return "";
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 40);
}
