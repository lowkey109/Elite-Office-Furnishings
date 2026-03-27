import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AdminPageShell,
  AdminSection,
  AdminSplitLayout,
  ActionToolbar,
  AdminTable,
  Button,
  DetailField,
  DetailPanel,
  EmptyState,
  FilterGroup,
  FilterToolbar,
  KpiGrid,
  SearchInput,
  SelectInput,
  StatCard,
  StatusBadge,
  type TableColumn,
} from "./AdminUiKit";

type PipelineStats = {
  total: number;
  highValueCount: number;
  mediumCount: number;
  lowCount: number;
  paidCount: number;
  avgScore: number;
  totalPipelineValue: number;
  stageCounts: Record<string, number>;
};

type LeadRow = {
  id: string;
  companyName: string | null;
  city: string | null;
  leadStatus: string | null;
  projectType: string | null;
  budgetRange: string | null;
  staffCount: string | null;
  opportunityScore: number | null;
  createdAt: string | null;
  nextAction: string | null;
};

function stageFromScore(score: number | null): "Hot" | "Warm" | "Cold" {
  if (!score) return "Cold";
  if (score >= 70) return "Hot";
  if (score >= 45) return "Warm";
  return "Cold";
}

function stageTone(stage: "Hot" | "Warm" | "Cold") {
  if (stage === "Hot") return "danger" as const;
  if (stage === "Warm") return "warning" as const;
  return "muted" as const;
}

function formatValue(v: number): string {
  if (!v) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}K`;
  return `$${v.toLocaleString()}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminCommandCentreExample() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [stage, setStage] = React.useState("all");
  const [selected, setSelected] = React.useState<LeadRow | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<PipelineStats>({
    queryKey: ["/api/admin/pipeline-stats"],
    refetchInterval: 60_000,
  });

  const { data: leadsRaw = [], isLoading: leadsLoading } = useQuery<LeadRow[]>({
    queryKey: ["/api/admin/leads/pipeline"],
    refetchInterval: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, any> }) =>
      apiRequest("PATCH", `/api/admin/leads/${id}/pipeline`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads/pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pipeline-stats"] });
      toast({ title: "Lead updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const rows = React.useMemo(() => {
    return leadsRaw.filter((row) => {
      const matchesQuery =
        !query ||
        (row.companyName ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (row.city ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (row.projectType ?? "").toLowerCase().includes(query.toLowerCase());

      const rowStage = stageFromScore(row.opportunityScore).toLowerCase();
      const matchesStage = stage === "all" || rowStage === stage;

      return matchesQuery && matchesStage;
    });
  }, [leadsRaw, query, stage]);

  const columns: TableColumn<LeadRow>[] = [
    {
      key: "company",
      title: "Company",
      render: (row) => (
        <button
          type="button"
          className="text-left"
          onClick={() => setSelected(row)}
          data-testid={`btn-lead-select-${row.id}`}
        >
          <div className="font-medium text-slate-900 dark:text-slate-50">
            {row.companyName ?? "—"}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {row.city ?? ""}
          </div>
        </button>
      ),
    },
    {
      key: "type",
      title: "Project Type",
      render: (row) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {row.projectType ?? "—"}
        </span>
      ),
    },
    {
      key: "stage",
      title: "Stage",
      render: (row) => {
        const s = stageFromScore(row.opportunityScore);
        return <StatusBadge tone={stageTone(s)}>{s}</StatusBadge>;
      },
    },
    {
      key: "score",
      title: "Score",
      render: (row) => (
        <span className="font-medium text-slate-900 dark:text-slate-50">
          {row.opportunityScore ?? "—"}
        </span>
      ),
    },
    {
      key: "updatedAt",
      title: "Created",
      render: (row) => (
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {timeAgo(row.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      title: "Actions",
      className: "w-[1%] whitespace-nowrap",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelected(row)}
            data-testid={`btn-lead-view-${row.id}`}
          >
            View
          </Button>
        </div>
      ),
    },
  ];

  const isLoading = statsLoading || leadsLoading;

  return (
    <AdminPageShell
      title="Admin Command Centre"
      subtitle="Live pipeline data — monitor opportunities, track scores, and manage next actions."
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/admin/pipeline-stats"] });
              queryClient.invalidateQueries({ queryKey: ["/api/admin/leads/pipeline"] });
            }}
            data-testid="btn-refresh-pipeline"
          >
            Refresh
          </Button>
        </>
      }
    >
      <KpiGrid>
        <StatCard
          label="Pipeline Value"
          value={statsLoading ? "…" : formatValue(stats?.totalPipelineValue ?? 0)}
          hint="Total estimated opportunity value"
          trend={
            stats
              ? { label: `${stats.total} total leads`, tone: "info" }
              : undefined
          }
        />
        <StatCard
          label="High-Value Leads"
          value={statsLoading ? "…" : String(stats?.highValueCount ?? 0)}
          hint="Score ≥ 70 — require immediate follow-up"
          trend={
            stats?.highValueCount
              ? { label: "Prioritise now", tone: "danger" }
              : { label: "None flagged", tone: "muted" }
          }
        />
        <StatCard
          label="Average Lead Score"
          value={statsLoading ? "…" : String(stats?.avgScore ?? 0)}
          hint="Across all active leads (0–100)"
          trend={{ label: "AI scored", tone: "info" }}
        />
        <StatCard
          label="Paid / Unlocked"
          value={statsLoading ? "…" : String(stats?.paidCount ?? 0)}
          hint="Leads with paid plan access"
          trend={{ label: "Premium leads", tone: "success" }}
        />
      </KpiGrid>

      <FilterToolbar>
        <FilterGroup label="Search">
          <SearchInput
            placeholder="Search company, city, or project type..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="input-search-leads"
          />
        </FilterGroup>

        <FilterGroup label="Stage">
          <SelectInput
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            data-testid="select-lead-stage"
          >
            <option value="all">All stages</option>
            <option value="hot">Hot (score ≥ 70)</option>
            <option value="warm">Warm (score 45–69)</option>
            <option value="cold">Cold (score &lt; 45)</option>
          </SelectInput>
        </FilterGroup>

        <FilterGroup label="Quick actions" className="xl:ml-auto">
          <Button
            variant="outline"
            onClick={() => { setQuery(""); setStage("all"); }}
            data-testid="btn-clear-filters"
          >
            Clear Filters
          </Button>
        </FilterGroup>
      </FilterToolbar>

      <ActionToolbar
        secondary={
          <>
            <StatusBadge tone="info">{rows.length} visible records</StatusBadge>
            {isLoading && <StatusBadge tone="muted">Loading…</StatusBadge>}
          </>
        }
        primary={<></>}
      />

      <AdminSplitLayout
        left={
          <AdminSection
            title="Opportunity Queue"
            subtitle="Real-time leads ordered by creation date. Click any row to review."
          >
            <AdminTable
              rows={rows}
              columns={columns}
              rowKey={(row) => row.id}
              emptyState={
                <EmptyState
                  title="No opportunities match your filters"
                  description="Try widening your search or clearing the current stage filter."
                />
              }
            />
          </AdminSection>
        }
        right={
          <DetailPanel
            title={selected?.companyName ?? "No record selected"}
            subtitle={
              selected
                ? `${selected.city ?? "Unknown city"} • ${selected.projectType ?? "Unknown type"}`
                : "Choose a record to view detail"
            }
            actions={
              selected ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(null)}
                    data-testid="btn-dismiss-lead"
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!selected) return;
                      updateMutation.mutate({
                        id: selected.id,
                        updates: { leadStatus: "In Review" },
                      });
                    }}
                    data-testid="btn-mark-in-review"
                  >
                    Mark In Review
                  </Button>
                </>
              ) : null
            }
          >
            {selected ? (
              <div className="space-y-5">
                <DetailField
                  label="Stage"
                  value={
                    <StatusBadge tone={stageTone(stageFromScore(selected.opportunityScore))}>
                      {stageFromScore(selected.opportunityScore)}
                    </StatusBadge>
                  }
                />
                <DetailField
                  label="Opportunity Score"
                  value={selected.opportunityScore != null ? String(selected.opportunityScore) : "Not scored"}
                />
                <DetailField label="Budget Range" value={selected.budgetRange ?? "Not specified"} />
                <DetailField label="Staff Count" value={selected.staffCount ?? "—"} />
                <DetailField label="Status" value={selected.leadStatus ?? "New"} />
                <DetailField label="Created" value={timeAgo(selected.createdAt)} />

                {selected.nextAction && (
                  <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Next action
                    </p>
                    <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                      {selected.nextAction}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                title="Select a record"
                description="Use the table to choose an opportunity and review its details here."
              />
            )}
          </DetailPanel>
        }
      />
    </AdminPageShell>
  );
}
