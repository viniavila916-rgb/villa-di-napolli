import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource-variable/figtree/wght.css";
import "./globals.css";
import { Analytics } from "@/components/Analytics";
import { siteUrl } from "@/config/campaign";

const title = "Black November Villa di Napoli | Plantão 27, 28 e 29 de novembro em Tijucas/SC";
const description =
  "Reserve seu horário no plantão presencial do Residencial Villa di Napoli, da AMC Construções. Primeiro imóvel pelo Minha Casa Minha Vida, com condições exclusivas apresentadas no atendimento.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Residencial Villa di Napoli",
    title,
    description,
    images: [
      {
        url: "/images/piscina-panorama.jpg",
        width: 1333,
        height: 832,
        alt: "Perspectiva ilustrada da piscina do Residencial Villa di Napoli",
      },
    ],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/images/piscina-panorama.jpg"] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#131417",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="antialiased">
      <body className="min-h-dvh">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
