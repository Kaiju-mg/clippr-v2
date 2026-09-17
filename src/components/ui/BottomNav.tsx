"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Wallet,
  Calendar,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/caja", label: "Caja", icon: Wallet },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/mas", label: "Más", icon: MoreHorizontal },
];

/**
 * Barra de navegación inferior fija (spec 05.5), mobile-first. El ítem
 * activo se distingue por color (acento "Tinta") y por el grosor del
 * trazo del ícono, no solo por color: pensado para uso a la luz del día,
 * donde una diferencia sutil de color puede no notarse.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="border-line bg-background fixed inset-x-0 bottom-0 border-t">
      <ul className="flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  isActive ? "text-accent" : "text-muted"
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.25 : 1.5} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
