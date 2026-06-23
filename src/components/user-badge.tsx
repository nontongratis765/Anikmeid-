import { BadgeCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type BadgeRole = "owner" | "admin" | "member";

export function isPremiumActive(premium_until?: string | null) {
  if (!premium_until) return false;
  return new Date(premium_until).getTime() > Date.now();
}

/** Colors (swapped per request):
 *  Owner / Admin = shiny PURPLE (name + check)
 *  Premium       = shiny GOLD   (name + check)
 *  Member        = NO check, plain text
 */
export function VerifiedTick({ role, premium, className = "" }: { role?: BadgeRole; premium?: boolean; className?: string }) {
  if (role === "owner" || role === "admin") {
    return <BadgeCheck className={`inline-block h-3.5 w-3.5 shiny-purple-icon ${className}`} />;
  }
  if (premium) {
    return <BadgeCheck className={`inline-block h-3.5 w-3.5 shiny-gold-icon ${className}`} />;
  }
  return null;
}

export function UserName({
  name, tag, userNumber, role, premium, link = true,
}: {
  name: string; tag?: string | null; userNumber?: number;
  role?: BadgeRole; premium?: boolean; link?: boolean;
}) {
  const nameClass =
    role === "owner" || role === "admin" ? "shiny-purple"
    : premium ? "shiny-gold" : "text-foreground";
  const body = (
    <span className="inline-flex items-center gap-1 text-sm font-bold">
      <span className={nameClass}>{name}</span>
      {tag ? <span className="text-brand">[{tag}]</span> : null}
      <VerifiedTick role={role} premium={premium} />
      {userNumber !== undefined && <span className="text-xs font-normal text-muted-foreground">#{userNumber}</span>}
    </span>
  );
  if (link && userNumber !== undefined) {
    return <Link to="/profile/$num" params={{ num: String(userNumber) }}>{body}</Link>;
  }
  return body;
}

export function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  if (url) {
    return <img src={url} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="flex items-center justify-center rounded-full bg-accent text-foreground font-bold"
         style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {initial}
    </div>
  );
}
