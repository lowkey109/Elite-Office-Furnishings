import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConciergeProvider } from "@/contexts/ConciergeContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Products from "@/pages/Products";
import WorkplaceSolutions from "@/pages/WorkplaceSolutions";
import FreeLayoutPlan from "@/pages/FreeLayoutPlan";
import SendQuote from "@/pages/SendQuote";
import WorkplaceStrategy from "@/pages/WorkplaceStrategy";
import { ThankYouLayoutPlan, ThankYouQuote, ThankYouStrategy } from "@/pages/ThankYou";
import Contact from "@/pages/Contact";
import Marketing from "@/pages/Marketing";
import QuoteBuilder from "@/pages/QuoteBuilder";
import FinanceWorkspace from "@/pages/FinanceWorkspace";
import CaseStudies from "@/pages/CaseStudies";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminLeads from "@/pages/AdminLeads";
import AdminSupplierQuotes from "@/pages/AdminSupplierQuotes";
import AdminPlanningRequests from "@/pages/AdminPlanningRequests";
import UploadFloorPlan from "@/pages/UploadFloorPlan";
import OfficeWalkthrough from "@/pages/OfficeWalkthrough";
import Testimonials from "@/pages/Testimonials";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import ProductDetail from "@/pages/ProductDetail";
import AdminProductReviews from "@/pages/AdminProductReviews";
import AdminCommandCentre from "@/pages/AdminCommandCentre";
import AdminManufacturerMessaging from "@/pages/AdminManufacturerMessaging";
import AdminFollowUpSequences from "@/pages/AdminFollowUpSequences";
import AdminLeaseSignals from "@/pages/AdminLeaseSignals";
import AdminDealPipeline from "@/pages/AdminDealPipeline";
import AdminTerritoryScanner from "@/pages/AdminTerritoryScanner";
import AdminProcurementEngine from "@/pages/AdminProcurementEngine";
import AdminSupplierIntelligence from "@/pages/AdminSupplierIntelligence";
import AdminWorkspaceLearning from "@/pages/AdminWorkspaceLearning";
import AdminIntelligenceHub from "@/pages/AdminIntelligenceHub";
import AdminProfitEngine from "@/pages/AdminProfitEngine";
import AdminQuotes from "@/pages/AdminQuotes";
import QuotePrint from "@/pages/QuotePrint";
import AdminOfficeMovRadar from "@/pages/AdminOfficeMovRadar";
import WorkspaceDesignEngine from "@/pages/WorkspaceDesignEngine";
import AdminDealIntelligence from "@/pages/AdminDealIntelligence";
import AdminPartnerNetwork from "@/pages/AdminPartnerNetwork";
import AdminDealHunter from "@/pages/AdminDealHunter";
import AdminRelocationIntelligence from "@/pages/AdminRelocationIntelligence";
import AdminWorkspaceStrategy from "@/pages/AdminWorkspaceStrategy";
import PartnerOnboarding from "@/pages/PartnerOnboarding";
import PartnerDashboard from "@/pages/PartnerDashboard";
import MarketMap from "@/pages/MarketMap";
import AdminMarketIntelligence from "@/pages/AdminMarketIntelligence";
import AdminCompanyVisitors from "@/pages/AdminCompanyVisitors";
import ProposalEngine from "@/pages/ProposalEngine";
import BuildingDatabase from "@/pages/BuildingDatabase";
import AdminProductCommandCentre from "@/pages/AdminProductCommandCentre";
import AdminLeadEngine from "@/pages/AdminLeadEngine";
import { usePageTracking } from "@/lib/usePageTracking";

function Router() {
  usePageTracking();
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/products/:sku" component={ProductDetail} />
      <Route path="/products" component={Products} />
      <Route path="/workplace-solutions" component={WorkplaceSolutions} />
      <Route path="/free-office-layout-plan" component={FreeLayoutPlan} />
      <Route path="/send-us-your-quote" component={SendQuote} />
      <Route path="/workplace-strategy" component={WorkplaceStrategy} />
      <Route path="/quote-builder" component={QuoteBuilder} />
      <Route path="/finance-your-workspace" component={FinanceWorkspace} />
      <Route path="/case-studies" component={CaseStudies} />
      <Route path="/upload-your-floor-plan" component={UploadFloorPlan} />
      <Route path="/ai-workspace-design" component={WorkspaceDesignEngine} />
      <Route path="/3d-office-walkthrough" component={OfficeWalkthrough} />
      <Route path="/thank-you-layout-plan" component={ThankYouLayoutPlan} />
      <Route path="/thank-you-quote" component={ThankYouQuote} />
      <Route path="/thank-you-strategy" component={ThankYouStrategy} />
      <Route path="/contact" component={Contact} />
      <Route path="/testimonials" component={Testimonials} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/blog" component={Blog} />
      {/* Embed routes — no header/footer/chatbot, safe for WordPress iframes */}
      <Route path="/embed/quote-builder" component={QuoteBuilder} />
      <Route path="/embed/finance-your-workspace" component={FinanceWorkspace} />
      <Route path="/admin"><Redirect to="/admin/dashboard" /></Route>
      <Route path="/admin/marketing" component={Marketing} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/leads" component={AdminLeads} />
      <Route path="/admin/lead-intelligence" component={AdminLeads} />
      <Route path="/admin/supplier-quotes" component={AdminSupplierQuotes} />
      <Route path="/admin/planning-requests" component={AdminPlanningRequests} />
      <Route path="/admin/product-reviews" component={AdminProductReviews} />
      <Route path="/admin/command-centre" component={AdminCommandCentre} />
      <Route path="/admin/manufacturer-messaging" component={AdminManufacturerMessaging} />
      <Route path="/admin/follow-up-sequences" component={AdminFollowUpSequences} />
      <Route path="/admin/lease-signals" component={AdminLeaseSignals} />
      <Route path="/admin/deal-pipeline" component={AdminDealPipeline} />
      <Route path="/admin/territory-scanner" component={AdminTerritoryScanner} />
      <Route path="/admin/procurement-engine" component={AdminProcurementEngine} />
      <Route path="/admin/supplier-intelligence" component={AdminSupplierIntelligence} />
      <Route path="/admin/workspace-learning" component={AdminWorkspaceLearning} />
      <Route path="/admin/intelligence-hub" component={AdminIntelligenceHub} />
      <Route path="/admin/profit-engine" component={AdminProfitEngine} />
      <Route path="/admin/office-move-radar" component={AdminOfficeMovRadar} />
      <Route path="/admin/deal-intelligence" component={AdminDealIntelligence} />
      <Route path="/admin/quotes/:id/print" component={QuotePrint} />
      <Route path="/admin/quotes" component={AdminQuotes} />
      <Route path="/admin/deal-hunter" component={AdminDealHunter} />
      <Route path="/admin/partner-network" component={AdminPartnerNetwork} />
      <Route path="/admin/relocation-intelligence" component={AdminRelocationIntelligence} />
      <Route path="/admin/workspace-strategy" component={AdminWorkspaceStrategy} />
      <Route path="/partner-onboarding" component={PartnerOnboarding} />
      <Route path="/partner-dashboard" component={PartnerDashboard} />
      <Route path="/market-map" component={MarketMap} />
      <Route path="/admin/market-intelligence" component={AdminMarketIntelligence} />
      <Route path="/admin/company-visitors" component={AdminCompanyVisitors} />
      <Route path="/admin/proposal-engine" component={ProposalEngine} />
      <Route path="/admin/building-database" component={BuildingDatabase} />
      <Route path="/admin/products" component={AdminProductCommandCentre} />
      <Route path="/admin/lead-engine" component={AdminLeadEngine} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConciergeProvider>
          <Toaster />
          <Router />
        </ConciergeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
