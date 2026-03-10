import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Phone, Mail, ChevronDown } from "lucide-react";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Products", href: "/products" },
  { label: "Workplace Solutions", href: "/workplace-solutions" },
  { label: "Contact", href: "/contact" },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[hsl(220,20%,6%)]/95 backdrop-blur-md border-b border-[rgba(201,168,76,0.15)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/">
            <div className="flex flex-col cursor-pointer" data-testid="link-logo">
              <span className="text-xl font-serif font-bold tracking-tight text-white">
                THE CORPORATE
              </span>
              <span className="text-sm font-serif tracking-[0.3em] gold-text uppercase -mt-1">
                DESK
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`text-sm font-medium tracking-wide transition-colors cursor-pointer ${
                    location === link.href
                      ? "text-[hsl(43,78%,65%)]"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            <a
              href="tel:1300977607"
              className="text-sm text-white/60 hover:text-[hsl(43,78%,65%)] transition-colors flex items-center gap-1.5"
              data-testid="link-phone"
            >
              <Phone className="w-3.5 h-3.5" />
              1300 977 607
            </a>
            <Button asChild size="sm" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-semibold tracking-wide hover:bg-[hsl(43,78%,58%)] border-none">
              <Link href="/workplace-solutions" data-testid="button-get-quote-header">
                Get a Quote
              </Link>
            </Button>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="lg:hidden text-white" data-testid="button-mobile-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-[hsl(220,18%,10%)] border-[rgba(201,168,76,0.15)] w-80">
              <div className="flex flex-col gap-6 mt-8">
                <div className="flex flex-col mb-4">
                  <span className="text-xl font-serif font-bold text-white">THE CORPORATE</span>
                  <span className="text-sm font-serif tracking-[0.3em] gold-text uppercase -mt-1">DESK</span>
                </div>
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <span
                      onClick={() => setMobileOpen(false)}
                      className="block text-lg font-medium text-white/80 hover:text-[hsl(43,78%,65%)] transition-colors cursor-pointer py-1"
                    >
                      {link.label}
                    </span>
                  </Link>
                ))}
                <div className="pt-4 border-t border-[rgba(201,168,76,0.15)] flex flex-col gap-3">
                  <a href="tel:1300977607" className="flex items-center gap-2 text-white/60">
                    <Phone className="w-4 h-4" />
                    1300 977 607
                  </a>
                  <a href="mailto:service@thecorporatedesk.com.au" className="flex items-center gap-2 text-white/60 text-sm">
                    <Mail className="w-4 h-4" />
                    service@thecorporatedesk.com.au
                  </a>
                  <Button asChild className="mt-2 bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-semibold">
                    <Link href="/workplace-solutions" onClick={() => setMobileOpen(false)}>
                      Get a Quote
                    </Link>
                  </Button>
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
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-1">
            <div className="flex flex-col mb-5">
              <span className="text-xl font-serif font-bold text-white">THE CORPORATE</span>
              <span className="text-sm font-serif tracking-[0.3em] gold-text uppercase -mt-1">DESK</span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">
              Australia's premier commercial office furniture supplier. ISO 9001 certified with a 6-year manufacturer's warranty.
            </p>
            <div className="flex gap-3 mt-6">
              <a href="https://facebook.com/thecorporatedesk.com.au" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full border border-[rgba(201,168,76,0.2)] flex items-center justify-center text-white/40 hover:text-[hsl(43,78%,65%)] hover:border-[rgba(201,168,76,0.5)] transition-all">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://www.instagram.com/thecorporatedesk.au/" target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-full border border-[rgba(201,168,76,0.2)] flex items-center justify-center text-white/40 hover:text-[hsl(43,78%,65%)] hover:border-[rgba(201,168,76,0.5)] transition-all">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path fill="hsl(220,18%,10%)" d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="hsl(220,18%,10%)" strokeWidth="2"/></svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5 tracking-wide text-sm uppercase">Products</h4>
            <ul className="space-y-3">
              {["Executive Desks", "Manager Desks", "Boardroom Tables", "Reception Desks", "Office Seating", "Workstations", "Storage & Cabinets", "Office Pods"].map(item => (
                <li key={item}>
                  <Link href="/products">
                    <span className="text-sm text-white/50 hover:text-[hsl(43,78%,65%)] transition-colors cursor-pointer">{item}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5 tracking-wide text-sm uppercase">Services</h4>
            <ul className="space-y-3">
              {[
                { label: "Workplace Solutions", href: "/workplace-solutions" },
                { label: "Free Layout Plan", href: "/free-office-layout-plan" },
                { label: "Request a Quote", href: "/send-us-your-quote" },
                { label: "Strategy Call", href: "/workplace-strategy" },
                { label: "About Us", href: "/about" },
                { label: "Contact", href: "/contact" },
              ].map(item => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <span className="text-sm text-white/50 hover:text-[hsl(43,78%,65%)] transition-colors cursor-pointer">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-5 tracking-wide text-sm uppercase">Contact</h4>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <Phone className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                <div>
                  <a href="tel:1300977607" className="text-sm text-white/70 hover:text-white transition-colors">1300 977 607</a>
                  <p className="text-xs text-white/40 mt-0.5">Mon–Fri 9am–5pm AEST</p>
                </div>
              </li>
              <li className="flex gap-3">
                <Mail className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" />
                <a href="mailto:service@thecorporatedesk.com.au" className="text-sm text-white/70 hover:text-white transition-colors break-all">
                  service@thecorporatedesk.com.au
                </a>
              </li>
              <li className="flex gap-3">
                <svg className="w-4 h-4 text-[hsl(43,78%,52%)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <div className="text-sm text-white/70">
                  <p>10 Primrose Street</p>
                  <p>Bowen Hills, QLD 4006</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-[rgba(201,168,76,0.08)] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} The Corporate Desk. All rights reserved. ABN: Australian Owned & Operated.
          </p>
          <div className="flex flex-wrap gap-6 justify-center">
            {["ISO 9001 Certified", "ISO 14001 Certified", "6-Year Warranty", "Australian Owned"].map(cert => (
              <span key={cert} className="text-xs text-[hsl(43,78%,52%)]/70 font-medium">{cert}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
