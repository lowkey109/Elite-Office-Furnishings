import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/products" component={Products} />
      <Route path="/workplace-solutions" component={WorkplaceSolutions} />
      <Route path="/free-office-layout-plan" component={FreeLayoutPlan} />
      <Route path="/send-us-your-quote" component={SendQuote} />
      <Route path="/workplace-strategy" component={WorkplaceStrategy} />
      <Route path="/thank-you-layout-plan" component={ThankYouLayoutPlan} />
      <Route path="/thank-you-quote" component={ThankYouQuote} />
      <Route path="/thank-you-strategy" component={ThankYouStrategy} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
