import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pause, Play, StopCircle, MessageSquare, Clock, CheckCircle2, XCircle, RotateCcw, Mail } from "lucide-react";
import type { FollowUpSequence } from "@shared/schema";

const STAGE_LABELS: Record<number, string> = {
  0: "Waiting (Day 1)",
  1: "Stage 1 Sent",
  2: "Stage 2 Sent",
  3: "Stage 3 Sent",
  4: "Stage 4 Sent",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active:    { label: "Active",    color: "bg-emerald-100 text-emerald-800 border-emerald-200",   icon: <Play className="w-3 h-3" /> },
  paused:    { label: "Paused",    color: "bg-yellow-100 text-yellow-800 border-yellow-200",      icon: <Pause className="w-3 h-3" /> },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-800 border-blue-200",            icon: <CheckCircle2 className="w-3 h-3" /> },
  stopped:   { label: "Stopped",   color: "bg-gray-100 text-gray-600 border-gray-200",            icon: <XCircle className="w-3 h-3" /> },
  replied:   { label: "Replied",   color: "bg-purple-100 text-purple-800 border-purple-200",      icon: <MessageSquare className="w-3 h-3" /> },
};

const LEAD_TYPE_LABELS: Record<string, string> = {
  "quote-builder":   "Quote Builder",
  "finance-lead":    "Finance Lead",
  "planner":         "AI Planner",
  "planning-request":"Layout Plan",
  "strategy":        "Strategy Call",
  "contact":         "Contact",
  "enquiry":         "Enquiry",
};

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeUntil(d: string | null | undefined): string {
  if (!d) return "—";
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return "Due now";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  if (days > 0) return `${days}d ${remainHours}h`;
  return `${hours}h`;
}

function StageProgress({ seq }: { seq: FollowUpSequence }) {
  const stages = [1, 2, 3, 4];
  const completed = (seq.stagesCompleted || []).map(Number);
  return (
    <div className="flex gap-1.5 items-center">
      {stages.map(s => {
        const sent = completed.includes(s);
        const current = seq.stage === s - 1 && seq.status === "active";
        return (
          <div
            key={s}
            title={sent ? `Day ${[1,3,7,14][s-1]} email sent` : `Day ${[1,3,7,14][s-1]} email pending`}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${
              sent
                ? "bg-emerald-500 text-white border-emerald-500"
                : current
                ? "bg-amber-100 text-amber-700 border-amber-400 animate-pulse"
                : "bg-gray-100 text-gray-400 border-gray-200"
            }`}
          >
            {sent ? <CheckCircle2 className="w-3.5 h-3.5" /> : s}
          </div>
        );
      })}
      <span className="text-xs text-gray-400 ml-1">
        {completed.length}/4 sent
      </span>
    </div>
  );
}

export default function AdminFollowUpSequences() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: sequences = [], isLoading } = useQuery<FollowUpSequence[]>({
    queryKey: ["/api/admin/follow-up-sequences", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all"
        ? "/api/admin/follow-up-sequences"
        : `/api/admin/follow-up-sequences?status=${statusFilter}`;
      const r = await fetch(url);
      return r.json();
    },
    refetchInterval: 30_000,
  });

  function useStatusMutation(action: string) {
    return useMutation({
      mutationFn: (id: string) =>
        fetch(`/api/admin/follow-up-sequences/${id}/${action}`, { method: "PATCH" }).then(r => r.json()),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/follow-up-sequences"] });
      },
    });
  }

  const pauseMutation    = useStatusMutation("pause");
  const resumeMutation   = useStatusMutation("resume");
  const stopMutation     = useStatusMutation("stop");
  const repliedMutation  = useStatusMutation("mark-replied");

  // Stats
  const active    = sequences.filter(s => s.status === "active").length;
  const paused    = sequences.filter(s => s.status === "paused").length;
  const completed = sequences.filter(s => s.status === "completed").length;
  const replied   = sequences.filter(s => s.status === "replied").length;
  const stopped   = sequences.filter(s => s.status === "stopped").length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title-followup">
            Follow-Up Sequences
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Automated Day 1 / 3 / 7 / 14 email sequences for all inbound leads
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Active",    value: active,    color: "text-emerald-600" },
            { label: "Paused",    value: paused,    color: "text-yellow-600" },
            { label: "Completed", value: completed, color: "text-blue-600" },
            { label: "Replied",   value: replied,   color: "text-purple-600" },
            { label: "Stopped",   value: stopped,   color: "text-gray-500" },
          ].map(stat => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3">
                <div className={`text-3xl font-bold ${stat.color}`} data-testid={`stat-${stat.label.toLowerCase()}`}>{stat.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm font-medium text-gray-600">Filter by status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sequences</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="replied">Replied</SelectItem>
              <SelectItem value="stopped">Stopped</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-400">{sequences.length} result{sequences.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Sequence list */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">Loading sequences…</div>
        ) : sequences.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No sequences found</p>
            <p className="text-sm mt-1">Sequences are created automatically when leads are submitted.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sequences.map(seq => {
              const statusCfg = STATUS_CONFIG[seq.status] || STATUS_CONFIG.stopped;
              return (
                <Card key={seq.id} className="border-0 shadow-sm hover:shadow-md transition-shadow" data-testid={`sequence-card-${seq.id}`}>
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Lead info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900" data-testid={`seq-name-${seq.id}`}>{seq.leadName}</span>
                          <span className="text-gray-400 text-sm">·</span>
                          <span className="text-sm text-gray-500 truncate">{seq.leadCompany}</span>
                          <Badge variant="outline" className="text-xs border-gray-200 text-gray-500">
                            {LEAD_TYPE_LABELS[seq.leadType] || seq.leadType}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-400 mt-0.5">{seq.leadEmail}</div>

                        {/* Context tags */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {seq.officeSize && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-500">{`${seq.officeSize} sqm`}</span>
                          )}
                          {seq.staffCount && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-500">{seq.staffCount} staff</span>
                          )}
                          {(seq.budgetMin || seq.budgetMax) && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-500">{seq.budgetMin && seq.budgetMax ? `$${seq.budgetMin.toLocaleString()} – $${seq.budgetMax.toLocaleString()}` : seq.budgetMin ? `$${seq.budgetMin.toLocaleString()}+` : seq.budgetMax ? `Up to $${seq.budgetMax.toLocaleString()}` : ""}</span>
                          )}
                        </div>
                      </div>

                      {/* Stage progress */}
                      <div className="flex-shrink-0">
                        <div className="text-xs text-gray-400 mb-1.5 font-medium">Email stages</div>
                        <StageProgress seq={seq} />
                      </div>

                      {/* Timing */}
                      <div className="flex-shrink-0 text-right min-w-[120px]">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </div>
                        {seq.status === "active" && seq.nextSendAt && (
                          <div className="text-xs text-gray-400 mt-1.5 flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3" />
                            Next in {timeUntil(seq.nextSendAt?.toString())}
                          </div>
                        )}
                        {seq.lastSentAt && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            Last: {formatDate(seq.lastSentAt?.toString())}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex items-center gap-1.5">
                        {seq.status === "active" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                              data-testid={`btn-pause-${seq.id}`}
                              onClick={() => pauseMutation.mutate(seq.id)}
                              disabled={pauseMutation.isPending}
                            >
                              <Pause className="w-3 h-3 mr-1" /> Pause
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
                              data-testid={`btn-stop-${seq.id}`}
                              onClick={() => stopMutation.mutate(seq.id)}
                              disabled={stopMutation.isPending}
                            >
                              <StopCircle className="w-3 h-3 mr-1" /> Stop
                            </Button>
                          </>
                        )}
                        {seq.status === "paused" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            data-testid={`btn-resume-${seq.id}`}
                            onClick={() => resumeMutation.mutate(seq.id)}
                            disabled={resumeMutation.isPending}
                          >
                            <Play className="w-3 h-3 mr-1" /> Resume
                          </Button>
                        )}
                        {(seq.status === "active" || seq.status === "paused") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                            data-testid={`btn-replied-${seq.id}`}
                            onClick={() => repliedMutation.mutate(seq.id)}
                            disabled={repliedMutation.isPending}
                          >
                            <MessageSquare className="w-3 h-3 mr-1" /> Replied
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* How it works panel */}
        <Card className="mt-10 border-0 shadow-sm bg-gray-800 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-100">How the sequence works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { day: "Day 1", title: "Warm follow-up", desc: "Personalised by lead type — quote, finance, planner, or enquiry." },
                { day: "Day 3", title: "Value content", desc: "Project timing advice, hybrid office trends, or finance comparison." },
                { day: "Day 7", title: "Social proof", desc: "500+ projects, case studies, and a fallback to the Quote Builder." },
                { day: "Day 14", title: "Final touch", desc: "Low-pressure closing note. Sequence completes after this email." },
              ].map(step => (
                <div key={step.day} className="flex flex-col gap-1">
                  <span className="text-[#c9a84c] text-xs font-semibold uppercase tracking-wide">{step.day}</span>
                  <span className="text-sm font-medium text-white">{step.title}</span>
                  <span className="text-xs text-gray-400 leading-relaxed">{step.desc}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400">
              Sequences auto-stop when a lead is marked as Replied or Stopped. Pause suspends without losing position.
              All emails are sent from <span className="text-gray-300">The Corporate Desk &lt;onboarding@resend.dev&gt;</span>.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
