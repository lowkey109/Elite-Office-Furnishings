import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, ArrowRight, Users, Package } from "lucide-react";
import { Link } from "wouter";

interface WorkspaceZone {
  zone: string;
  color: string;
  percentage: number;
  description: string;
  priority: string;
  staffCapacity?: number;
  keyFurniture?: string[];
}

interface ProductRec {
  zone: string;
  sku: string;
  category: string;
  productName: string;
  seriesRecommendation?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  rationale?: string;
}

interface SpacePlanningEngineProps {
  zones: WorkspaceZone[];
  recs?: ProductRec[];
  sqm?: string;
  staffCount?: string;
  costBreakdown?: { furniture: number; installation: number; delivery: number; total: number; perStaff?: number };
  estimatedValue?: string;
  implementationTimeline?: string;
  isPreview?: boolean;
  companyName?: string;
  generatedDate?: string;
}

const SVG_W = 720;
const SVG_H = 480;
const MARGIN = 14;
const GAP = 4;

interface ZoneRect {
  zone: WorkspaceZone;
  x: number;
  y: number;
  w: number;
  h: number;
}

function buildTreemap(
  zones: WorkspaceZone[],
  x: number, y: number, w: number, h: number,
  horizontal: boolean,
): ZoneRect[] {
  if (!zones.length) return [];
  if (zones.length === 1) return [{ zone: zones[0], x, y, w, h }];

  const totalPct = zones.reduce((s, z) => s + (z.percentage || 0), 0);
  if (totalPct === 0) return [];

  let cumulative = 0;
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < zones.length - 1; i++) {
    cumulative += zones[i].percentage;
    const diff = Math.abs(cumulative / totalPct - 0.5);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }

  const leftZones = zones.slice(0, bestIdx + 1);
  const rightZones = zones.slice(bestIdx + 1);
  const leftPct = leftZones.reduce((s, z) => s + z.percentage, 0) / totalPct;

  if (horizontal) {
    const splitW = w * leftPct;
    const lw = Math.max(0, splitW - GAP / 2);
    const rw = Math.max(0, w - splitW - GAP / 2);
    const rx = x + splitW + GAP / 2;
    return [
      ...buildTreemap(leftZones, x, y, lw, h, !horizontal),
      ...buildTreemap(rightZones, rx, y, rw, h, !horizontal),
    ];
  } else {
    const splitH = h * leftPct;
    const lh = Math.max(0, splitH - GAP / 2);
    const rh = Math.max(0, h - splitH - GAP / 2);
    const ry = y + splitH + GAP / 2;
    return [
      ...buildTreemap(leftZones, x, y, w, lh, !horizontal),
      ...buildTreemap(rightZones, x, ry, w, rh, !horizontal),
    ];
  }
}

function isBright(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? text.substring(0, maxChars - 1) + "…" : text;
}

function ZoneFurniture({ zone, x, y, w, h }: { zone: WorkspaceZone; x: number; y: number; w: number; h: number }) {
  const name = zone.zone.toLowerCase();
  const pad = 10;
  const labelH = 24;
  const ix = x + pad;
  const iy = y + labelH + pad;
  const iw = w - pad * 2;
  const ih = h - labelH - pad * 2;

  if (iw < 24 || ih < 20) return null;

  const color = zone.color || "#B8960C";
  const fill = `${color}25`;
  const stroke = color;
  const cap = zone.staffCapacity || 0;

  const isMeeting = name.includes("meeting") || name.includes("boardroom") || name.includes("conference");
  const isExec = name.includes("executive") || (name.includes("manager") && !name.includes("open")) || name.includes("director");
  const isReception = name.includes("reception") || name.includes("lobby") || name.includes("entry") || name.includes("front");
  const isBreakout = name.includes("breakout") || name.includes("lounge") || name.includes("collaborative") || name.includes("social");
  const isStorage = name.includes("storage") || name.includes("filing") || name.includes("archive") || name.includes("print");

  if (isMeeting) {
    const tw = Math.min(iw * 0.72, 140);
    const th = Math.min(ih * 0.52, 52);
    const tx = ix + (iw - tw) / 2;
    const ty = iy + (ih - th) / 2;
    const chairCount = Math.min(cap || 8, 16);
    const perSide = Math.floor(chairCount / 2);
    const spacing = tw / Math.max(perSide, 1);
    return (
      <g>
        <rect x={tx} y={ty} width={tw} height={th} rx="5" fill={fill} stroke={stroke} strokeWidth="1.5" />
        {Array.from({ length: perSide }).map((_, i) => (
          <g key={i}>
            <circle cx={tx + spacing * (i + 0.5)} cy={ty - 8} r={4} fill={color} opacity={0.6} />
            <circle cx={tx + spacing * (i + 0.5)} cy={ty + th + 8} r={4} fill={color} opacity={0.6} />
          </g>
        ))}
        {th > 22 && (
          <text x={tx + tw / 2} y={ty + th / 2 + 4} textAnchor="middle" fontSize="10"
            fill={isBright(color) ? "#1a1a2e" : "rgba(255,255,255,0.5)"}
            fontFamily="Inter,sans-serif">
            {truncate(zone.zone, Math.floor(tw / 7))}
          </text>
        )}
      </g>
    );
  }

  if (isExec) {
    const dw = Math.min(iw * 0.6, 85);
    const dh = Math.min(ih * 0.48, 54);
    const dx = ix + (iw - dw) / 2;
    const dy = iy + (ih - dh) / 2;
    return (
      <g>
        <rect x={dx} y={dy} width={dw} height={dh * 0.55} rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <rect x={dx + dw * 0.42} y={dy + dh * 0.5} width={dw * 0.52} height={dh * 0.46} rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <circle cx={dx + dw * 0.22} cy={dy - 7} r={5} fill={color} opacity={0.7} />
      </g>
    );
  }

  if (isReception) {
    const rw = Math.min(iw * 0.7, 100);
    const rh = Math.min(ih * 0.5, 50);
    const rx2 = ix + (iw - rw) / 2;
    const ry2 = iy + (ih - rh) / 2;
    return (
      <g>
        <rect x={rx2} y={ry2 + rh * 0.28} width={rw} height={rh * 0.38} rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <rect x={rx2} y={ry2} width={rw * 0.17} height={rh} rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <rect x={rx2 + rw * 0.83} y={ry2} width={rw * 0.17} height={rh} rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
      </g>
    );
  }

  if (isBreakout) {
    const cx2 = ix + iw / 2;
    const cy2 = iy + ih / 2;
    const r = Math.min(iw, ih) * 0.28;
    const chairs = Math.min(cap || 4, 6);
    return (
      <g>
        <circle cx={cx2} cy={cy2} r={r} fill={fill} stroke={stroke} strokeWidth="1.5" />
        {Array.from({ length: chairs }).map((_, i) => {
          const angle = (i / chairs) * Math.PI * 2 - Math.PI / 2;
          return <circle key={i} cx={cx2 + Math.cos(angle) * (r + 9)} cy={cy2 + Math.sin(angle) * (r + 9)} r={5} fill={color} opacity={0.6} />;
        })}
      </g>
    );
  }

  if (isStorage) {
    const cabW = 18;
    const cabH = 24;
    const cols = Math.min(Math.floor(iw / (cabW + 4)), 6);
    const rows = Math.min(Math.floor(ih / (cabH + 4)), 2);
    return (
      <g>
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => (
            <g key={`${r}-${c}`}>
              <rect x={ix + c * (cabW + 4)} y={iy + r * (cabH + 4)} width={cabW} height={cabH}
                rx="2" fill={fill} stroke={stroke} strokeWidth="1" />
              <line x1={ix + c * (cabW + 4) + cabW * 0.28} y1={iy + r * (cabH + 4) + cabH * 0.48}
                x2={ix + c * (cabW + 4) + cabW * 0.72} y2={iy + r * (cabH + 4) + cabH * 0.48}
                stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
            </g>
          ))
        )}
      </g>
    );
  }

  const deskCount = Math.min(cap || Math.max(3, Math.floor((iw * ih) / 1800)), 24);
  const deskW = 22;
  const deskH = 14;
  const chairR = 4;
  const cols = Math.max(1, Math.floor(iw / (deskW + 7)));
  const colSpacing = Math.min(iw / cols, deskW + 9);
  const rowSpacing = Math.min(ih / Math.max(Math.ceil(deskCount / cols), 1), deskH + 16);

  return (
    <g>
      {Array.from({ length: deskCount }).map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const dx = ix + col * colSpacing;
        const dy = iy + row * rowSpacing;
        if (dx + deskW > x + w - 4 || dy + deskH + chairR * 2 > y + h - 4) return null;
        return (
          <g key={i}>
            <rect x={dx} y={dy + chairR} width={deskW} height={deskH} rx="2" fill={fill} stroke={stroke} strokeWidth="1" />
            <circle cx={dx + deskW / 2} cy={dy} r={chairR} fill={color} opacity={0.55} />
          </g>
        );
      })}
    </g>
  );
}

export default function SpacePlanningEngine({
  zones,
  recs = [],
  sqm,
  staffCount,
  costBreakdown,
  estimatedValue,
  implementationTimeline,
  isPreview = false,
  companyName,
  generatedDate,
}: SpacePlanningEngineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const validZones = zones.filter(z => (z.percentage || 0) > 0).sort((a, b) => b.percentage - a.percentage);
  const totalStaff = zones.reduce((s, z) => s + (z.staffCapacity || 0), 0);
  const staff = parseInt(staffCount || "0") || totalStaff;
  const sqmNum = parseFloat(sqm || "0");

  const meetingCount = zones.filter(z => {
    const n = z.zone.toLowerCase();
    return (n.includes("meeting") || n.includes("conference")) && !n.includes("boardroom");
  }).length;

  const boardroomCount = zones.filter(z => z.zone.toLowerCase().includes("boardroom")).length;

  const breakoutCount = zones.filter(z => {
    const n = z.zone.toLowerCase();
    return n.includes("breakout") || n.includes("lounge") || n.includes("collaborative");
  }).length;

  const workstationCapacity = zones.filter(z => {
    const n = z.zone.toLowerCase();
    return n.includes("workstation") || n.includes("open plan") || n.includes("desk") || n.includes("hot desk");
  }).reduce((s, z) => s + (z.staffCapacity || 0), 0);

  const collaborationPct = zones.filter(z => {
    const n = z.zone.toLowerCase();
    return n.includes("meeting") || n.includes("boardroom") || n.includes("breakout") || n.includes("lounge");
  }).reduce((s, z) => s + (z.percentage || 0), 0);

  const workstationPct = zones.filter(z => {
    const n = z.zone.toLowerCase();
    return n.includes("workstation") || n.includes("open") || n.includes("desk");
  }).reduce((s, z) => s + (z.percentage || 0), 0);

  const efficiencyScore = sqmNum && staff
    ? Math.min(100, Math.round((staff * 8 / sqmNum) * 100))
    : null;

  const layoutItems = buildTreemap(
    validZones,
    MARGIN, MARGIN, SVG_W - MARGIN * 2, SVG_H - MARGIN * 2, true
  );

  function exportPNG() {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = SVG_W * 2;
    canvas.height = SVG_H * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = "workspace-layout.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  }

  function exportPDF() {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>AI Workspace Layout — The Corporate Desk</title>
      <meta charset="utf-8"/>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#0e1117;color:#fff;font-family:sans-serif;padding:40px}
        h1{font-size:22pt;color:#C9A84C;margin-bottom:6px}
        .sub{color:rgba(255,255,255,0.5);font-size:10pt;margin-bottom:6px}
        .meta{color:rgba(255,255,255,0.35);font-size:9pt;margin-bottom:28px}
        svg{width:100%;max-width:720px;display:block;border-radius:8px}
        .legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}
        .legend-item{display:flex;align-items:center;gap:6px;font-size:9pt;color:rgba(255,255,255,0.6)}
        .legend-dot{width:10px;height:10px;border-radius:2px;flex-shrink:0}
        .footer{margin-top:32px;font-size:8pt;color:rgba(255,255,255,0.25);border-top:1px solid rgba(255,255,255,0.06);padding-top:12px}
        @media print{body{padding:20px}svg{page-break-inside:avoid}}
      </style></head><body>
      <h1>AI Workspace Layout</h1>
      <div class="sub">The Corporate Desk · thecorporatedesk.com.au</div>
      <div class="meta">1300 977 607 · service@thecorporatedesk.com.au · 10 Primrose St Bowen Hills QLD 4006${sqm ? ` · ${sqm} sqm` : ""}${staff ? ` · ${staff} staff` : ""}</div>
      ${svgStr}
      <div class="legend">
        ${validZones.map(z => `<div class="legend-item"><div class="legend-dot" style="background:${z.color}"></div>${z.zone} (${z.percentage}%)${z.staffCapacity ? ` · ${z.staffCapacity} staff` : ""}</div>`).join("")}
      </div>
      <div class="footer">Generated by The Corporate Desk AI Office Planner. This is a preliminary layout concept — subject to revision during full design consultation.</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 700);
  }

  if (!validZones.length) {
    return (
      <div className="flex items-center justify-center h-40 text-white/30 text-sm rounded-xl border border-[rgba(255,255,255,0.06)]">
        No zone data available. Regenerate the AI plan to enable visual layout.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-[hsl(220,20%,6%)] rounded-2xl border border-[rgba(201,168,76,0.18)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)] flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <p className="text-white font-semibold text-sm">AI Workspace Layout</p>
            <p className="text-white/40 text-xs mt-0.5">
              Proportional zone plan{sqm ? ` · ${sqm} sqm` : ""}{staff ? ` · ${staff} staff` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={exportPNG}
              className="bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.3)] hover:bg-[rgba(201,168,76,0.25)] min-h-[34px] text-xs"
              data-testid="button-export-png">
              <Download className="w-3.5 h-3.5 mr-1.5" /> PNG
            </Button>
            <Button size="sm" onClick={exportPDF}
              className="bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.3)] hover:bg-[rgba(201,168,76,0.25)] min-h-[34px] text-xs"
              data-testid="button-export-pdf">
              <FileText className="w-3.5 h-3.5 mr-1.5" /> PDF
            </Button>
          </div>
        </div>

        <div className="p-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full rounded-xl"
            style={{ display: "block" }}
          >
            <rect width={SVG_W} height={SVG_H} fill="hsl(220,20%,7%)" rx="10" />
            <defs>
              <pattern id="spe-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={SVG_W} height={SVG_H} fill="url(#spe-grid)" rx="10" />

            {layoutItems.map(({ zone, x, y, w, h }, i) => {
              const color = zone.color || "#B8960C";
              const maxLabelChars = Math.max(4, Math.floor((w - 16) / 7.5));
              const labelText = truncate(zone.zone, maxLabelChars);
              const labelW = Math.min(w - 12, labelText.length * 7.2 + 16);
              return (
                <g key={i}>
                  <rect x={x} y={y} width={w} height={h} rx="7"
                    fill={`${color}10`} stroke={color} strokeWidth="1.5" />
                  <ZoneFurniture zone={zone} x={x} y={y} w={w} h={h} />
                  <rect x={x + 6} y={y + 6} width={labelW} height={19} rx="4" fill={color} opacity={0.9} />
                  <text x={x + 14} y={y + 19}
                    fontSize="10" fontWeight="700" fontFamily="Inter,sans-serif"
                    fill={isBright(color) ? "#1a1a2e" : "white"}>
                    {labelText}
                  </text>
                  {zone.percentage >= 8 && w > 80 && (
                    <text x={x + w - 8} y={y + 20} fontSize="9" fontFamily="Inter,sans-serif"
                      fill={color} textAnchor="end" opacity={0.85}>
                      {zone.percentage}%
                    </text>
                  )}
                  {zone.staffCapacity != null && h > 65 && w > 70 && (
                    <text x={x + w - 8} y={y + h - 8} fontSize="9" fontFamily="Inter,sans-serif"
                      fill="rgba(255,255,255,0.35)" textAnchor="end">
                      {zone.staffCapacity} staff
                    </text>
                  )}
                </g>
              );
            })}

            {/* Circulation paths overlay */}
            {layoutItems.length >= 2 && (() => {
              const cx = SVG_W / 2;
              const cy = SVG_H / 2;
              const pathColor = "rgba(255,255,255,0.18)";
              const arrowSize = 5;
              return (
                <g>
                  <line x1={MARGIN} y1={cy} x2={SVG_W - MARGIN} y2={cy}
                    stroke={pathColor} strokeWidth="1.5" strokeDasharray="8,5" />
                  <line x1={cx} y1={MARGIN} x2={cx} y2={SVG_H - MARGIN}
                    stroke={pathColor} strokeWidth="1" strokeDasharray="6,5" />
                  {[cx - 60, cx + 60].map((ax, i) => (
                    <polygon key={i}
                      points={`${ax},${cy - arrowSize} ${ax + (i === 0 ? -arrowSize * 1.4 : arrowSize * 1.4)},${cy} ${ax},${cy + arrowSize}`}
                      fill={pathColor} />
                  ))}
                  <rect x={cx - 30} y={cy - 10} width={60} height={16} rx="3" fill="rgba(0,0,0,0.55)" />
                  <text x={cx} y={cy + 2.5} textAnchor="middle" fontSize="8" fontWeight="600"
                    fontFamily="Inter,sans-serif" fill="rgba(255,255,255,0.45)" letterSpacing="0.5">
                    CIRCULATION
                  </text>
                </g>
              );
            })()}

            {/* Watermark overlay for unpaid previews */}
            {isPreview && (() => {
              const wRows = 5;
              const wCols = 3;
              const tileW = SVG_W / wCols;
              const tileH = SVG_H / wRows;
              return (
                <g style={{ pointerEvents: "none", userSelect: "none" } as any}>
                  {Array.from({ length: wRows }).map((_, row) =>
                    Array.from({ length: wCols }).map((_, col) => {
                      const cx = tileW * col + tileW * 0.5;
                      const cy = tileH * row + tileH * 0.5;
                      return (
                        <g key={`wm-${row}-${col}`} transform={`rotate(-34, ${cx}, ${cy})`}>
                          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fontWeight="700"
                            fontFamily="Inter,sans-serif" fill="rgba(255,255,255,0.13)" letterSpacing="0.5">
                            THE CORPORATE DESK
                          </text>
                          <text x={cx} y={cy + 9} textAnchor="middle" fontSize="9" fontWeight="600"
                            fontFamily="Inter,sans-serif" fill="rgba(255,255,255,0.09)" letterSpacing="0.8">
                            PREVIEW ONLY — NOT FOR PROCUREMENT
                          </text>
                          {companyName && (
                            <text x={cx} y={cy + 21} textAnchor="middle" fontSize="8"
                              fontFamily="Inter,sans-serif" fill="rgba(201,168,76,0.14)" letterSpacing="0.3">
                              {companyName.toUpperCase()}
                            </text>
                          )}
                        </g>
                      );
                    })
                  )}
                  {generatedDate && (
                    <text x={SVG_W - MARGIN - 4} y={SVG_H - MARGIN - 18} textAnchor="end"
                      fontSize="8" fontFamily="Inter,sans-serif" fill="rgba(255,255,255,0.2)">
                      Generated {generatedDate} · thecorporatedesk.com.au
                    </text>
                  )}
                </g>
              );
            })()}

            <g transform={`translate(${SVG_W - 32},32)`}>
              <circle cx="0" cy="0" r="16" fill="rgba(0,0,0,0.5)" stroke="rgba(201,168,76,0.35)" strokeWidth="1" />
              <text x="0" y="5" textAnchor="middle" fontSize="12" fontWeight="700"
                fontFamily="Inter,sans-serif" fill="#C9A84C">N</text>
            </g>

            {sqm && (
              <g transform={`translate(${MARGIN + 6},${SVG_H - MARGIN - 10})`}>
                <rect width="64" height="4" rx="2" fill="rgba(201,168,76,0.35)" />
                <text x="0" y="-5" fontSize="8" fontFamily="Inter,sans-serif" fill="rgba(255,255,255,0.35)">
                  {sqm} sqm total
                </text>
              </g>
            )}

            <text x={SVG_W / 2} y={SVG_H - 6} textAnchor="middle" fontSize="8"
              fontFamily="Inter,sans-serif" fill="rgba(255,255,255,0.15)">
              THE CORPORATE DESK · AI WORKSPACE LAYOUT · thecorporatedesk.com.au
            </text>
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {validZones.map((z, i) => (
          <div key={i}
            className="flex items-center gap-2 bg-[rgba(255,255,255,0.03)] rounded-lg p-2.5 border border-[rgba(255,255,255,0.05)]"
            data-testid={`legend-zone-${i}`}>
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: z.color }} />
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{z.zone}</p>
              <p className="text-white/35 text-xs">{z.percentage}%{z.staffCapacity ? ` · ${z.staffCapacity} pax` : ""}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
        <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Workspace Summary
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div data-testid="summary-total-staff">
            <p className="text-white font-bold text-xl">{staff || "—"}</p>
            <p className="text-white/40 text-xs mt-0.5">Total Capacity</p>
          </div>
          <div data-testid="summary-workstations">
            <p className="text-white font-bold text-xl">{workstationCapacity || "—"}</p>
            <p className="text-white/40 text-xs mt-0.5">Workstations</p>
          </div>
          <div data-testid="summary-meeting-rooms">
            <p className="text-white font-bold text-xl">{meetingCount || "—"}</p>
            <p className="text-white/40 text-xs mt-0.5">Meeting Rooms</p>
          </div>
          <div data-testid="summary-boardrooms">
            <p className="text-white font-bold text-xl">{boardroomCount || "—"}</p>
            <p className="text-white/40 text-xs mt-0.5">Boardroom{boardroomCount !== 1 ? "s" : ""}</p>
          </div>
          <div data-testid="summary-breakout-zones">
            <p className="text-white font-bold text-xl">{breakoutCount || "—"}</p>
            <p className="text-white/40 text-xs mt-0.5">Breakout Zones</p>
          </div>
          <div data-testid="summary-sqm-per-staff">
            <p className="text-white font-bold text-xl">
              {sqmNum && staff ? `${(sqmNum / staff).toFixed(1)}m²` : "—"}
            </p>
            <p className="text-white/40 text-xs mt-0.5">Per Person</p>
          </div>
        </div>

        {(workstationPct > 0 || collaborationPct > 0 || efficiencyScore !== null) && (
          <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/40 text-xs">Layout Efficiency</p>
              {efficiencyScore !== null && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  efficiencyScore >= 80 ? "bg-green-500/15 text-green-400" :
                  efficiencyScore >= 55 ? "bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)]" :
                  "bg-white/5 text-white/40"
                }`}>
                  {efficiencyScore >= 80 ? "High Density" : efficiencyScore >= 55 ? "Balanced" : "Spacious"} · {efficiencyScore}%
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              {workstationPct > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[hsl(43,78%,52%)]" />
                  <span className="text-white/55">Workstations: {workstationPct}%</span>
                </div>
              )}
              {collaborationPct > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-white/55">Collaboration: {collaborationPct}%</span>
                </div>
              )}
              {sqmNum && staff ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-white/55">Density: {(sqmNum / staff).toFixed(1)} m² per person</span>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {recs.length > 0 && (
        <div className="bg-[hsl(220,18%,10%)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5">
          <p className="text-[hsl(43,78%,65%)] text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Product Placement by Zone
          </p>
          <div className="space-y-3">
            {validZones.map(zone => {
              const zoneRecs = recs.filter(r => r.zone === zone.zone);
              if (!zoneRecs.length) return null;
              return (
                <div key={zone.zone} className="rounded-xl p-3.5 border"
                  style={{ borderColor: `${zone.color}35`, background: `${zone.color}08` }}>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: zone.color }} />
                      <span className="text-white font-semibold text-xs">{zone.zone}</span>
                      <span className="text-white/30 text-xs">{zone.percentage}% of floor</span>
                    </div>
                    {zone.staffCapacity ? (
                      <span className="text-white/40 text-xs">{zone.staffCapacity} pax</span>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {zoneRecs.map((rec, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/75 text-xs font-medium">{rec.category}</span>
                            {rec.seriesRecommendation && (
                              <span className="text-[hsl(43,78%,52%)] text-xs">· {rec.seriesRecommendation}</span>
                            )}
                          </div>
                          <span className="font-mono text-white/35 text-[10px]">{rec.sku}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-white/55 text-xs">×{rec.quantity}</p>
                          {rec.totalCost > 0 && (
                            <p className="text-[hsl(43,78%,52%)] text-xs font-medium">
                              ${rec.totalCost.toLocaleString("en-AU")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Link href="/send-us-your-quote">
          <Button
            className="w-full sm:w-auto bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px] px-8"
            data-testid="button-layout-quote">
            Request Full Quote <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
        <Link href="/workplace-strategy">
          <Button variant="outline"
            className="w-full sm:w-auto border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] min-h-[48px]"
            data-testid="button-layout-strategy">
            Book Strategy Call
          </Button>
        </Link>
        <Link href="/contact">
          <Button variant="ghost"
            className="w-full sm:w-auto text-white/50 hover:text-white min-h-[48px]"
            data-testid="button-layout-contact">
            Speak to a Specialist
          </Button>
        </Link>
      </div>
    </div>
  );
}
