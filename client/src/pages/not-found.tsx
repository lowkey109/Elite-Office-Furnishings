import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <Layout>
      <section className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[hsl(220,20%,5%)] to-background pt-20">
        <div className="text-center px-6">
          <div className="text-9xl font-serif font-bold text-[rgba(201,168,76,0.2)]">
            404
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mt-4 mb-4">
            Page Not Found
          </h1>
          <p className="text-white/50 max-w-md mx-auto mb-10 leading-relaxed">
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg" className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold border-none px-8" data-testid="button-404-home">
              <Link href="/">Return Home <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] px-8" data-testid="button-404-contact">
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
