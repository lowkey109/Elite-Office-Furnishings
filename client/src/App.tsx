import React, { Suspense, lazy } from "react";
import { Route, Switch } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";

import { usePageTracking } from "@/lib/usePageTracking";
import { Redirect } from "wouter";
import { AdminLayout } from "@/components/AdminLayout";
import AdminBinancePaper from "./pages/AdminBinancePaper";
import AdminBinanceLive from "@/pages/AdminBinanceLive";

// TCD_STAGE_25_ROUTE_LEVEL_LAZY_LOADING
// TCD_STAGE_30_LAZY_GLOBAL_SHELL
const Toaster = lazy(() =>
  import("@/components/ui/toaster").then((m) => ({ default: m.Toaster }))
);
const TooltipProvider = lazy(() =>
  import("@/components/ui/tooltip").then((m) => ({ default: m.TooltipProvider }))
);
const ConciergeProvider = lazy(() =>
  import("@/contexts/ConciergeContext").then((m) => ({ default: m.ConciergeProvider }))
);
const AdminAuthGate = lazy(() =>
  import("@/components/AdminAuthGate").then((m) => ({ default: m.AdminAuthGate }))
);
const ErrorBoundary = lazy(() =>
  import("@/components/ErrorBoundary").then((m) => ({ default: m.ErrorBoundary }))
);

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/Home"));
const UploadYourQuote = lazy(() => import("@/pages/UploadYourQuote"));
const AdminCompetitorQuotes = lazy(() => import("@/pages/AdminCompetitorQuotes"));
const About = lazy(() => import("@/pages/About"));
const Products = lazy(() => import("@/pages/Products"));
const WorkplaceSolutions = lazy(() => import("@/pages/WorkplaceSolutions"));
const FreeLayoutPlan = lazy(() => import("@/pages/FreeLayoutPlan"));
const SendQuote = lazy(() => import("@/pages/SendQuote"));
const WorkplaceStrategy = lazy(() => import("@/pages/WorkplaceStrategy"));
const TradeProcurement = lazy(() => import("@/pages/TradeProcurement"));
const Contact = lazy(() => import("@/pages/Contact"));
const Marketing = lazy(() => import("@/pages/Marketing"));
const QuoteBuilder = lazy(() => import("@/pages/QuoteBuilder"));
const FinanceWorkspace = lazy(() => import("@/pages/FinanceWorkspace"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const PaymentSuccess = lazy(() => import("@/pages/PaymentSuccess"));
const PaymentCancelled = lazy(() => import("@/pages/PaymentCancelled"));
const CaseStudies = lazy(() => import("@/pages/CaseStudies"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminLeads = lazy(() => import("@/pages/AdminLeads"));
const AdminSupplierQuotes = lazy(() => import("@/pages/AdminSupplierQuotes"));
const AdminPlanningRequests = lazy(() => import("@/pages/AdminPlanningRequests"));
const UploadFloorPlan = lazy(() => import("@/pages/UploadFloorPlan"));
const OfficeWalkthrough = lazy(() => import("@/pages/OfficeWalkthrough"));
const Testimonials = lazy(() => import("@/pages/Testimonials"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const AdminProductReviews = lazy(() => import("@/pages/AdminProductReviews"));
const AdminManufacturerMessaging = lazy(() => import("@/pages/AdminManufacturerMessaging"));
const AdminFollowUpSequences = lazy(() => import("@/pages/AdminFollowUpSequences"));
const AdminDealPipeline = lazy(() => import("@/pages/AdminDealPipeline"));
const AdminTerritoryScanner = lazy(() => import("@/pages/AdminTerritoryScanner"));
const AdminProcurementEngine = lazy(() => import("@/pages/AdminProcurementEngine"));
const AdminSupplierIntelligence = lazy(() => import("@/pages/AdminSupplierIntelligence"));
const AdminWorkspaceLearning = lazy(() => import("@/pages/AdminWorkspaceLearning"));
const AdminQuotes = lazy(() => import("@/pages/AdminQuotes"));
const QuotePrint = lazy(() => import("@/pages/QuotePrint"));
const AdminOfficeMovRadar = lazy(() => import("@/pages/AdminOfficeMovRadar"));
const WorkspaceDesignEngine = lazy(() => import("@/pages/WorkspaceDesignEngine"));
const AdminPartnerNetwork = lazy(() => import("@/pages/AdminPartnerNetwork"));
const AdminDealHunter = lazy(() => import("@/pages/AdminDealHunter"));
const AdminWorkspaceStrategy = lazy(() => import("@/pages/AdminWorkspaceStrategy"));
const PartnerOnboarding = lazy(() => import("@/pages/PartnerOnboarding"));
const PartnerDashboard = lazy(() => import("@/pages/PartnerDashboard"));
const PartnerAgreement = lazy(() => import("@/pages/PartnerAgreement"));
const PartnerApply = lazy(() => import("@/pages/PartnerApply"));
const MarketMap = lazy(() => import("@/pages/MarketMap"));
const ProposalEngine = lazy(() => import("@/pages/ProposalEngine"));
const BuildingDatabase = lazy(() => import("@/pages/BuildingDatabase"));
const AdminProductCommandCentre = lazy(() => import("@/pages/AdminProductCommandCentre"));
const AdminLeadEngine = lazy(() => import("@/pages/AdminLeadEngine"));
const AdminNexoraCommandCentre = lazy(() => import("@/pages/AdminNexoraCommandCentre"));
const AdminNexoraAdvanced = lazy(() => import("@/pages/AdminNexoraAdvanced"));
const AdminNexoraMonitor = lazy(() => import("@/pages/AdminNexoraMonitor"));
const AdminTradingMonitor = lazy(() => import("@/pages/AdminTradingMonitor"));
const AdminPhantomXIntelligence = lazy(() => import("@/pages/AdminPhantomXIntelligence"));
const AdminPolyEdgeAetherforge = lazy(() => import("@/pages/AdminPolyEdgeAetherforge"));
const AdminPredictionMarkets = lazy(() => import("@/pages/AdminPredictionMarkets"));
const AdminPropertyIntelligence = lazy(() => import("@/pages/AdminPropertyIntelligence"));
const PropertyIntelligence = lazy(() => import("@/pages/PropertyIntelligence"));
const ClientPropertyIntelligence = lazy(() => import("@/pages/ClientPropertyIntelligence"));
const AdminAIChat = lazy(() => import("@/pages/AdminAIChat"));
const AdminPartners = lazy(() => import("@/pages/AdminPartners"));
const Partners = lazy(() => import("@/pages/Partners"));
const SubmitDeal = lazy(() => import("@/pages/SubmitDeal"));
const TradeCustomersPortal = lazy(() => import("@/pages/TradeCustomersPortal"));
const Start = lazy(() => import("@/pages/Start"));
const Capability = lazy(() => import("@/pages/Capability"));
const AdminCatalogStaging = lazy(() => import("@/pages/AdminCatalogStaging"));
const Catalog = lazy(() => import("@/pages/Catalog"));
const CatalogProductDetail = lazy(() => import("@/pages/CatalogProductDetail"));
const AdminDevStudio = lazy(() => import("@/pages/AdminDevStudio"));
const ClientLogin = lazy(() => import("@/pages/ClientLogin"));
const ClientSignup = lazy(() => import("@/pages/ClientSignup"));
const ClientOnboarding = lazy(() => import("@/pages/ClientOnboarding"));
const ClientDashboard = lazy(() => import("@/pages/ClientDashboard"));
const Subscriptions = lazy(() => import("@/pages/Subscriptions"));
const Terms = lazy(() => import("@/pages/legal/Terms"));
const PrivacyNotice = lazy(() => import("@/pages/legal/PrivacyNotice"));
const SubscriptionTerms = lazy(() => import("@/pages/legal/SubscriptionTerms"));
const PhantomXRiskDisclaimer = lazy(() => import("@/pages/legal/PhantomXRiskDisclaimer"));
const AdminCustomers = lazy(() => import("@/pages/AdminCustomers"));
const AdminSubscriptions = lazy(() => import("@/pages/AdminSubscriptions"));
const AdminClientProjects = lazy(() => import("@/pages/AdminClientProjects"));
const AdminPropertyListings = lazy(() => import("@/pages/AdminPropertyListings"));
const ClientPropertyListings = lazy(() => import("@/pages/ClientPropertyListings"));
const AdminPropertyListingsImport = lazy(() => import("@/pages/AdminPropertyListingsImport"));
const AdminPropertyEnquiries = lazy(() => import("@/pages/AdminPropertyEnquiries"));
const ClientPhantomXPaper = lazy(() => import("@/pages/ClientPhantomXPaper"));
const ClientPhantomXCompliance = lazy(() => import("@/pages/ClientPhantomXCompliance"));
const AdminPhantomXCompliance = lazy(() => import("@/pages/AdminPhantomXCompliance"));
const ClientPolyEdgeAetherforge = lazy(() => import("@/pages/ClientPolyEdgeAetherforge"));
const PlatformOverview = lazy(() => import("@/pages/PlatformOverview"));
const WorkspaceControlLanding = lazy(() => import("@/pages/WorkspaceControlLanding"));
const LeaseHawkLanding = lazy(() => import("@/pages/LeaseHawkLanding"));
const PhantomXLanding = lazy(() => import("@/pages/PhantomXLanding"));
const TrustCentre = lazy(() => import("@/pages/TrustCentre"));
const AdminEmailNotifications = lazy(() => import("@/pages/AdminEmailNotifications"));
const AdminDataLayer = lazy(() => import("@/pages/AdminDataLayer"));
const AdminAutonomyReadiness = lazy(() => import("@/pages/AdminAutonomyReadiness"));

// TCD_STAGE_26_FLASH_APP_SHELL
const NexoraCopilot = lazy(() =>
  import("@/components/NexoraCopilot").then((m) => ({ default: m.NexoraCopilot }))
);
const NexoraJourneyBar = lazy(() =>
  import("@/components/NexoraJourneyBar").then((m) => ({ default: m.NexoraJourneyBar }))
);
const LeadCapturePopup = lazy(() => import("@/components/LeadCapturePopup"));
const StickyCTA = lazy(() => import("@/components/StickyCTA"));
const WhatsAppButton = lazy(() =>
  import("@/components/WhatsAppButton").then((m) => ({ default: m.WhatsAppButton }))
);
const GoogleReviewsBadge = lazy(() =>
  import("@/components/GoogleReviewsBadge").then((m) => ({ default: m.GoogleReviewsBadge }))
);
const TrackingPixels = lazy(() =>
  import("@/components/TrackingPixels").then((m) => ({ default: m.TrackingPixels }))
);

const ThankYouLayoutPlan = lazy(() =>
  import("@/pages/ThankYou").then((m) => ({ default: m.ThankYouLayoutPlan }))
);
const ThankYouQuote = lazy(() =>
  import("@/pages/ThankYou").then((m) => ({ default: m.ThankYouQuote }))
);
const ThankYouStrategy = lazy(() =>
  import("@/pages/ThankYou").then((m) => ({ default: m.ThankYouStrategy }))
);

const BrisbanePage = lazy(() =>
  import("@/pages/CityLandingPage").then((m) => ({ default: m.BrisbanePage }))
);
const SydneyPage = lazy(() =>
  import("@/pages/CityLandingPage").then((m) => ({ default: m.SydneyPage }))
);
const MelbournePage = lazy(() =>
  import("@/pages/CityLandingPage").then((m) => ({ default: m.MelbournePage }))
);
const CanberraPage = lazy(() =>
  import("@/pages/CityLandingPage").then((m) => ({ default: m.CanberraPage }))
);


const tcdRouteFallback = (
  <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
    <div style={{ fontFamily: "system-ui", color: "#64748b" }}>Loading The Corporate Desk…</div>
  </div>
);

function AdminRoutes() {
  return (
    <AdminLayout>
      <Suspense fallback={<TcdStage24RouteFallback />}>
        <Route path="/admin/login" component={AdminDashboard} />
        <Suspense fallback={tcdRouteFallback}>
          <Switch>
        <Route
          path="/admin"
          component={() => {
            window.location.replace("/admin/dashboard");
            return null;
          }}
        />
        <Route path="/admin/marketing" component={Marketing} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/leads" component={AdminLeads} />
        <Route path="/admin/lead-intelligence" component={AdminLeads} />
        <Route path="/admin/supplier-quotes" component={AdminSupplierQuotes} />
        <Route path="/admin/planning-requests" component={AdminPlanningRequests} />
        <Route path="/admin/product-reviews" component={AdminProductReviews} />
        <Route path="/admin/command-centre" component={() => <Redirect to="/admin/nexora" />} />
        <Route path="/admin/manufacturer-messaging" component={AdminManufacturerMessaging} />
        <Route path="/admin/follow-up-sequences" component={AdminFollowUpSequences} />
        <Route path="/admin/lease-signals" component={() => <Redirect to="/admin/nexora" />} />
        <Route path="/admin/deal-pipeline" component={AdminDealPipeline} />
        <Route path="/admin/territory-scanner" component={AdminTerritoryScanner} />
        <Route path="/admin/procurement-engine" component={AdminProcurementEngine} />
        <Route path="/admin/supplier-intelligence" component={AdminSupplierIntelligence} />
        <Route path="/admin/workspace-learning" component={AdminWorkspaceLearning} />
        <Route path="/admin/intelligence-hub" component={() => <Redirect to="/admin/nexora" />} />
        <Route path="/admin/profit-engine" component={() => <Redirect to="/admin/nexora" />} />
        <Route path="/admin/office-move-radar" component={AdminOfficeMovRadar} />
        <Route path="/admin/deal-intelligence" component={() => <Redirect to="/admin/nexora" />} />
        <Route path="/admin/quotes/:id/print" component={QuotePrint} />
        <Route path="/admin/quotes" component={AdminQuotes} />
                <Route path="/admin/competitor-quotes" component={AdminCompetitorQuotes} />
<Route path="/admin/deal-hunter" component={AdminDealHunter} />
        <Route path="/admin/partner-network" component={AdminPartnerNetwork} />
        <Route path="/admin/relocation-intelligence" component={() => <Redirect to="/admin/nexora" />} />
        <Route path="/admin/workspace-strategy" component={AdminWorkspaceStrategy} />
        <Route path="/admin/workspace-design-engine" component={WorkspaceDesignEngine} />
        <Route path="/admin/market-intelligence" component={() => <Redirect to="/admin/nexora" />} />
        <Route path="/admin/company-visitors" component={() => <Redirect to="/admin/nexora" />} />
        <Route path="/admin/proposal-engine" component={ProposalEngine} />
        <Route path="/admin/building-database" component={BuildingDatabase} />
        <Route path="/admin/products" component={AdminProductCommandCentre} />

        <Route path="/admin/lead-engine" component={AdminLeadEngine} />
        <Route path="/admin/nexora/advanced" component={AdminNexoraAdvanced} />
        <Route path="/admin/binance-paper" component={AdminBinancePaper} />
          <Route path="/admin/binance-live"><AdminBinanceLive /></Route>
          <Route path="/admin/nexora" component={AdminNexoraCommandCentre} />
        <Route path="/admin/ai-monitor" component={AdminNexoraMonitor} />
        <Route path="/admin/trading-monitor" component={AdminTradingMonitor} />
        <Route path="/admin/phantomx-intelligence" component={AdminPhantomXIntelligence} />
        <Route path="/admin/polyedge-aetherforge" component={AdminPolyEdgeAetherforge} />
        <Route path="/admin/phantomx-compliance" component={AdminPhantomXCompliance} />
        <Route path="/admin/dev-studio" component={AdminDevStudio} />
        <Route path="/admin/prediction-markets" component={AdminPredictionMarkets} />
        <Route path="/admin/property-intelligence" component={AdminPropertyIntelligence} />
        <Route path="/admin/property-listings" component={AdminPropertyListings} />
        <Route path="/admin/property-listings/import" component={AdminPropertyListingsImport} />
        <Route path="/admin/property-enquiries" component={AdminPropertyEnquiries} />
        <Route path="/admin/customers" component={AdminCustomers} />
        <Route path="/admin/subscriptions" component={AdminSubscriptions} />
        <Route path="/admin/client-projects" component={AdminClientProjects} />
        <Route path="/admin/ai-chat" component={AdminAIChat} />
        <Route path="/admin/partners" component={AdminPartners} />
        <Route path="/admin/catalog-staging" component={AdminCatalogStaging} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </Suspense>
    </AdminLayout>
  );
}

function Router() {
  usePageTracking();
  return (
    <Switch>
      <Route path="/upload-your-quote" component={UploadYourQuote} />
      <Route path="/" component={Home} />
      {/* ── 4 Core Public Pages ─────────────────────────── */}

      <Route path="/start" component={Start} />
      <Route path="/partners" component={Partners} />
      <Route path="/capability" component={Capability} />

      {/* Premium Catalog — new system */}
      <Route path="/catalog/product/:sku" component={CatalogProductDetail} />
      <Route path="/catalog/:category" component={Catalog} />
      <Route path="/catalog" component={Catalog} />

      {/* Legacy product routes — redirect to new catalog */}
      <Route path="/products/:sku">{() => <Redirect to="/catalog" />}</Route>
      <Route path="/products">{() => <Redirect to="/catalog" />}</Route>

      {/* Embed routes for WordPress — keep as-is */}
      <Route path="/embed/quote-builder" component={QuoteBuilder} />
      <Route path="/embed/finance-your-workspace" component={FinanceWorkspace} />

      {/* Thank-you pages */}
      <Route path="/thank-you-layout-plan" component={ThankYouLayoutPlan} />
      <Route path="/thank-you-quote" component={ThankYouQuote} />
      <Route path="/thank-you-strategy" component={ThankYouStrategy} />

      {/* ── Company pages ────────────────────────────── */}
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/case-studies" component={CaseStudies} />
      <Route path="/testimonials" component={Testimonials} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/blog" component={Blog} />

      {/* ── City landing pages ─────────────────────────── */}
      <Route path="/office-furniture-brisbane" component={BrisbanePage} />
      <Route path="/office-furniture-sydney" component={SydneyPage} />
      <Route path="/office-furniture-melbourne" component={MelbournePage} />
      <Route path="/office-furniture-canberra" component={CanberraPage} />

      {/* ── Service pages ─────────────────────────────── */}
      <Route path="/workplace-solutions" component={WorkplaceSolutions} />
      <Route path="/workplace-strategy" component={WorkplaceStrategy} />
      <Route path="/strategy-call" component={WorkplaceStrategy} />
      <Route path="/free-layout-plan" component={FreeLayoutPlan} />
      <Route path="/free-office-layout-plan" component={FreeLayoutPlan} />
      <Route path="/request-a-quote" component={SendQuote} />
      <Route path="/send-us-your-quote" component={SendQuote} />
      <Route path="/upload-your-floor-plan" component={UploadFloorPlan} />
      <Route path="/ai-office-planner" component={WorkspaceDesignEngine} />
      <Route path="/ai-workspace-design" component={WorkspaceDesignEngine} />
      <Route path="/3d-office-walkthrough" component={OfficeWalkthrough} />
      <Route path="/quote-builder" component={QuoteBuilder} />
      <Route path="/finance-your-workspace" component={FinanceWorkspace} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/payment-cancelled" component={PaymentCancelled} />
      <Route path="/trade-project-procurement" component={TradeProcurement} />

      {/* ── Admin — server-session protected ──────────── */}
      <Route path="/admin/:rest*" component={AdminRoutes} />
      <Route path="/admin" component={AdminRoutes} />

      {/* ── Partner routes ─────────────────────────────── */}
      <Route path="/partner-onboarding" component={PartnerOnboarding} />
      <Route path="/partner-dashboard" component={PartnerDashboard} />
      <Route path="/partner/agreement/:token" component={PartnerAgreement} />
      <Route path="/partners/apply" component={PartnerApply} />
      <Route path="/partner/dashboard" component={PartnerDashboard} />
      <Route path="/partner/login" component={PartnerOnboarding} />

      {/* ── Other pages ────────────────────────────────── */}
      <Route path="/market-map" component={MarketMap} />
      <Route path="/property-intelligence" component={PropertyIntelligence} />
      <Route path="/subscriptions" component={Subscriptions} />
      <Route path="/platform" component={PlatformOverview} />
      <Route path="/workspace-control" component={WorkspaceControlLanding} />
      <Route path="/leasehawk" component={LeaseHawkLanding} />
      <Route path="/phantomx" component={PhantomXLanding} />
      <Route path="/trust-centre" component={TrustCentre} />
      <Route path="/legal/terms" component={Terms} />
      <Route path="/legal/privacy" component={PrivacyNotice} />
      <Route path="/legal/subscription-terms" component={SubscriptionTerms} />
      <Route path="/legal/phantomx-risk-disclaimer" component={PhantomXRiskDisclaimer} />
      <Route path="/client-login" component={ClientLogin} />
      <Route path="/client-signup" component={ClientSignup} />
      <Route path="/client-onboarding" component={ClientOnboarding} />
      <Route path="/client-dashboard" component={ClientDashboard} />
      <Route path="/client/subscription" component={Subscriptions} />
      <Route path="/client/property-intelligence" component={ClientPropertyIntelligence} />
      <Route path="/client/property-listings" component={ClientPropertyListings} />
      <Route path="/client/phantomx-paper" component={ClientPhantomXPaper} />
      <Route path="/client/polyedge-aetherforge" component={ClientPolyEdgeAetherforge} />
      <Route path="/client/phantomx-compliance" component={ClientPhantomXCompliance} />
      <Route path="/submit-deal" component={SubmitDeal} />
      <Route path="/trade-customers-portal" component={TradeCustomersPortal} />
      <Route component={NotFound} />
    </Switch>
  );
        
}

function AppRouteLoading() {
  return (
    <div className="min-h-screen grid place-items-center bg-black text-cyan-200">
      <div className="text-center">
        <div className="text-sm font-black tracking-[0.25em] uppercase">Loading</div>
        <div className="mt-2 text-xs text-cyan-300/70">The Corporate Desk</div>
      </div>
    </div>
  );
}

const TcdStage24RouteFallback = () => (
  <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
    Loading The Corporate Desk admin…
  </div>
);

// TCD_STAGE_24_FLASH_FRONTEND_LAZY_ROUTES
function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<AppRouteLoading />}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ConciergeProvider>
            <Toaster />
            <Suspense fallback={null}><TrackingPixels /></Suspense>
            <Suspense fallback={<AppRouteLoading />}>
              <Router />
            </Suspense>
            <Suspense fallback={null}><NexoraJourneyBar /></Suspense>
            <Suspense fallback={null}><NexoraCopilot /></Suspense>
            <Suspense fallback={null}><WhatsAppButton /></Suspense>
            <Suspense fallback={null}><GoogleReviewsBadge /></Suspense>
            </ConciergeProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
