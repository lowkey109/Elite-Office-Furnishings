import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  Users, TrendingUp, FileText, BarChart3, MessageSquare,
  ChevronRight, Calendar, MapPin, Phone, Mail, Clock,
  Megaphone, ShieldCheck, Eye, ExternalLink, Target, Package, Upload, Star,
  AlertTriangle, CheckCircle2, XCircle, Zap,
} from "lucide-react";
import { validateAdminLogin } from "@/lib/adminAuth";

interface Lead {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  type: string;
  message?: string;
  createdAt?: string;
}

const TYPE_LABELS: Record<string, string> = {
  "layout-plan": "Layout Plan",
  "quote-request": "Quote Request",
  "strategy-call": "Strategy Call",
  "quote-builder": "Quote Builder",
  "contact": "Contact",
  "general": "General",
};

const TYPE_COLORS: Record<string, string> = {
  "layout-plan": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "quote-request": "bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)]",
  "strategy-call": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "quote-builder": "bg-green-500/10 text-green-400 border-green-500/20",
  "contact": "bg-white/10 text-white/60 border-white/10",
  "general": "bg-white/10 text-white/60 border-white/10",
};

function isToday(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isThisWeek(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return d >= weekAgo && d <= now;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [expandedLead, setExpandedLead] = useState<number | null>(null);

  useEffect(() => {
    document.title = "Admin Dashboard | The Corporate Desk";
    if (sessionStorage.getItem("tcd_admin_auth") === "true") setAuthed(true);
  }, []);

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    enabled: authed,
  });

  const { data: health } = useQuery<{ email: boolean; stripe: boolean; status: string }>({
    queryKey: ["/api/health"],
    enabled: authed,
    refetchInterval: 60000,
  });

  function handleLogin() {
    if (validateAdminLogin(email, pw)) {
      sessionStorage.setItem("tcd_admin_auth", "true");
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  }

  const totalLeads = leads.length;
  const todayLeads = leads.filter(l => isToday(l.createdAt)).length;
  const weekLeads = leads.filter(l => isThisWeek(l.createdAt)).length;
  const quoteLeads = leads.filter(l => l.type === "quote-request" || l.type === "quote-builder").length;
  const layoutLeads = leads.filter(l => l.type === "layout-plan").length;
  const strategyLeads = leads.filter(l => l.type === "strategy-call").length;

  const leadsByType = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.type] = (acc[l.type] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,6%)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center mb-4">
              <span className="text-2xl font-serif font-bold text-white">THE CORPORATE</span>
              <span className="text-sm font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase -mt-0.5">DESK</span>
            </div>
            <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
            <p className="text-white/40 text-sm mt-1">Authorised access only</p>
          </div>
          <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-6">
            <label className="block text-sm text-white/60 mb-2">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="admin@thecorporatedesk.com.au"
              data-testid="input-admin-email"
              className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(201,168,76,0.2)] focus:border-[rgba(201,168,76,0.5)] rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none text-base mb-4"
              style={{ minHeight: "48px" }}
            />
            <label className="block text-sm text-white/60 mb-2">Password</label>
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter password"
              data-testid="input-admin-password"
              className={`w-full bg-[rgba(255,255,255,0.04)] border rounded-md px-4 py-3 text-white placeholder:text-white/30 focus:outline-none text-base mb-1 ${
                pwError ? "border-red-500/50" : "border-[rgba(201,168,76,0.2)] focus:border-[rgba(201,168,76,0.5)]"
              }`}
              style={{ minHeight: "48px" }}
            />
            {pwError && <p className="text-red-400 text-xs mb-3">Incorrect credentials. Please try again.</p>}
            <Button
              onClick={handleLogin}
              className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px] mt-3"
              data-testid="button-admin-login"
            >
              <ShieldCheck className="w-4 h-4 mr-2" /> Access Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)]">
      <header className="bg-[hsl(220,18%,8%)] border-b border-[rgba(201,168,76,0.1)] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <div className="flex flex-col cursor-pointer" data-testid="link-admin-logo">
                <span className="text-base font-serif font-bold text-white leading-tight">THE CORPORATE</span>
                <span className="text-xs font-serif tracking-[0.3em] text-[hsl(43,78%,65%)] uppercase -mt-0.5">DESK</span>
              </div>
            </Link>
            <div className="h-6 w-px bg-[rgba(255,255,255,0.1)]" />
            <span className="text-white/50 text-sm font-medium">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              asChild
              size="sm"
              className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[40px]"
              data-testid="button-command-centre"
            >
              <Link href="/admin/command-centre"><Zap className="w-4 h-4 mr-1.5" /> Command Centre</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[40px]"
              data-testid="button-admin-leads"
            >
              <Link href="/admin/leads"><Target className="w-4 h-4 mr-1.5" /> Lead Intelligence</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[40px]"
              data-testid="button-admin-marketing"
            >
              <Link href="/admin/marketing"><Megaphone className="w-4 h-4 mr-1.5" /> Marketing Hub</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="text-white/50 hover:text-white min-h-[40px]"
              data-testid="button-admin-view-site"
            >
              <a href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1.5" /> View Site
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-white mb-1">Business Overview</h1>
          <p className="text-white/40 text-sm">Lead tracking and business metrics for The Corporate Desk</p>
        </div>

        {health && (!health.email || !health.stripe) && (
          <div className="mb-6 bg-[rgba(251,146,60,0.06)] border border-[rgba(251,146,60,0.2)] rounded-2xl overflow-hidden" data-testid="panel-system-health">
            <div className="px-5 py-3 border-b border-[rgba(251,146,60,0.12)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-orange-400 text-sm font-semibold">System Configuration Alerts</span>
              <span className="ml-auto text-orange-400/50 text-xs">These are causing live conversion failures</span>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!health.stripe && (
                <div className="flex items-start gap-3 bg-[rgba(255,255,255,0.03)] rounded-xl p-4 border border-[rgba(251,146,60,0.15)]">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold text-sm">Stripe not configured</p>
                    <p className="text-white/50 text-xs mt-0.5 leading-relaxed">The $399 unlock button is broken. Users who click it see an error. Add <code className="bg-[rgba(255,255,255,0.08)] px-1 rounded text-orange-300">STRIPE_SECRET_KEY</code> in Secrets to fix.</p>
                  </div>
                </div>
              )}
              {!health.email && (
                <div className="flex items-start gap-3 bg-[rgba(255,255,255,0.03)] rounded-xl p-4 border border-[rgba(251,146,60,0.15)]">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold text-sm">SMTP email not configured</p>
                    <p className="text-white/50 text-xs mt-0.5 leading-relaxed">All lead and planner notifications are silently failing. Add <code className="bg-[rgba(255,255,255,0.08)] px-1 rounded text-orange-300">SMTP_HOST</code>, <code className="bg-[rgba(255,255,255,0.08)] px-1 rounded text-orange-300">SMTP_USER</code>, <code className="bg-[rgba(255,255,255,0.08)] px-1 rounded text-orange-300">SMTP_PASS</code> in Secrets.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 pb-3">
              <p className="text-orange-400/50 text-xs">Fix these in the Replit Secrets panel (the padlock icon in the sidebar). These are revenue-critical.</p>
            </div>
          </div>
        )}

        {health && health.email && health.stripe && (
          <div className="mb-6 flex items-center gap-2 bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.15)] rounded-xl px-4 py-3" data-testid="panel-system-healthy">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-green-400 text-sm font-medium">All systems operational</span>
            <span className="text-white/30 text-xs ml-auto">Email · Stripe · AI</span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Leads", value: isLoading ? "—" : totalLeads, icon: Users, color: "text-[hsl(43,78%,65%)]", testId: "stat-total-leads" },
            { label: "Leads Today", value: isLoading ? "—" : todayLeads, icon: Calendar, color: "text-green-400", testId: "stat-today-leads" },
            { label: "This Week", value: isLoading ? "—" : weekLeads, icon: TrendingUp, color: "text-blue-400", testId: "stat-week-leads" },
            { label: "Quote Requests", value: isLoading ? "—" : quoteLeads, icon: FileText, color: "text-purple-400", testId: "stat-quote-leads" },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/50 text-sm">{kpi.label}</p>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <p className={`text-3xl font-serif font-bold ${kpi.color}`} data-testid={kpi.testId}>{kpi.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Recent Leads
              </h2>
              <span className="text-white/30 text-sm">{totalLeads} total</span>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 bg-[rgba(255,255,255,0.03)] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No leads yet.</p>
                <p className="text-white/25 text-xs mt-1">They'll appear here when visitors submit forms.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...leads].reverse().slice(0, 15).map(lead => (
                  <div key={lead.id} data-testid={`row-lead-${lead.id}`}>
                    <button
                      onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                      className="w-full text-left p-4 rounded-xl border border-[rgba(255,255,255,0.04)] hover:border-[rgba(201,168,76,0.15)] transition-all bg-[rgba(255,255,255,0.02)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[rgba(201,168,76,0.1)] flex items-center justify-center flex-shrink-0 text-[hsl(43,78%,52%)] text-sm font-bold">
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{lead.name}</p>
                            <p className="text-white/40 text-xs truncate">{lead.company || lead.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={`text-xs border ${TYPE_COLORS[lead.type] || TYPE_COLORS["general"]}`}>
                            {TYPE_LABELS[lead.type] || lead.type}
                          </Badge>
                          <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${expandedLead === lead.id ? "rotate-90" : ""}`} />
                        </div>
                      </div>
                    </button>
                    {expandedLead === lead.id && (
                      <div className="mx-1 mb-2 p-4 bg-[rgba(201,168,76,0.04)] border border-[rgba(201,168,76,0.1)] rounded-b-xl border-t-0 text-sm space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2 text-white/60">
                            <Mail className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                            <a href={`mailto:${lead.email}`} className="hover:text-white transition-colors truncate">{lead.email}</a>
                          </div>
                          {lead.phone && (
                            <div className="flex items-center gap-2 text-white/60">
                              <Phone className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                              <a href={`tel:${lead.phone}`} className="hover:text-white transition-colors">{lead.phone}</a>
                            </div>
                          )}
                          {lead.company && (
                            <div className="flex items-center gap-2 text-white/60">
                              <MapPin className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                              <span>{lead.company}</span>
                            </div>
                          )}
                          {lead.createdAt && (
                            <div className="flex items-center gap-2 text-white/60">
                              <Clock className="w-3.5 h-3.5 text-[hsl(43,78%,52%)]" />
                              <span>{formatDate(lead.createdAt)}</span>
                            </div>
                          )}
                        </div>
                        {lead.message && (
                          <div className="pt-2 border-t border-[rgba(255,255,255,0.05)]">
                            <p className="text-white/40 text-xs mb-1">Message</p>
                            <p className="text-white/60 whitespace-pre-wrap text-xs leading-relaxed">{lead.message}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Leads by Type
              </h2>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-[rgba(255,255,255,0.03)] rounded animate-pulse" />)}
                </div>
              ) : leadsByType.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {leadsByType.map(([type, count]) => (
                    <div key={type} data-testid={`stat-type-${type}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/60 text-sm">{TYPE_LABELS[type] || type}</span>
                        <span className="text-white font-semibold text-sm">{count}</span>
                      </div>
                      <div className="h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[hsl(43,78%,52%)] rounded-full transition-all"
                          style={{ width: `${Math.round((count / totalLeads) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-[hsl(43,78%,52%)]" /> Quick Actions
              </h2>
              <div className="space-y-2">
                {[
                  { label: "Planning Requests", href: "/admin/planning-requests", icon: Upload, desc: "Floor plan & space planning" },
                  { label: "Lead Intelligence", href: "/admin/leads", icon: Target, desc: "AI prospecting engine" },
                  { label: "Supplier Quotes", href: "/admin/supplier-quotes", icon: Package, desc: "Quotes & referral tracking" },
                  { label: "Product Reviews", href: "/admin/product-reviews", icon: Star, desc: "Moderate client reviews" },
                  { label: "Marketing Hub", href: "/admin/marketing", icon: Megaphone, desc: "Generate & post content" },
                  { label: "View Full Site", href: "/", icon: Eye, desc: "See your website" },
                  { label: "Quote Builder", href: "/quote-builder", icon: FileText, desc: "Interactive quote tool" },
                ].map(action => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.href} href={action.href}>
                      <div
                        data-testid={`button-quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-[rgba(255,255,255,0.05)] hover:border-[rgba(201,168,76,0.2)] transition-all cursor-pointer min-h-[56px]"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[rgba(201,168,76,0.08)] flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{action.label}</p>
                          <p className="text-white/40 text-xs">{action.desc}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-2xl p-5">
              <h3 className="text-[hsl(43,78%,65%)] font-semibold text-sm mb-3">Pipeline Overview</h3>
              <div className="space-y-2 text-sm text-white/60">
                <div className="flex justify-between">
                  <span>Quote Requests</span>
                  <span className="text-white font-medium">{quoteLeads}</span>
                </div>
                <div className="flex justify-between">
                  <span>Layout Plans</span>
                  <span className="text-white font-medium">{layoutLeads}</span>
                </div>
                <div className="flex justify-between">
                  <span>Strategy Calls</span>
                  <span className="text-white font-medium">{strategyLeads}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
