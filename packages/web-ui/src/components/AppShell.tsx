"use client";

import { useState, type ReactNode } from "react";
import { cn } from "../tokens.js";
import { BrandMark } from "./BrandMark.js";
import { Button } from "./Button.js";
import { BellIcon, ChevronRightIcon, CloseIcon, LogOutIcon, MenuBarsIcon } from "./Icons.js";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string | number | undefined;
}

export interface BreadcrumbItem {
  label: string;
  href?: string | undefined;
}

export function Breadcrumbs({
  items,
  renderLink,
}: {
  items: BreadcrumbItem[];
  renderLink?: ((href: string, label: string) => ReactNode) | undefined;
}) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-[#64786E]">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
            {idx > 0 && <ChevronRightIcon size={12} />}
            {item.href && !isLast ? (
              renderLink ? (
                renderLink(item.href, item.label)
              ) : (
                <a href={item.href} className="font-medium hover:text-[#235347]">
                  {item.label}
                </a>
              )
            ) : (
              <span className={cn(isLast && "font-semibold text-[#0D2621]")}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export interface PageHeaderProps {
  title: string;
  description?: string | undefined;
  breadcrumbs?: BreadcrumbItem[] | undefined;
  actions?: ReactNode | undefined;
  renderBreadcrumbLink?: ((href: string, label: string) => ReactNode) | undefined;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  renderBreadcrumbLink,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} renderLink={renderBreadcrumbLink} />}
        <h1 className="text-2xl font-bold tracking-tight text-[#0D2621]">{title}</h1>
        {description && <p className="mt-1 text-sm text-[#52665F]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export interface AppShellProps {
  portalLabel: string;
  navItems: NavItem[];
  activePath: string;
  renderNavLink: (item: NavItem, isActive: boolean, onNavigate?: () => void) => ReactNode;
  userDisplayName: string;
  userEmail: string;
  userRoleLabel: string;
  onLogout: () => void | Promise<void>;
  unreadNotificationsCount?: number | undefined;
  onNotificationsClick?: (() => void) | undefined;
  headerSlot?: ReactNode | undefined;
  children: ReactNode;
}

export function AppShell({
  portalLabel,
  navItems,
  activePath,
  renderNavLink,
  userDisplayName,
  userEmail,
  userRoleLabel,
  onLogout,
  unreadNotificationsCount = 0,
  onNotificationsClick,
  headerSlot,
  children,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const sidebarBody = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-[#0D2621] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <BrandMark portalLabel={portalLabel} inverted />
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden cursor-pointer"
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? activePath === "/"
              : activePath === item.href || activePath.startsWith(`${item.href}/`);
          return <div key={item.href}>{renderNavLink(item, isActive, onNavigate)}</div>;
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 rounded-xl bg-white/5 px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-white">{userDisplayName}</p>
          <p className="truncate text-xs text-white/65">{userEmail}</p>
          <span className="mt-1.5 inline-block rounded-full bg-[#D4AF37]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
            {userRoleLabel}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-white/80 hover:bg-white/10 hover:text-white"
          leftIcon={<LogOutIcon size={16} />}
          onClick={() => void onLogout()}
        >
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F5F7F6] text-[#0D2621]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:sticky lg:top-0 lg:block lg:h-screen">
        {sidebarBody()}
      </aside>

      {/* Mobile / Tablet Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#0D2621]/50 backdrop-blur-[1px]"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw]">{sidebarBody(() => setMobileNavOpen(false))}</aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#E2EBE6] bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-xl border border-[#E2EBE6] p-2 text-[#0D2621] hover:bg-[#F5F7F6] lg:hidden cursor-pointer"
            >
              <MenuBarsIcon size={18} />
            </button>
            {headerSlot}
          </div>

          <div className="flex items-center gap-3">
            {onNotificationsClick && (
              <button
                type="button"
                onClick={onNotificationsClick}
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2EBE6] bg-white text-[#0D2621] hover:bg-[#F5F7F6] cursor-pointer"
              >
                <BellIcon size={17} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold text-white">
                    {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
