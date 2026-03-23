import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileText, AlertTriangle, Loader2, ArrowRight } from "lucide-react";

export default function PartnerAgreement() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [agreed, setAgreed] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [signed, setSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{
    alreadySigned: boolean;
    partnerName?: string;
    companyName?: string;
    email?: string;
    referralRate?: number;
    templateVersion?: string;
    agreementText?: string;
  }>({
    queryKey: ["/api/partner/agreement", token],
    queryFn: () => fetch(`/api/partner/agreement/${token}`).then(r => {
      if (!r.ok) throw new Error("Agreement not found");
      return r.json();
    }),
    retry: false,
  });

  const signMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/partner/agreement/${token}/sign`, { signedByName: signedName.trim() }),
    onSuccess: async (res: any) => {
      const body = await res.json();
      setSigned(true);
      setSignedAt(body.signedAt);
      toast({ title: "Agreement signed — welcome to the network!" });
    },
    onError: (err: any) => {
      toast({ title: "Signing failed", description: "Please try again or contact us.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-white/30" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6">
        <div className="border border-white/8 bg-white/[0.02] p-10 max-w-md w-full text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h2 className="text-white font-medium mb-2">Agreement Link Not Found</h2>
          <p className="text-white/40 text-sm mb-6">
            This signing link is invalid or has expired. Please contact us to receive a new link.
          </p>
          <p className="text-white/30 text-xs">service@thecorporatedesk.com.au · 1300 977 607</p>
        </div>
      </div>
    );
  }

  if (data.alreadySigned || signed) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6">
        <div className="border border-[hsl(43,78%,52%)]/20 bg-[hsl(43,78%,52%)]/3 p-10 max-w-md w-full text-center">
          <CheckCircle2 className="w-12 h-12 text-[hsl(43,78%,52%)] mx-auto mb-5" />
          <h2 className="text-white text-xl font-light mb-3">Agreement Signed</h2>
          <p className="text-white/60 text-sm mb-2">
            Welcome to the Corporate Desk Partner Network, <strong className="text-white">{data.partnerName || signedName}</strong>.
          </p>
          {signedAt && (
            <p className="text-white/30 text-xs mb-6">
              Signed: {new Date(signedAt).toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })} AEST
            </p>
          )}
          {!signedAt && (
            <p className="text-white/30 text-xs mb-6">Your account is now active.</p>
          )}
          <div className="space-y-3">
            <Button asChild className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold rounded-none" data-testid="button-go-to-dashboard">
              <Link href="/partner-dashboard">Go to Partner Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="w-full border-white/15 text-white/60 hover:bg-white/5 rounded-none" data-testid="button-submit-deal">
              <Link href="/submit-deal">Submit Your First Deal</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const commissionPct = ((data.referralRate || 0.075) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">

      {/* Header */}
      <div className="border-b border-white/8 bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex flex-col cursor-pointer">
            <span className="text-sm font-serif font-bold text-white leading-tight">THE CORPORATE</span>
            <span className="text-[9px] font-serif tracking-[0.3em] text-[hsl(43,78%,52%)] uppercase">DESK</span>
          </Link>
          <div className="text-xs text-white/30 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Partner Referral Agreement
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Intro */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(43,78%,52%)]/25 bg-[hsl(43,78%,52%)]/5 text-[hsl(43,78%,52%)] text-xs font-medium tracking-wide uppercase mb-6">
            Partner Agreement
          </div>
          <h1 className="text-3xl font-light text-white mb-3">
            Welcome, {data.partnerName}
          </h1>
          <p className="text-white/50 leading-relaxed">
            You have been approved as a partner of The Corporate Desk. Please review the Partner Referral Agreement below and sign to activate your account.
          </p>
        </div>

        {/* Key terms summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Commission Rate", value: `${commissionPct}%` },
            { label: "Payment Terms", value: "30 days after client pays" },
            { label: "Arrangement Type", value: "Referral / Introducer" },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 border border-white/8 bg-white/[0.02]">
              <div className="text-xs text-white/35 mb-1">{label}</div>
              <div className="text-sm text-white font-medium">{value}</div>
            </div>
          ))}
        </div>

        {/* Agreement text */}
        <div className="border border-white/8 bg-white/[0.015] mb-8">
          <div className="border-b border-white/8 px-6 py-4 flex items-center gap-3">
            <FileText className="w-4 h-4 text-white/30" />
            <span className="text-sm text-white/60">Partner Referral Agreement — Version {data.templateVersion}</span>
          </div>
          <div className="px-6 py-6 max-h-[480px] overflow-y-auto">
            <pre className="text-xs text-white/55 whitespace-pre-wrap leading-relaxed font-mono" data-testid="text-agreement-body">
              {data.agreementText}
            </pre>
          </div>
        </div>

        {/* Signing section */}
        <div className="border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-base font-medium text-white mb-5">Digital Signature</h2>

          <div className="space-y-5">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                data-testid="checkbox-agree"
                className="mt-0.5 w-4 h-4 accent-[hsl(43,78%,52%)] cursor-pointer"
              />
              <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors leading-relaxed">
                I have read, understood, and agree to be bound by the Partner Referral Agreement between myself ({data.companyName}) and The Corporate Desk Pty Ltd.
              </span>
            </label>

            <div>
              <label className="block text-xs text-white/35 uppercase tracking-wide mb-2">
                Your Full Legal Name (Digital Signature)
              </label>
              <input
                type="text"
                value={signedName}
                onChange={e => setSignedName(e.target.value)}
                data-testid="input-signed-name"
                placeholder={`e.g. ${data.partnerName || "Your full name"}`}
                className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 text-sm outline-none focus:border-white/25 placeholder:text-white/20"
              />
              <p className="text-white/25 text-xs mt-1.5">By entering your name, you are providing a legally binding digital signature.</p>
            </div>

            <Button
              onClick={() => signMutation.mutate()}
              disabled={!agreed || signedName.trim().length < 2 || signMutation.isPending}
              data-testid="button-sign-agreement"
              className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-black font-semibold py-3 h-auto rounded-none text-sm disabled:opacity-30"
            >
              {signMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Signing Agreement...</>
              ) : (
                <>Sign &amp; Activate Account <ArrowRight className="ml-2 w-4 h-4" /></>
              )}
            </Button>

            {!agreed && (
              <p className="text-white/25 text-xs text-center">Please read and check the agreement checkbox above before signing.</p>
            )}
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-8 text-center">
          <p className="text-white/25 text-xs">
            Questions about this agreement? Contact us at{" "}
            <a href="mailto:service@thecorporatedesk.com.au" className="text-[hsl(43,78%,52%)] hover:underline">
              service@thecorporatedesk.com.au
            </a>{" "}
            or call 1300 977 607.
          </p>
        </div>

      </div>
    </div>
  );
}
