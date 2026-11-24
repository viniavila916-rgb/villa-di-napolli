/**
 * Rastreamento (Google Tag Manager, GA4 e Meta Pixel).
 * Os IDs vêm das variáveis de ambiente; sem ID, nada é carregado.
 * Eventos só são disparados por ações reais do visitante.
 */

import { cleanBroker } from "./format";

export const trackingIds = {
  gtm: process.env.NEXT_PUBLIC_GTM_ID || "",
  ga4: process.env.NEXT_PUBLIC_GA4_ID || "",
  metaPixel: process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
};

export const hasTracking = Boolean(trackingIds.gtm || trackingIds.ga4 || trackingIds.metaPixel);

/** Por padrão os scripts só carregam depois do aceite de cookies. */
export const requireConsent = process.env.NEXT_PUBLIC_REQUIRE_COOKIE_CONSENT !== "false";

export type TrackEvent =
  | "page_view"
  | "view_calendar"
  | "select_event_date"
  | "select_time_slot"
  | "begin_registration"
  | "complete_registration"
  | "click_whatsapp_group";

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    __vnFbQueue?: [TrackEvent, Params][];
  }
}

function sendToMeta(event: TrackEvent, params: Params) {
  if (!window.fbq) return;
  if (event === "page_view") return; // o PageView é enviado na inicialização do Pixel
  if (event === "complete_registration") window.fbq("track", "CompleteRegistration", params);
  else window.fbq("trackCustom", event, params);
}

export function track(event: TrackEvent, params: Params = {}) {
  if (typeof window === "undefined") return;
  // GTM: a fila fica só no navegador até o GTM ser carregado (após o aceite).
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });

  // GA4 direto (sem GTM). O page_view é automático no GA4.
  if (trackingIds.ga4 && window.gtag && event !== "page_view") {
    window.gtag("event", event, params);
  }

  if (trackingIds.metaPixel) {
    if (window.fbq) sendToMeta(event, params);
    else (window.__vnFbQueue = window.__vnFbQueue || []).push([event, params]);
  }
}

/** Chamado quando o Pixel termina de carregar: envia o que ficou na fila. */
export function flushMetaQueue() {
  const queue = window.__vnFbQueue || [];
  window.__vnFbQueue = [];
  for (const [event, params] of queue) sendToMeta(event, params);
}

/** Dispara um evento uma única vez por aba/navegador para a mesma chave. */
export function trackOnce(key: string, event: TrackEvent, params: Params = {}) {
  try {
    const k = `vn_evt_${key}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
  } catch {
    /* sem armazenamento: segue e dispara */
  }
  track(event, params);
}

const UTM_KEY = "vn_utm";
const BROKER_KEY = "vn_corretor";
export type Utm = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  broker?: string;
};

/** Guarda a origem do anúncio (utm_*) para registrar junto com a reserva. */
export function captureUtm() {
  try {
    const q = new URLSearchParams(window.location.search);
    const utm: Utm = {
      utmSource: q.get("utm_source")?.slice(0, 100) || undefined,
      utmMedium: q.get("utm_medium")?.slice(0, 100) || undefined,
      utmCampaign: q.get("utm_campaign")?.slice(0, 100) || undefined,
    };
    if (utm.utmSource || utm.utmMedium || utm.utmCampaign) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
    }
    // Link do corretor: ?corretor=nome (ou a forma curta ?c=nome).
    // Fica guardado neste aparelho: se o cliente voltar depois sem o
    // link, a indicação continua valendo. Um novo link substitui o anterior.
    const broker = cleanBroker(q.get("corretor") || q.get("c"));
    if (broker) localStorage.setItem(BROKER_KEY, broker);
  } catch {
    /* ignora */
  }
}

export function readUtm(): Utm {
  let utm: Utm = {};
  try {
    utm = JSON.parse(sessionStorage.getItem(UTM_KEY) || "{}") as Utm;
  } catch {
    /* ignora */
  }
  try {
    const broker = cleanBroker(localStorage.getItem(BROKER_KEY));
    if (broker) utm.broker = broker;
  } catch {
    /* ignora */
  }
  return utm;
}
