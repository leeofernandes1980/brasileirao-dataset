import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Brasileirão Data Lake",
  description: "Dashboard de estatísticas do Campeonato Brasileiro 2003–2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <Navbar />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
          {children}
        </main>
        <footer className="py-4 text-center text-xs"
          style={{ borderTop: "1px solid var(--border)", background: "var(--nav)", color: "var(--muted)" }}>
          Brasileirao Data Lake · 2003–2026 · Dados: Sofascore
        </footer>
      </body>
    </html>
  );
}
