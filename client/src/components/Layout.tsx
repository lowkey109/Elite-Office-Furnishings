import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Phone, Mail, X } from "lucide-react";
import ChatBot from "@/components/ChatBot";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Catalog", href: "/catalog" },
  { label: "Workplace Solutions", href: "/workplace-solutions" },
  { label: "Partners", href: "/partners" },
];

type MobileMenuItem = { label: string; href: string };
type MobileMenuSection = { title: "Products" | "Services" | "Company"; items: MobileMenuItem[] };

const mobileMenuSections: MobileMenuSection[] = [
  {
    title: "Products",
    items: [
      { label: "Executive Desks", href: "/catalog/executive-desks" },
      { label: "Manager Desks", href: "/catalog/manager-desks" },
      { label: "Boardroom Tables", href: "/catalog/boardroom-tables" },
      { label: "Reception Desks", href: "/catalog/reception-desks" },
      { label: "Office Seating", href: "/catalog/office-seating" },
      { label: "Workstations", href: "/catalog/workstations" },
      { label: "Storage & Cabinets", href: "/catalog/storage-cabinets" },
      { label: "Office Pods", href: "/catalog/office-pods" },
    ],
  },
  {
    title: "Services",
    items: [
      { label: "Workplace Solutions", href: "/workplace-solutions" },
      { label: "AI Office Planner", href: "/ai-office-planner" },
      { label: "3D Office Walkthrough", href: "/3d-office-walkthrough" },
      { label: "Free Layout Plan", href: "/free-layout-plan" },
      { label: "Quote Builder", href: "/quote-builder" },
      { label: "Request a Quote", href: "/request-a-quote" },
      { label: "Finance Your Workspace", href: "/finance-your-workspace" },
      { label: "Trade & Project Procurement", href: "/trade-project-procurement" },
      { label: "Strategy Call", href: "/strategy-call" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "Case Studies", href: "/case-studies" },
      { label: "Blog", href: "/blog" },
      { label: "About Us", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[hsl(220,20%,6%)]/96 backdrop-blur-md border-b border-[rgba(201,168,76,0.15)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link href="/">
            <div
              className="flex flex-col cursor-pointer py-2 pr-4"
              data-testid="link-logo"
              style={{ touchAction: "manipulation" }}
            >
              <span className="text-lg sm:text-xl font-serif font-bold tracking-tight text-white leading-tight">
                THE CORPORATE
              </span>
              <span className="text-xs sm:text-sm font-serif tracking-[0.3em] gold-text uppercase -mt-0.5">
                DESK
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`text-sm font-medium tracking-wide transition-colors cursor-pointer py-2 px-1 ${
                    location === link.href
                      ? "text-[hsl(43,78%,65%)]"
                      : "text-white/70 hover:text-white"
                  }`}
                  style={{ touchAction: "manipulation" }}
                >
                  {link.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            <a
              href="tel:1300977607"
              className="text-sm text-white/60 hover:text-[hsl(43,78%,65%)] transition-colors flex items-center gap-1.5 py-2"
              data-testid="link-phone"
              style={{ touchAction: "manipulation" }}
            >
              <Phone className="w-3.5 h-3.5" />
              1300 977 607
            </a>
            <Button
              asChild
              size="sm"
              className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-semibold tracking-wide border-none min-h-[44px] px-5"
            >
              <Link href="/request-a-quote" data-testid="button-get-quote-header">
                Get Started
              </Link>
            </Button>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="lg:hidden text-white min-h-[48px] min-w-[48px]"
                data-testid="button-mobile-menu"
                style={{ touchAction: "manipulation" }}
              >
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="bg-[hsl(220,18%,10%)] border-[rgba(201,168,76,0.15)] w-full sm:w-80 p-0"
            >
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(201,168,76,0.1)]">
                  <div className="flex flex-col">
                    <span className="text-lg font-serif font-bold text-white">THE CORPORATE</span>
                    <span className="text-xs font-serif tracking-[0.3em] gold-text uppercase -mt-0.5">DESK</span>
                  </div>
                </div>

                <nav className="flex-1 px-6 py-6 overflow-y-auto">
                  {mobileMenuSections.map((section) => (
                    <div key={section.title} className="mb-8">
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white">
                        {section.title}
                      </h3>
                      <div className="space-y-4">
                        {section.items.map((item) => (
                          <Link
                            key={`${section.title}-${item.href}`}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                          >
                            <span
                              data-testid={`link-mobile-nav-${item.label.toLowerCase().replace(/[\s&]+/g, "-")}`}
                              className={`block text-base transition-colors cursor-pointer ${
                                location === item.href
                                  ? "text-[hsl(43,78%,65%)]"
                                  : "text-white/70 hover:text-white"
                              }`}
                              style={{ touchAction: "manipulation", minHeight: "28px" }}
                            >
                              {item.label}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>

                <div className="px-4 pb-safe pb-8 border-t border-[rgba(201,168,76,0.1)] pt-6 space-y-3">
                  <Button
                    asChild
                    className="w-full bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none min-h-[52px] text-base"
                    style={{ touchAction: "manipulation" }}
                  >
                    <Link href="/request-a-quote" data-testid="button-mobile-get-quote">
                      Get Started
                    </Link>
                  </Button>

                  <a
                    href="tel:1300977607"
                    className="flex items-center justify-center gap-3 w-full min-h-[52px] rounded-md border border-[rgba(201,168,76,0.25)] text-[hsl(43,78%,65%)] font-medium text-base"
                    style={{ touchAction: "manipulation" }}
                    data-testid="link-mobile-phone"
                  >
                    <Phone className="w-5 h-5" />
                    1300 977 607
                  </a>

                  <a
                    href="mailto:service@thecorporatedesk.com.au"
                    className="flex items-center justify-center gap-3 w-full min-h-[48px] text-white/50 text-sm"
                    style={{ touchAction: "manipulation" }}
                    data-testid="link-mobile-email"
                  >
                    <Mail className="w-4 h-4" />
                    service@thecorporatedesk.com.au
                  </a>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-[hsl(220,20%,5%)] border-t border-[rgba(201,168,76,0.12)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex flex-col mb-5">
              <span className="text-xl font-serif font-bold text-white">THE CORPORATE</span>
              <span className="text-sm font-serif tracking-[0.3em] gold-text uppercase -mt-1">DESK</span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed mb-6">
              Australia's premier commercial office furniture supplier. ISO 9001 certified with a 6-year manufacturer's warranty.
            </p>
            <div className="flex gap-3">
              <a
                href="https://facebook.com/thecorporatedesk.com.au"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 rounded-full border border-[rgba(201,168,76,0.2)] flex items-center justify-center text-white/40 active:text-[hsl(43,78%,65%)] active:border-[rgba(201,168,76,0.5)] transition-all"
                style={{ touchAction: "manipulation" }}
                data-testid="link-footer-facebook"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a
                href="https://www.instagram.com/thecorporatedesk.au/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 rounded-full border border-[rgba(201,168,76,0.2)] flex items-center justify-center text-white/40 active:text-[hsl(43,78%,65%)] active:border-[rgba(201,168,76,0.5)] transition-all"
                style={{ touchAction: "manipulation" }}
                data-testid="link-footer-instagram"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path fill="hsl(220,18%,10%)" d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="hsl(220,18%,10%)" strokeWidth="2"/>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5 tracking-wide text-sm uppercase">Products</h4>
            <ul className="space-y-1">
              {[
                { label: "Executive Desks", href: "/catalog/executive-desks" },
                { label: "Manager Desks", href: "/catalog/manager-desks" },
                { label: "Boardroom Tables", href: "/catalog/boardroom-tables" },
                { label: "Reception Desks", href: "/catalog/reception-desks" },
                { label: "Office Seating", href: "/catalog/office-seating" },
                { label: "Workstations", href: "/catalog/workstations" },
                { label: "Storage & Cabinets", href: "/catalog/storage-cabinets" },
                { label: "Office Pods", href: "/catalog/office-pods" },
              ].map(item => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <span
                      className="block py-2.5 text-sm text-white/50 active:text-[hsl(43,78%,65%)] transition-colors cursor-pointer"
                      style={{ touchAction: "manipulation" }}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5 tracking-wide text-sm uppercase">Services</h4>
            <ul className="space-y-1">
              {[
                { label: "Workplace Solutions", href: "/workplace-solutions" },
                { label: "AI Office Planner", href: "/ai-office-planner" },
                { label: "3D Office Walkthrough", href: "/3d-office-walkthrough" },
                { label: "Free Layout Plan", href: "/free-layout-plan" },
                { label: "Quote Builder", href: "/quote-builder" },
                { label: "Request a Quote", href: "/request-a-quote" },
                { label: "Finance Your Workspace", href: "/finance-your-workspace" },
                { label: "Trade & Project Procurement", href: "/trade-project-procurement" },
                { label: "Strategy Call", href: "/strategy-call" },
              ].map(item => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <span
                      className="block py-2.5 text-sm text-white/50 active:text-[hsl(43,78%,65%)] transition-colors cursor-pointer"
                      style={{ touchAction: "manipulation" }}
                    >
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5 tracking-wide text-sm uppercase">Contact</h4>
            <ul className="space-y-4">
              <li>
                <a
                  href="tel:1300977607"
                  className="flex gap-3 py-1 group"
                  style={{ touchAction: "manipulation" }}
                  data-testid="link-footer-phone"
                >
                  <Phone className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm text-white/70">1300 977 607</span>
                    <p className="text-xs text-white/40 mt-0.5">Mon–Fri 9am–5pm AEST</p>
                  </div>
                </a>
              </li>
              <li>
                <a
                  href="mailto:service@thecorporatedesk.com.au"
                  className="flex gap-3 py-1"
                  style={{ touchAction: "manipulation" }}
                  data-testid="link-footer-email"
                >
                  <Mail className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-white/70 break-all">service@thecorporatedesk.com.au</span>
                </a>
              </li>
              <li className="flex gap-3 py-1">
                <svg className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <div className="text-sm text-white/70">
                  <p>10 Primrose Street</p>
                  <p>Bowen Hills, QLD 4006</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-[rgba(201,168,76,0.08)] flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} The Corporate Desk. All rights reserved. Australian Owned & Operated.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            {["ISO 9001", "ISO 14001", "6-Year Warranty", "AU Owned"].map(cert => (
              <span key={cert} className="text-xs text-[hsl(43,78%,52%)]/70 font-medium">{cert}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isEmbed = location.startsWith("/embed/");

  if (isEmbed) {
    return (
      <div className="min-h-screen bg-background">
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatBot />
    </div>
  );
}
