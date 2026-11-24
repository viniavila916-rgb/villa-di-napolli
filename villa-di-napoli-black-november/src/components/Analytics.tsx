"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import {
  captureUtm,
  flushMetaQueue,
  hasTracking,
  requireConsent,
  track,
  trackingIds,
} from "@/lib/tracking";

const KEY = "vn_cookie_consent";
type Consent = "granted" | "denied" | "unset";

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function read(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
}
function write(v: Consent) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ignora */
  }
  listeners.forEach((l) => l());
}

/**
 * Carrega GTM / GA4 / Meta Pixel somente se houver ID configurado e,
 * por padrão, somente depois que o visitante aceitar os cookies.
 */
export function Analytics() {
  const consent = useSyncExternalStore<Consent | "server">(subscribe, read, () => "server");
  const allowed = hasTracking && (!requireConsent || consent === "granted");

  useEffect(() => {
    captureUtm();
    track("page_view", { page_path: window.location.pathname });
  }, []);

  const { gtm, ga4, metaPixel } = trackingIds;

  return (
    <>
      {allowed && gtm && (
        <Script id="vn-gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtm)});`}
        </Script>
      )}
      {allowed && ga4 && (
        <>
          <Script
            id="vn-ga4-src"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`}
          />
          <Script id="vn-ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(ga4)});`}
          </Script>
        </>
      )}
      {allowed && metaPixel && (
        <Script id="vn-meta" strategy="afterInteractive" onReady={flushMetaQueue}>
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(metaPixel)});fbq('track','PageView');`}
        </Script>
      )}

      {hasTracking && requireConsent && consent === "unset" && (
        <div
          role="dialog"
          aria-label="Aviso de cookies"
          className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-2xl border border-line bg-ink-2 p-4 text-sm text-paper shadow-2xl md:bottom-4"
        >
          <p className="text-mist">
            Usamos cookies para medir o resultado desta campanha. Você pode aceitar ou recusar; o
            agendamento funciona das duas formas.{" "}
            <Link href="/privacidade" className="underline underline-offset-2 text-paper">
              Política de privacidade
            </Link>
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => write("granted")}
              className="min-h-11 flex-1 rounded-full bg-gold px-4 font-semibold text-ink"
            >
              Aceitar
            </button>
            <button
              type="button"
              onClick={() => write("denied")}
              className="min-h-11 flex-1 rounded-full border border-line px-4 font-semibold text-paper"
            >
              Recusar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
