import { useLocation, Link } from "wouter";
import { AdminSidebar } from "./AdminSidebar";
import { ChevronRight } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "dashboard":              "Dashboard",
  "alex":                   "Alex AI",
  "nexora":                 "AI Autopilot",
  "command-centre":         "Command Centre",
  "deal-pipeline":          "Deal Pipeline",
  "leads":                  "Leads",
  "lead-intelligence":      "Leads",
  "lead-engine":            "Lead Engine",
  "quotes":                 "Quotes",
  "office-move-radar":      "Move Radar",
  "deal-hunter":            "Deal Hunter",
  "intelligence-hub":       "Intelligence Hub",
  "market-intelligence":    "Market Intelligence",
  "territory-scanner":      "Territory Scanner",
  "company-visitors":       "Company Visitors",
  "lease-signals":          "Lease Signals",
  "relocation-intelligence":"Relocation Intel",
  "deal-intelligence":      "Deal Intelligence",
  "manufacturer-messaging": "Manufacturer Messaging",
  "follow-up-sequences":    "Follow-Up Sequences",
  "proposal-engine":        "Proposal Engine",
  "catalog-staging":        "Catalogue Staging",
  "products":               "Products",
  "product-reviews":        "Product Reviews",
  "workspace-strategy":     "Layout Advisor",
  "workspace-design-engine":"Design Engine",
  "workspace-learning":     "Workspace Learning",
  "procurement-engine":     "Supplier Hub",
  "supplier-intelligence":  "Supplier Intelligence",
  "supplier-quotes":        "Supplier Quotes",
  "profit-engine":          "Profit Engine",
  "building-database":      "Building Database",
  "marketing":              "Marketing Hub",
  "partner-network":        "Partner Network",
  "partners":               "Partners",
  "planning-requests":      "Planning Requests",
};

function Breadcrumb() {
  const [location] = useLocation();
  const segments = location.replace("/admin", "").split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs: { label: string; href: string }[] = [
    { label: "Admin", href: "/admin/dashboard" },
  ];

  let built = "/admin";
  for (const seg of segments) {
    built += `/${seg}`;
    const label = ROUTE_LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    crumbs.push({ label, href: built });
  }

  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 px-6 py-3 text-xs select-none"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      data-testid="admin-breadcrumb"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight size={11} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
            )}
            {isLast ? (
              <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href}>
                <a
                  className="transition-colors"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)")}
                >
                  {crumb.label}
                </a>
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const isPrintView = location.endsWith("/print");

  if (isPrintView) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0f0f0f" }}>
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Breadcrumb />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
