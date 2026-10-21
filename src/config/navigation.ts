import {
  ChartLine,
  LayoutDashboard,
  type LucideIcon,
  ScrollText,
  Settings,
  Waypoints,
} from "lucide-react";

export interface NavItem {
  href: string;
  /** Texts in `messages.nav[key]`: label, and a short one for the bottom bar and rail. */
  key: "dashboard" | "metrics" | "logs" | "config" | "settings";
  icon: LucideIcon;
  /**
   * `primary` items appear everywhere, including the mobile bottom bar.
   * `secondary` items sit at the bottom of the sidebar and, on phones, in the account menu.
   */
  placement: "primary" | "secondary";
}

export const navItems: readonly NavItem[] = [
  {
    href: "/dashboard",
    key: "dashboard",
    icon: LayoutDashboard,
    placement: "primary",
  },
  {
    href: "/metrics",
    key: "metrics",
    icon: ChartLine,
    placement: "primary",
  },
  {
    href: "/logs",
    key: "logs",
    icon: ScrollText,
    placement: "primary",
  },
  {
    href: "/config",
    key: "config",
    icon: Waypoints,
    placement: "primary",
  },
  {
    href: "/settings",
    key: "settings",
    icon: Settings,
    placement: "secondary",
  },
];

export const primaryNavItems = navItems.filter(
  (item) => item.placement === "primary",
);
export const secondaryNavItems = navItems.filter(
  (item) => item.placement === "secondary",
);

export function isNavItemActive(
  item: Pick<NavItem, "href">,
  pathname: string,
): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function findActiveNavItem(pathname: string): NavItem | undefined {
  return navItems.find((item) => isNavItemActive(item, pathname));
}
