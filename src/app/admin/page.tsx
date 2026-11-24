import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";

export const metadata: Metadata = {
  title: "Painel do plantão | Black November Villa di Napoli",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanel />;
}
