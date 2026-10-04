"use client";

import { usePathname } from "next/navigation";
import { BASE_PATH } from "@/lib/site";
import { cn } from "@/lib/utils";

/** A navbar link that takes the primary color on its own page. */
export function NavLink({ href, children }: { href: string; children: string }) {
  const pathname = usePathname().replace(/\/$/, "");
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <a
      href={`${BASE_PATH}${href}`}
      aria-current={active ? "page" : undefined}
      className={cn("transition-colors", active ? "text-primary" : "text-gray-600 hover:text-gray-900")}
    >
      {children}
    </a>
  );
}
