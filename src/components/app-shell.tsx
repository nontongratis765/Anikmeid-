import { Link, useLocation } from "@tanstack/react-router";
import { Home, Calendar, Tv, History, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/jadwal", label: "Jadwal", icon: Calendar },
  { to: "/anime", label: "Anime", icon: Tv },
  { to: "/history", label: "History", icon: History },
  { to: "/trending", label: "Trending", icon: TrendingUp },
] as const;

export function AppShell({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen pb-24">
      {children}
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
            {nav.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} className="flex flex-col items-center gap-0.5 px-3 py-1.5">
                  <div className={`flex h-8 w-14 items-center justify-center rounded-full transition ${active ? "bg-primary/30" : ""}`}>
                    <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <span className={`text-[10px] ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
