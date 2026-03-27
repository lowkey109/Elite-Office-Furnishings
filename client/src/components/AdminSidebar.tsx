import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Bot, Zap, Target, TrendingUp, Users, Crosshair, FileText,
  Radar, Search, Brain, BarChart3, Map, Eye, Bell, Navigation, Lightbulb,
  MessageSquare, RefreshCw, Send, Package, ShoppingBag, Star, Layout,
  PenTool, GraduationCap, Truck, Network, Receipt, DollarSign, Building2,
  Megaphone, Handshake, UsersRound, ClipboardList, LogOut, ChevronLeft,
  ChevronRight, X,
} from "lucide-react";
import { serverLogout } from "@/lib/adminAuth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard",    href: "/admin/dashboard",   icon: LayoutDashboard },
      { label: "Alex AI",      href: "/admin/alex",        icon: Bot },
      { label: "AI Autopilot", href: "/admin/nexora",      icon: Zap },
      { label: "AI Chat",      href: "/admin/ai-chat",     icon: MessageSquare },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Command Centre", href: "/admin/command-centre", icon: Target },
      { label: "Deal Pipeline",  href: "/admin/deal-pipeline",  icon: TrendingUp },
      { label: "Leads",          href: "/admin/leads",          icon: Users },
      { label: "Lead Engine",    href: "/admin/lead-engine",    icon: Crosshair },
      { label: "Quotes",         href: "/admin/quotes",         icon: FileText },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Move Radar",         href: "/admin/office-move-radar",        icon: Radar },
      { label: "Deal Hunter",        href: "/admin/deal-hunter",              icon: Search },
      { label: "Intelligence Hub",   href: "/admin/intelligence-hub",         icon: Brain },
      { label: "Market Intel",       href: "/admin/market-intelligence",      icon: BarChart3 },
      { label: "Territory Scanner",  href: "/admin/territory-scanner",        icon: Map },
      { label: "Company Visitors",   href: "/admin/company-visitors",         icon: Eye },
      { label: "Lease Signals",      href: "/admin/lease-signals",            icon: Bell },
      { label: "Relocation Intel",   href: "/admin/relocation-intelligence",  icon: Navigation },
      { label: "Deal Intelligence",  href: "/admin/deal-intelligence",        icon: Lightbulb },
    ],
  },
  {
    label: "Outreach",
    items: [
      { label: "Manufacturer Msgs",   href: "/admin/manufacturer-messaging",  icon: MessageSquare },
      { label: "Follow-Up Sequences", href: "/admin/follow-up-sequences",     icon: RefreshCw },
      { label: "Proposal Engine",     href: "/admin/proposal-engine",         icon: Send },
    ],
  },
  {
    label: "Products",
    items: [
      { label: "Catalogue Staging", href: "/admin/catalog-staging",   icon: Package },
      { label: "Products",          href: "/admin/products",           icon: ShoppingBag },
      { label: "Product Reviews",   href: "/admin/product-reviews",   icon: Star },
    ],
  },
  {
    label: "Workspace & Supply",
    items: [
      { label: "Layout Advisor",        href: "/admin/workspace-strategy",       icon: Layout },
      { label: "Design Engine",         href: "/admin/workspace-design-engine",  icon: PenTool },
      { label: "Workspace Learning",    href: "/admin/workspace-learning",       icon: GraduationCap },
      { label: "Supplier Hub",          href: "/admin/procurement-engine",       icon: Truck },
      { label: "Supplier Intelligence", href: "/admin/supplier-intelligence",    icon: Network },
      { label: "Supplier Quotes",       href: "/admin/supplier-quotes",          icon: Receipt },
      { label: "Profit Engine",         href: "/admin/profit-engine",            icon: DollarSign },
      { label: "Building Database",     href: "/admin/building-database",        icon: Building2 },
    ],
  },
  {
    label: "Marketing & Partners",
    items: [
      { label: "Marketing Hub",   href: "/admin/marketing",        icon: Megaphone },
      { label: "Partner Network", href: "/admin/partner-network",  icon: Handshake },
      { label: "Partners",        href: "/admin/partners",         icon: UsersRound },
    ],
  },
  {
    label: "Requests",
    items: [
      { label: "Planning Requests", href: "/admin/planning-requests", icon: ClipboardList },
    ],
  },
];

const GOLD = "hsl(43,78%,52%)";

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminSidebar({ mobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("tcd_sidebar_collapsed") === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("tcd_sidebar_collapsed", String(collapsed)); } catch {}
  }, [collapsed]);

  const handleLogout = async () => {
    await serverLogout();
    window.location.href = "/admin";
  };

  const isActive = (href: string) =>
    location === href || (href !== "/admin/dashboard" && location.startsWith(href));

  const handleNavClick = () => {
    if (onMobileClose) onMobileClose();
  };

  const sidebarContent = (isMobile: boolean) => (
    <aside
      data-testid="admin-sidebar"
      className="flex flex-col h-full overflow-hidden"
      style={{
        width: isMobile ? 260 : (collapsed ? 56 : 220),
        background: "#0a0a0a",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        transition: "width 0.2s ease",
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center shrink-0 px-3"
        style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {(!collapsed || isMobile) && (
          <div className="flex-1 overflow-hidden mr-2">
            <div className="text-white font-light text-xs tracking-widest uppercase truncate">
              The Corporate
            </div>
            <div className="text-xs tracking-widest uppercase" style={{ color: GOLD, marginTop: -1 }}>
              Desk
            </div>
          </div>
        )}
        {isMobile ? (
          <button
            data-testid="button-sidebar-close"
            onClick={onMobileClose}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{ width: 32, height: 32, color: "rgba(255,255,255,0.35)" }}
            title="Close menu"
          >
            <X size={16} />
          </button>
        ) : (
          <button
            data-testid="button-sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{ width: 32, height: 32, color: "rgba(255,255,255,0.35)" }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3" style={{ scrollbarWidth: "none" }}>
        {NAV.map(section => (
          <div key={section.label} className="mb-1">
            {(!collapsed || isMobile) && (
              <div
                className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest select-none"
                style={{ color: "rgba(255,255,255,0.2)", fontSize: 9 }}
              >
                {section.label}
              </div>
            )}
            {(collapsed && !isMobile) && (
              <div
                className="my-1 mx-3"
                style={{ height: 1, background: "rgba(255,255,255,0.05)" }}
              />
            )}
            {section.items.map(item => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`nav-${item.href.replace("/admin/", "")}`}
                  onClick={handleNavClick}
                  className="flex items-center gap-3 mx-2 my-0.5 rounded-md transition-all select-none"
                  style={{
                    height: 34,
                    paddingLeft: (collapsed && !isMobile) ? 9 : 10,
                    paddingRight: (collapsed && !isMobile) ? 9 : 10,
                    background: active ? "rgba(201,168,76,0.12)" : "transparent",
                    color: active ? GOLD : "rgba(255,255,255,0.5)",
                    fontWeight: active ? 500 : 400,
                    fontSize: 13,
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    if (!active) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      e.currentTarget.style.color = "rgba(255,255,255,0.8)";
                    }
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                    }
                  }}
                  title={(collapsed && !isMobile) ? item.label : undefined}
                >
                  <Icon size={15} style={{ flexShrink: 0 }} />
                  {(!collapsed || isMobile) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer — logout */}
      <div
        className="shrink-0 px-2 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          data-testid="button-admin-logout"
          onClick={handleLogout}
          className="flex items-center gap-3 w-full rounded-md transition-all"
          style={{
            height: 34,
            paddingLeft: (collapsed && !isMobile) ? 9 : 10,
            paddingRight: (collapsed && !isMobile) ? 9 : 10,
            color: "rgba(255,255,255,0.3)",
            fontSize: 13,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(255,80,80,0.08)";
            e.currentTarget.style.color = "rgba(255,100,100,0.8)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgba(255,255,255,0.3)";
          }}
          title="Sign out"
        >
          <LogOut size={15} style={{ flexShrink: 0 }} />
          {(!collapsed || isMobile) && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block h-screen sticky top-0 shrink-0">
        {sidebarContent(false)}
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={onMobileClose}
          />
          <div className="relative z-10 h-full overflow-hidden" style={{ width: 260 }}>
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
