import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { validateAdminLogin } from "@/lib/adminAuth";
import { Star, CheckCircle, XCircle, Trash2, ChevronLeft, MessageSquare, Clock, AlertCircle, Lock } from "lucide-react";

interface Review {
  id: string;
  productSku: string;
  reviewerName: string;
  reviewerCompany?: string;
  reviewerRole?: string;
  rating: number;
  title?: string;
  body: string;
  status: string;
  adminNote?: string;
  createdAt: string;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? "text-[hsl(43,78%,52%)] fill-[hsl(43,78%,52%)]" : "text-white/20"}`} />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    approved: "bg-green-500/15 text-green-400 border-green-500/25",
    rejected: "bg-red-500/15 text-red-400 border-red-500/25",
  };
  return (
    <Badge className={`border text-xs ${styles[status] || styles.pending}`} data-testid={`badge-status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function AdminProductReviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (sessionStorage.getItem("tcd_admin_auth") === "true") setAuthed(true);
  }, []);

  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ["/api/admin/product-reviews"],
    queryFn: () => fetch("/api/admin/product-reviews").then(r => r.json()),
    enabled: authed,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, adminNote }: { id: string; status: string; adminNote?: string }) =>
      fetch(`/api/admin/product-reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      }).then(r => r.json()),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-reviews"] });
      toast({ title: `Review ${vars.status}`, description: `Review has been ${vars.status}.` });
    },
    onError: () => toast({ title: "Failed", description: "Action failed. Please try again.", variant: "destructive" }),
  });

  const deleteReview = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/product-reviews/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/product-reviews"] });
      toast({ title: "Review deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const filtered = reviews.filter(r => filter === "all" || r.status === filter);
  const pending = reviews.filter(r => r.status === "pending").length;
  const approved = reviews.filter(r => r.status === "approved").length;
  const rejected = reviews.filter(r => r.status === "rejected").length;

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "hsl(220,20%,6%)" }}>
        <div className="luxury-card rounded-lg p-8 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-[hsl(43,78%,52%)]" />
            <h2 className="font-serif font-bold text-white text-xl">Admin Login</h2>
          </div>
          <div className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="bg-white/4 border border-white/10 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-white/25 placeholder:text-white/25"
              data-testid="input-admin-email"
            />
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (validateAdminLogin(email, pw) ? (sessionStorage.setItem("tcd_admin_auth", "true"), setAuthed(true)) : setPwError(true))}
              placeholder="Password"
              className="bg-white/4 border border-white/10 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-white/25 placeholder:text-white/25"
              data-testid="input-admin-password"
            />
            {pwError && <p className="text-red-400 text-xs">Invalid credentials</p>}
            <Button
              onClick={() => {
                if (validateAdminLogin(email, pw)) {
                  sessionStorage.setItem("tcd_admin_auth", "true");
                  setAuthed(true);
                } else setPwError(true);
              }}
              className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold"
              data-testid="button-admin-login"
            >
              Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(220,20%,6%)" }}>
      {/* Header */}
      <div className="border-b border-white/8 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="text-white/40 hover:text-white/70">
              <Link href="/admin/dashboard">
                <ChevronLeft className="w-4 h-4 mr-1" /> Dashboard
              </Link>
            </Button>
            <div className="w-px h-5 bg-white/10" />
            <div>
              <h1 className="font-serif font-bold text-white text-xl">Product Reviews</h1>
              <p className="text-white/40 text-xs">Moderate and manage client reviews</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pending > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-3 py-1.5 rounded-full" data-testid="pending-count">
                <AlertCircle className="w-3.5 h-3.5" />
                {pending} pending
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Pending", value: pending, color: "text-amber-400", icon: Clock },
            { label: "Approved", value: approved, color: "text-green-400", icon: CheckCircle },
            { label: "Rejected", value: rejected, color: "text-red-400", icon: XCircle },
          ].map(stat => (
            <div key={stat.label} className="luxury-card rounded-lg p-5 flex items-center gap-4">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
              <div>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-white/40 text-xs">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6">
          {(["pending", "approved", "rejected", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.3)]"
                  : "text-white/40 hover:text-white/70"
              }`}
              data-testid={`filter-${f}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && <span className="ml-1.5 text-xs opacity-60">({reviews.filter(r => r.status === f).length})</span>}
            </button>
          ))}
        </div>

        {/* Reviews list */}
        {isLoading ? (
          <div className="text-center py-16 text-white/30">Loading reviews...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-10 h-10 mx-auto mb-4 text-white/20" />
            <div className="text-white/40 text-sm">No {filter === "all" ? "" : filter} reviews found.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map(review => (
              <div key={review.id} className="luxury-card rounded-lg p-6" data-testid={`review-card-${review.id}`}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-semibold">{review.reviewerName}</span>
                      {(review.reviewerRole || review.reviewerCompany) && (
                        <span className="text-white/40 text-sm">
                          {[review.reviewerRole, review.reviewerCompany].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      <StatusBadge status={review.status} />
                    </div>
                    <div className="flex items-center gap-3">
                      <StarDisplay rating={review.rating} />
                      <Link href={`/products/${review.productSku}`} className="text-[hsl(43,78%,52%)] text-xs font-mono hover:underline" data-testid={`link-product-sku-${review.productSku}`}>
                        {review.productSku}
                      </Link>
                      <span className="text-white/25 text-xs">
                        {new Date(review.createdAt).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {review.status !== "approved" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatus.mutate({ id: review.id, status: "approved", adminNote: noteInputs[review.id] })}
                        disabled={updateStatus.isPending}
                        className="bg-green-500/15 border border-green-500/25 text-green-400 hover:bg-green-500/25 h-8"
                        data-testid={`button-approve-${review.id}`}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                    )}
                    {review.status !== "rejected" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatus.mutate({ id: review.id, status: "rejected", adminNote: noteInputs[review.id] })}
                        disabled={updateStatus.isPending}
                        className="bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 h-8"
                        data-testid={`button-reject-${review.id}`}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { if (confirm("Delete this review permanently?")) deleteReview.mutate(review.id); }}
                      disabled={deleteReview.isPending}
                      className="text-white/30 hover:text-red-400 h-8 px-2"
                      data-testid={`button-delete-${review.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {review.title && (
                  <div className="text-white/80 font-semibold text-sm mb-2">{review.title}</div>
                )}
                <p className="text-white/55 text-sm leading-relaxed mb-4">{review.body}</p>

                {/* Admin note */}
                <div className="border-t border-white/6 pt-4">
                  <label className="text-white/30 text-xs mb-1.5 block">Admin Note (optional)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={noteInputs[review.id] || review.adminNote || ""}
                      onChange={e => setNoteInputs(prev => ({ ...prev, [review.id]: e.target.value }))}
                      placeholder="Internal note for moderation record..."
                      className="flex-1 text-xs bg-white/4 border border-white/10 text-white/60 rounded px-3 py-1.5 focus:outline-none focus:border-white/20 placeholder:text-white/20"
                      data-testid={`input-admin-note-${review.id}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
