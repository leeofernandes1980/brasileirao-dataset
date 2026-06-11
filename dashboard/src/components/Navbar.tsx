"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BarChart2, Home, Users, Calendar, Swords, Search } from "lucide-react";

const links = [
  { href: "/",           label: "Início",     icon: Home },
  { href: "/temporadas", label: "Temporadas", icon: Calendar },
  { href: "/times",      label: "Times",      icon: Users },
  { href: "/confrontos", label: "Confrontos", icon: Swords },
  { href: "/consultas",  label: "Consultas",  icon: Search },
];

export default function Navbar() {
  const path = usePathname();

  return (
    <nav style={{ background: "var(--nav)", borderBottom: "1px solid var(--border)" }}
      className="sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-1">
        <Link href="/" className="flex items-center gap-2 mr-6 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #3d7cf5, #5c6bc0)" }}>
            <BarChart2 size={16} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold" style={{ color: "var(--fg)" }}>Brasileirão</div>
            <div className="text-xs" style={{ color: "var(--accent)" }}>Data Lake</div>
          </div>
        </Link>

        <div className="flex items-center gap-0.5 overflow-x-auto">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                  active ? "text-white" : "hover:text-white"
                )}
                style={{
                  color:      active ? "white" : "var(--muted)",
                  background: active ? "rgba(61,124,245,0.2)" : "transparent",
                }}>
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto shrink-0">
          <span className="text-xs px-2 py-1 rounded"
            style={{ background: "rgba(0,210,91,0.1)", color: "var(--green)" }}>
            2026 ao vivo
          </span>
        </div>
      </div>
    </nav>
  );
}
