import * as React from "react";
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

type LeadRow = {
  id: string;
  company: string;
  city: string;
  stage: "Hot" | "Warm" | "Cold";
  source: string;
  value: string;
  updatedAt: string;
};

const sampleRows: LeadRow[] = [
  {
    id: "1",
    company: "Acme Advisory",
    city: "Brisbane",
    stage: "Hot",
    source: "Office Move Radar",
    value: "$85,000",
    updatedAt: "2h ago",
  },
  {
    id: "2",
    company: "Vertex Legal",
    city: "Sydney",
    stage: "Warm",
    source: "Deal Hunter",
    value: "$42,000",
    updatedAt: "5h ago",
  },
  {
    id: "3",
    company: "North Grid",
    city: "Melbourne",
    stage: "Cold",
    source: "Manual Intake",
    value: "$18,000",
    updatedAt: "1d ago",
  },
];

function stageTone(stage: LeadRow["stage"]) {
  if (stage === "Hot") return "danger";
  if (stage === "Warm") return "warning";
  return "muted";
}

export default function AdminCommandCentreExample() {
  const [query, setQuery] = React.useState("");
  const [stage, setStage] = React.useState("all");
  const [selected, setSelected] = React.useState<LeadRow | null>(sampleRows[0]);

  const rows = React.useMemo(() => {
    return sampleRows.filter((row) => {
      const matchesQuery =
        !query ||
        row.company.toLowerCase().includes(query.toLowerCase()) ||
        row.city.toLowerCase().includes(query.toLowerCase()) ||
        row.source.toLowerCase().includes(query.toLowerCase());

      const matchesStage =
        stage === "all" || row.stage.toLowerCase() === stage.toLowerCase();

      return matchesQuery && matchesStage;
    });
  }, [query, stage]);

  const columns: TableColumn<LeadRow>[] = [
    {
      key: "company",
      title: "Company",
      render: (row) => (
        <button
          type="button"
          className="text-left"
          onClick={() => setSelected(row)}
        >
          <div className="font-medium text-slate-900 dark:text-slate-50">
            {row.company}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {row.city}
          </div>
        </button>
      ),
    },
    {
      key: "source",
      title: "Source",
      render: (row) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {row.source}
        </span>
      ),
    },
    {
      key: "stage",
      title: "Stage",
      render: (row) => (
        <StatusBadge tone={stageTone(row.stage)}>{row.stage}</StatusBadge>
      ),
    },
    {
      key: "value",
      title: "Project Value",
      render: (row) => (
        <span className="font-medium text-slate-900 dark:text-slate-50">
          {row.value}
        </span>
      ),
    },
    {
      key: "updatedAt",
      title: "Updated",
      render: (row) => (
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {row.updatedAt}
        </span>
      ),
    },
    {
      key: "actions",
      title: "Actions",
      className: "w-[1%] whitespace-nowrap",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
            View
          </Button>
          <Button size="sm">Open</Button>
        </div>
      ),
    },
  ];

  return (
    <AdminPageShell
      title="Admin Command Centre"
      subtitle="Monitor pipeline, scan high-priority opportunities, and manage next actions in one place."
      actions={
        <>
          <Button variant="outline">Export</Button>
          <Button variant="secondary">Refresh</Button>
          <Button>New Action</Button>
        </>
      }
    >
      <KpiGrid>
        <StatCard
          label="Pipeline Value"
          value="$1.82M"
          hint="Total visible opportunity value"
          trend={{ label: "+12.4% this week", tone: "success" }}
        />
        <StatCard
          label="Hot Opportunities"
          value="18"
          hint="Require immediate follow-up"
          trend={{ label: "5 new today", tone: "danger" }}
        />
        <StatCard
          label="Scans Completed"
          value="42"
          hint="Across radar and lead systems"
          trend={{ label: "Healthy", tone: "info" }}
        />
        <StatCard
          label="Follow-ups Due"
          value="27"
          hint="Need action today"
          trend={{ label: "Prioritise", tone: "warning" }}
        />
      </KpiGrid>

      <FilterToolbar>
        <FilterGroup label="Search">
          <SearchInput
            placeholder="Search company, city, or source..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </FilterGroup>

        <FilterGroup label="Stage">
          <SelectInput
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="all">All stages</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </SelectInput>
        </FilterGroup>

        <FilterGroup label="Quick actions" className="xl:ml-auto">
          <Button variant="outline">Clear Filters</Button>
          <Button variant="secondary">Run Scan</Button>
        </FilterGroup>
      </FilterToolbar>

      <ActionToolbar
        secondary={
          <>
            <StatusBadge tone="info">{rows.length} visible records</StatusBadge>
            <StatusBadge tone="muted">Last sync 3m ago</StatusBadge>
          </>
        }
        primary={
          <>
            <Button variant="outline">Bulk Update</Button>
            <Button variant="outline">Assign Owner</Button>
            <Button>Push to Pipeline</Button>
          </>
        }
      />

      <AdminSplitLayout
        left={
          <AdminSection
            title="Opportunity Queue"
            subtitle="Review the most important opportunities first."
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
            title={selected?.company ?? "No record selected"}
            subtitle={
              selected
                ? `${selected.city} • ${selected.source}`
                : "Choose a record to view detail"
            }
            actions={
              selected ? (
                <>
                  <Button size="sm" variant="outline">
                    Dismiss
                  </Button>
                  <Button size="sm" variant="secondary">
                    Add Note
                  </Button>
                  <Button size="sm">Open Record</Button>
                </>
              ) : null
            }
          >
            {selected ? (
              <div className="space-y-5">
                <DetailField
                  label="Stage"
                  value={
                    <StatusBadge tone={stageTone(selected.stage)}>
                      {selected.stage}
                    </StatusBadge>
                  }
                />
                <DetailField label="Project Value" value={selected.value} />
                <DetailField label="Source" value={selected.source} />
                <DetailField label="Last Updated" value={selected.updatedAt} />

                <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Recommended next step
                  </p>
                  <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                    Prioritise a same-day outreach touchpoint, qualify timing,
                    confirm office move scope, and push toward proposal stage if
                    the opportunity is active.
                  </p>
                </div>
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