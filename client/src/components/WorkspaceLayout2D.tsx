/**
 * WorkspaceLayout2D — Premium SVG 2D Office Layout Renderer
 * Converts AI workspace zones into an architectural floor plan visual.
 * Supports blurred preview (pre-payment) and full layout (post-payment) modes.
 */
import { useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, Lock, Maximize2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkspaceZone {
  zone: string;
  color: string;
  percentage: number;
  description: string;
  priority: string;
  staffCapacity?: number;
  keyFurniture?: string[];
}

interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
  zone: WorkspaceZone;
  type: ZoneType;
  normPct: number;
}

type ZoneType =
  | "openplan"
  | "meeting"
  | "executive"
  | "reception"
  | "breakout"
  | "boardroom"
  | "focus"
  | "storage"
  | "other";

interface Props {
  zones: WorkspaceZone[];
  squareMetres?: string;
  staffCount?: string;
  officeType?: string;
  isPaid?: boolean;
  onUnlockClick?: () => void;
  unlocking?: boolean;
}

// ─── SVG canvas dimensions ────────────────────────────────────────────────────
const SVG_W = 900;
const SVG_H = 660;
const TITLE_H = 48;
const FOOTER_H = 36;
const MARGIN_L = 56;
const MARGIN_R = 36;
const MARGIN_TOP = TITLE_H + 12;
const MARGIN_BOT = FOOTER_H + 10;
const PLATE_X = MARGIN_L;
const PLATE_Y = MARGIN_TOP;
const PLATE_W = SVG_W - MARGIN_L - MARGIN_R;
const PLATE_H = SVG_H - MARGIN_TOP - MARGIN_BOT;
const WALL = 2.5;

// ─── Zone type detection ──────────────────────────────────────────────────────
function detectZoneType(name: string): ZoneType {
  const n = name.toLowerCase();
  if (n.includes("board")) return "boardroom";
  if (n.includes("executive") || n.includes("partner") || n.includes("director") || n.includes("principal") || n.includes("manager")) return "executive";
  if (n.includes("meeting") || n.includes("conference") || n.includes("interview")) return "meeting";
  if (n.includes("reception") || n.includes("arrival") || n.includes("lobby") || n.includes("entrance")) return "reception";
  if (n.includes("breakout") || n.includes("social") || n.includes("lounge") || n.includes("kitchen") || n.includes("casual")) return "breakout";
  if (n.includes("focus") || n.includes("phone") || n.includes("pod") || n.includes("quiet") || n.includes("booth")) return "focus";
  if (n.includes("storage") || n.includes("print") || n.includes("filing") || n.includes("utility") || n.includes("server")) return "storage";
  if (n.includes("open") || n.includes("workstation") || n.includes("desk") || n.includes("staff") || n.includes("hotdesk") || n.includes("work")) return "openplan";
  return "other";
}

// ─── Layout partition ─────────────────────────────────────────────────────────
function partitionZones(zones: WorkspaceZone[]): LayoutRect[] {
  const valid = zones.filter((z) => z.percentage > 0);
  if (!valid.length) return [];

  const total = valid.reduce((s, z) => s + z.percentage, 0);
  const norm = valid.map((z) => ({ ...z, normPct: z.percentage / total }));
  const sorted = [...norm].sort((a, b) => b.normPct - a.normPct);

  // Group into rows where each row totals ~0.30–0.40
  const rows: Array<Array<typeof sorted[0]>> = [];
  let row: typeof sorted = [];
  let rowSum = 0;
  for (const z of sorted) {
    row.push(z);
    rowSum += z.normPct;
    if (rowSum >= 0.28 || row.length >= 3) {
      rows.push(row);
      row = [];
      rowSum = 0;
    }
  }
  if (row.length) rows.push(row);

  const rects: LayoutRect[] = [];
  let y = PLATE_Y;

  for (const r of rows) {
    const rowTotal = r.reduce((s, z) => s + z.normPct, 0);
    const rowH = PLATE_H * rowTotal;
    let x = PLATE_X;
    for (const z of r) {
      const zoneW = PLATE_W * (z.normPct / rowTotal);
      rects.push({
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(zoneW),
        h: Math.round(rowH),
        zone: z,
        type: detectZoneType(z.zone),
        normPct: z.normPct,
      });
      x += zoneW;
    }
    y += rowH;
  }
  return rects;
}

// ─── Color helpers ────────────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function safeColor(color: string): string {
  if (!color) return "#B8960C";
  if (color.startsWith("#") && color.length === 7) return color;
  return "#B8960C";
}

// ─── Furniture renderers ──────────────────────────────────────────────────────

function OpenPlanFurniture({ x, y, w, h, capacity }: { x: number; y: number; w: number; h: number; capacity: number }) {
  const desks = Math.max(2, Math.min(capacity || 8, 16));
  const cols = Math.max(2, Math.min(5, Math.floor(w / 55)));
  const rows = Math.ceil(desks / cols);
  const deskW = 26, deskH = 14, chairR = 4;
  const gapX = (w - cols * deskW - 16) / Math.max(1, cols - 1);
  const gapY = (h - rows * (deskH + chairR * 2 + 4) - 16) / Math.max(1, rows - 1);
  const startX = x + 8;
  const startY = y + 12;
  const units: JSX.Element[] = [];
  let count = 0;
  for (let r = 0; r < rows && count < desks; r++) {
    for (let c = 0; c < cols && count < desks; c++) {
      const dx = startX + c * (deskW + (cols > 1 ? gapX : 0));
      const dy = startY + r * (deskH + chairR * 2 + 4 + (rows > 1 ? gapY : 0));
      units.push(
        <g key={`d-${r}-${c}`}>
          <rect x={dx} y={dy} width={deskW} height={deskH} rx="1" fill="rgba(255,255,255,0.9)" stroke="#94a3b8" strokeWidth="0.8" />
          <circle cx={dx + deskW / 2} cy={dy + deskH + chairR + 2} r={chairR} fill="rgba(255,255,255,0.7)" stroke="#94a3b8" strokeWidth="0.8" />
        </g>
      );
      count++;
    }
  }
  return <g>{units}</g>;
}

function MeetingFurniture({ x, y, w, h, seats }: { x: number; y: number; w: number; h: number; seats: number }) {
  const numChairs = Math.max(4, Math.min(seats || 8, 12));
  const cx = x + w / 2, cy = y + h / 2;
  const tw = Math.min(w * 0.55, 80), th = Math.min(h * 0.38, 28);
  const chairR = 4;
  const radX = tw / 2 + chairR + 4, radY = th / 2 + chairR + 4;
  const chairs: JSX.Element[] = [];
  for (let i = 0; i < numChairs; i++) {
    const angle = (i / numChairs) * Math.PI * 2 - Math.PI / 2;
    const cx2 = cx + Math.cos(angle) * radX;
    const cy2 = cy + Math.sin(angle) * radY;
    chairs.push(<circle key={i} cx={cx2} cy={cy2} r={chairR} fill="rgba(255,255,255,0.75)" stroke="#94a3b8" strokeWidth="0.8" />);
  }
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={tw / 2} ry={th / 2} fill="rgba(255,255,255,0.9)" stroke="#94a3b8" strokeWidth="1" />
      {chairs}
    </g>
  );
}

function BoardroomFurniture({ x, y, w, h, seats }: { x: number; y: number; w: number; h: number; seats: number }) {
  const numChairs = Math.max(8, Math.min(seats || 12, 16));
  const cx = x + w / 2, cy = y + h / 2;
  const tw = Math.min(w * 0.65, 110), th = Math.min(h * 0.42, 30);
  const chairR = 4;
  const perSide = Math.floor(numChairs / 2);
  const chairs: JSX.Element[] = [];
  for (let i = 0; i < perSide; i++) {
    const tx = x + (w - tw) / 2 + (tw / (perSide + 1)) * (i + 1);
    chairs.push(
      <circle key={`t${i}`} cx={tx} cy={cy - th / 2 - chairR - 3} r={chairR} fill="rgba(255,255,255,0.75)" stroke="#94a3b8" strokeWidth="0.8" />,
      <circle key={`b${i}`} cx={tx} cy={cy + th / 2 + chairR + 3} r={chairR} fill="rgba(255,255,255,0.75)" stroke="#94a3b8" strokeWidth="0.8" />
    );
  }
  return (
    <g>
      <rect x={cx - tw / 2} y={cy - th / 2} width={tw} height={th} rx="2" fill="rgba(255,255,255,0.9)" stroke="#94a3b8" strokeWidth="1" />
      {chairs}
    </g>
  );
}

function ExecutiveFurniture({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const dw = Math.min(w * 0.55, 60), dh = Math.min(h * 0.28, 20);
  const rw = Math.min(w * 0.22, 22), rh = Math.min(h * 0.35, 30);
  const dx = x + (w - dw) / 2 - 5, dy = y + h * 0.2;
  return (
    <g>
      <rect x={dx} y={dy} width={dw} height={dh} rx="1.5" fill="rgba(255,255,255,0.9)" stroke="#94a3b8" strokeWidth="1" />
      <rect x={dx + dw - 1} y={dy} width={rw} height={rh} rx="1.5" fill="rgba(255,255,255,0.85)" stroke="#94a3b8" strokeWidth="0.8" />
      <circle cx={dx + dw / 2} cy={dy + dh + 7} r={5} fill="rgba(255,255,255,0.75)" stroke="#94a3b8" strokeWidth="0.8" />
      <rect x={dx + 6} y={dy + dh + 18} width={18} height={10} rx="1" fill="rgba(255,255,255,0.6)" stroke="#94a3b8" strokeWidth="0.6" />
      <rect x={dx + 26} y={dy + dh + 18} width={18} height={10} rx="1" fill="rgba(255,255,255,0.6)" stroke="#94a3b8" strokeWidth="0.6" />
    </g>
  );
}

function ReceptionFurniture({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cw = Math.min(w * 0.55, 70), ch = Math.min(h * 0.3, 22);
  const cx2 = x + (w - cw) / 2, cy2 = y + h * 0.15;
  return (
    <g>
      <rect x={cx2} y={cy2} width={cw} height={ch} rx="3" fill="rgba(255,255,255,0.9)" stroke="#94a3b8" strokeWidth="1.2" />
      <rect x={cx2 - 6} y={cy2 + ch * 0.2} width={8} height={ch * 0.6} rx="1" fill="rgba(255,255,255,0.8)" stroke="#94a3b8" strokeWidth="0.8" />
      <circle cx={x + w * 0.25} cy={cy2 + ch + 14} r={6} fill="rgba(255,255,255,0.65)" stroke="#94a3b8" strokeWidth="0.8" />
      <circle cx={x + w * 0.38} cy={cy2 + ch + 14} r={6} fill="rgba(255,255,255,0.65)" stroke="#94a3b8" strokeWidth="0.8" />
      <rect x={x + w * 0.23} y={cy2 + ch + 22} width={22} height={8} rx="2" fill="rgba(255,255,255,0.6)" stroke="#94a3b8" strokeWidth="0.6" />
    </g>
  );
}

function BreakoutFurniture({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const groups: JSX.Element[] = [];
  const cx1 = x + w * 0.28, cy1 = y + h * 0.38;
  const cx2 = x + w * 0.68, cy2 = y + h * 0.58;
  groups.push(
    <circle key="t1" cx={cx1} cy={cy1} r={9} fill="rgba(255,255,255,0.7)" stroke="#94a3b8" strokeWidth="0.8" />,
    <circle key="c1a" cx={cx1 - 14} cy={cy1} r={5} fill="rgba(255,255,255,0.6)" stroke="#94a3b8" strokeWidth="0.7" />,
    <circle key="c1b" cx={cx1 + 14} cy={cy1} r={5} fill="rgba(255,255,255,0.6)" stroke="#94a3b8" strokeWidth="0.7" />,
    <circle key="c1c" cx={cx1} cy={cy1 - 14} r={5} fill="rgba(255,255,255,0.6)" stroke="#94a3b8" strokeWidth="0.7" />,
    <circle key="t2" cx={cx2} cy={cy2} r={7} fill="rgba(255,255,255,0.7)" stroke="#94a3b8" strokeWidth="0.8" />,
    <circle key="c2a" cx={cx2 - 11} cy={cy2} r={4.5} fill="rgba(255,255,255,0.6)" stroke="#94a3b8" strokeWidth="0.7" />,
    <circle key="c2b" cx={cx2 + 11} cy={cy2} r={4.5} fill="rgba(255,255,255,0.6)" stroke="#94a3b8" strokeWidth="0.7" />,
  );
  return <g>{groups}</g>;
}

function FocusFurniture({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const pw = Math.min(w * 0.32, 36), ph = Math.min(h * 0.48, 40);
  const pods: JSX.Element[] = [];
  const count = Math.min(3, Math.floor(w / (pw + 16)));
  const gap = (w - count * pw) / (count + 1);
  for (let i = 0; i < count; i++) {
    const px = x + gap + i * (pw + gap);
    const py = y + (h - ph) / 2;
    pods.push(
      <rect key={i} x={px} y={py} width={pw} height={ph} rx="4" fill="rgba(255,255,255,0.85)" stroke="#94a3b8" strokeWidth="0.8" />,
      <rect key={`d${i}`} x={px + 4} y={py + 6} width={pw - 8} height={10} rx="1" fill="rgba(200,210,220,0.6)" stroke="#94a3b8" strokeWidth="0.5" />,
      <circle key={`c${i}`} cx={px + pw / 2} cy={py + ph - 10} r={4} fill="rgba(200,210,220,0.6)" stroke="#94a3b8" strokeWidth="0.5" />
    );
  }
  return <g>{pods}</g>;
}

function StorageFurniture({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const count = Math.min(6, Math.floor(w / 20));
  const cw = Math.min((w - 10) / count - 3, 18), ch = Math.min(h * 0.6, 35);
  const items: JSX.Element[] = [];
  for (let i = 0; i < count; i++) {
    const cx2 = x + 5 + i * (cw + 3);
    const cy2 = y + (h - ch) / 2;
    items.push(
      <rect key={i} x={cx2} y={cy2} width={cw} height={ch} rx="1" fill="rgba(255,255,255,0.75)" stroke="#94a3b8" strokeWidth="0.7" />,
      <line key={`l${i}`} x1={cx2} y1={cy2 + ch / 2} x2={cx2 + cw} y2={cy2 + ch / 2} stroke="#94a3b8" strokeWidth="0.5" />
    );
  }
  return <g>{items}</g>;
}

// ─── Zone room renderer ───────────────────────────────────────────────────────
function ZoneRoom({ rect, index }: { rect: LayoutRect; index: number }) {
  const { x, y, w, h, zone, type } = rect;
  const color = safeColor(zone.color);
  const fillColor = hexToRgba(color, 0.10);
  const strokeColor = hexToRgba(color, 0.75);
  const labelColor = color;
  const seats = zone.staffCapacity || 0;

  // Door: small arc at one edge
  const doorW = Math.min(20, w * 0.12);
  const doorX = x + 2;
  const doorY = y + h - doorW;

  // Truncate long zone names
  const label = zone.zone.length > 22 ? zone.zone.slice(0, 21) + "…" : zone.zone;

  return (
    <g>
      {/* Room fill */}
      <rect x={x} y={y} width={w} height={h} fill={fillColor} stroke={strokeColor} strokeWidth={WALL} />

      {/* Door opening */}
      {w > 60 && h > 60 && (
        <g>
          <line x1={doorX} y1={doorY} x2={doorX + doorW} y2={doorY} stroke="#fff" strokeWidth="2.5" />
          <path d={`M${doorX},${doorY} A${doorW},${doorW} 0 0,1 ${doorX},${doorY + doorW}`} fill="none" stroke={strokeColor} strokeWidth="1" strokeDasharray="2,1.5" />
        </g>
      )}

      {/* Zone label header strip */}
      <rect x={x + WALL} y={y + WALL} width={w - WALL * 2} height={18} fill={hexToRgba(color, 0.25)} rx="0" />
      <text x={x + 8} y={y + 14} fontFamily="Georgia, 'Times New Roman', serif" fontSize="8.5" fontWeight="bold" fill={labelColor} letterSpacing="0.5">
        {label.toUpperCase()}
      </text>
      {zone.percentage > 0 && (
        <text x={x + w - 8} y={y + 14} fontFamily="Arial, sans-serif" fontSize="7.5" fill={hexToRgba(color, 0.8)} textAnchor="end">
          {zone.percentage}%
        </text>
      )}

      {/* Priority tag */}
      {zone.priority && w > 80 && h > 55 && (
        <text x={x + 8} y={y + 28} fontFamily="Arial, sans-serif" fontSize="6.5" fill={hexToRgba(color, 0.6)} letterSpacing="0.3">
          {zone.priority.toUpperCase()}
        </text>
      )}

      {/* Furniture symbols */}
      {type === "openplan" && w > 60 && h > 50 && (
        <OpenPlanFurniture x={x + 6} y={y + 32} w={w - 12} h={h - 38} capacity={seats} />
      )}
      {type === "meeting" && w > 50 && h > 50 && (
        <MeetingFurniture x={x + 6} y={y + 30} w={w - 12} h={h - 36} seats={seats || 8} />
      )}
      {type === "boardroom" && w > 80 && h > 55 && (
        <BoardroomFurniture x={x + 6} y={y + 30} w={w - 12} h={h - 36} seats={seats || 12} />
      )}
      {type === "executive" && w > 70 && h > 55 && (
        <ExecutiveFurniture x={x + 6} y={y + 28} w={w - 12} h={h - 34} />
      )}
      {type === "reception" && w > 60 && h > 50 && (
        <ReceptionFurniture x={x + 6} y={y + 28} w={w - 12} h={h - 34} />
      )}
      {type === "breakout" && w > 60 && h > 55 && (
        <BreakoutFurniture x={x + 6} y={y + 28} w={w - 12} h={h - 34} />
      )}
      {type === "focus" && w > 60 && h > 50 && (
        <FocusFurniture x={x + 6} y={y + 28} w={w - 12} h={h - 34} />
      )}
      {type === "storage" && w > 50 && h > 40 && (
        <StorageFurniture x={x + 6} y={y + 28} w={w - 12} h={h - 34} />
      )}
    </g>
  );
}

// ─── Circulation path overlay ─────────────────────────────────────────────────
function CirculationPaths({ rects }: { rects: LayoutRect[] }) {
  if (rects.length < 2) return null;
  const paths: JSX.Element[] = [];
  const mainY = PLATE_Y + PLATE_H * 0.5;
  paths.push(
    <line
      key="main-h"
      x1={PLATE_X + 4} y1={mainY} x2={PLATE_X + PLATE_W - 4} y2={mainY}
      stroke="rgba(180,160,100,0.18)" strokeWidth="6" strokeDasharray="6,6"
    />
  );
  const mainX = PLATE_X + PLATE_W * 0.5;
  paths.push(
    <line
      key="main-v"
      x1={mainX} y1={PLATE_Y + 4} x2={mainX} y2={PLATE_Y + PLATE_H - 4}
      stroke="rgba(180,160,100,0.12)" strokeWidth="4" strokeDasharray="5,8"
    />
  );
  return <g>{paths}</g>;
}

// ─── North arrow ──────────────────────────────────────────────────────────────
function NorthArrow() {
  const ax = SVG_W - 44, ay = PLATE_Y + 12;
  return (
    <g>
      <polygon points={`${ax},${ay + 18} ${ax - 6},${ay + 6} ${ax},${ay} ${ax + 6},${ay + 6}`} fill="rgba(184,150,12,0.9)" />
      <text x={ax} y={ay + 28} fontFamily="Arial, sans-serif" fontSize="7" fontWeight="bold" fill="rgba(184,150,12,0.8)" textAnchor="middle">N</text>
    </g>
  );
}

// ─── Scale bar ────────────────────────────────────────────────────────────────
function ScaleBar({ sqm }: { sqm?: string }) {
  const sx = PLATE_X + 8, sy = PLATE_Y + PLATE_H - 14;
  const sqmVal = sqm ? parseInt(sqm, 10) : null;
  return (
    <g>
      <line x1={sx} y1={sy} x2={sx + 60} y2={sy} stroke="rgba(180,160,100,0.5)" strokeWidth="1.5" />
      <line x1={sx} y1={sy - 4} x2={sx} y2={sy + 4} stroke="rgba(180,160,100,0.5)" strokeWidth="1.5" />
      <line x1={sx + 60} y1={sy - 4} x2={sx + 60} y2={sy + 4} stroke="rgba(180,160,100,0.5)" strokeWidth="1.5" />
      <text x={sx + 30} y={sy - 5} fontFamily="Arial, sans-serif" fontSize="6.5" fill="rgba(180,160,100,0.6)" textAnchor="middle">
        {sqmVal ? `≈${sqmVal}m²` : "Not to scale"}
      </text>
    </g>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend({ rects }: { rects: LayoutRect[] }) {
  const lx = PLATE_X + PLATE_W - 130;
  const ly = PLATE_Y + PLATE_H - Math.min(rects.length, 6) * 13 - 8;
  return (
    <g>
      {rects.slice(0, 6).map((r, i) => {
        const color = safeColor(r.zone.color);
        const shortName = r.zone.zone.length > 16 ? r.zone.zone.slice(0, 15) + "…" : r.zone.zone;
        return (
          <g key={i}>
            <rect x={lx} y={ly + i * 13} width={9} height={9} fill={hexToRgba(color, 0.7)} stroke={color} strokeWidth="0.7" />
            <text x={lx + 13} y={ly + i * 13 + 8} fontFamily="Arial, sans-serif" fontSize="7" fill="rgba(255,255,255,0.55)">
              {shortName}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ─── Main SVG layout ──────────────────────────────────────────────────────────
function SVGLayout({ rects, zones, squareMetres, staffCount, officeType, svgRef }: {
  rects: LayoutRect[];
  zones: WorkspaceZone[];
  squareMetres?: string;
  staffCount?: string;
  officeType?: string;
  svgRef?: React.Ref<SVGSVGElement>;
}) {
  const staff = staffCount ? parseInt(staffCount, 10) : null;
  const sqm = squareMetres || null;
  const title = officeType ? officeType.toUpperCase() : "WORKSPACE LAYOUT CONCEPT";

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Background */}
      <rect width={SVG_W} height={SVG_H} fill="hsl(220,20%,8%)" />

      {/* Title block */}
      <rect x={0} y={0} width={SVG_W} height={TITLE_H} fill="hsl(220,20%,10%)" />
      <line x1={0} y1={TITLE_H} x2={SVG_W} y2={TITLE_H} stroke="rgba(184,150,12,0.4)" strokeWidth="1" />
      <text x={PLATE_X} y={16} fontFamily="Georgia, 'Times New Roman', serif" fontSize="9" fill="rgba(184,150,12,0.7)" letterSpacing="3" fontWeight="normal">
        THE CORPORATE DESK · WORKSPACE DESIGN STUDIO
      </text>
      <text x={PLATE_X} y={34} fontFamily="Georgia, 'Times New Roman', serif" fontSize="14" fontWeight="bold" fill="rgba(255,255,255,0.9)" letterSpacing="1.5">
        {title}
      </text>
      {(sqm || staff) && (
        <text x={SVG_W - MARGIN_R} y={24} fontFamily="Arial, sans-serif" fontSize="8" fill="rgba(255,255,255,0.35)" textAnchor="end">
          {sqm && `${sqm}m²`}{sqm && staff ? "  ·  " : ""}{staff && `${staff} staff`}
        </text>
      )}

      {/* Floor plate outline */}
      <rect
        x={PLATE_X - 2} y={PLATE_Y - 2}
        width={PLATE_W + 4} height={PLATE_H + 4}
        fill="none" stroke="rgba(184,150,12,0.3)" strokeWidth="1"
      />
      {/* Interior floor background */}
      <rect x={PLATE_X} y={PLATE_Y} width={PLATE_W} height={PLATE_H} fill="hsl(210,20%,96%)" />

      {/* Subtle grid */}
      {Array.from({ length: 20 }).map((_, i) => (
        <line key={`gh${i}`} x1={PLATE_X} y1={PLATE_Y + (PLATE_H / 20) * i} x2={PLATE_X + PLATE_W} y2={PLATE_Y + (PLATE_H / 20) * i} stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" />
      ))}
      {Array.from({ length: 28 }).map((_, i) => (
        <line key={`gv${i}`} x1={PLATE_X + (PLATE_W / 28) * i} y1={PLATE_Y} x2={PLATE_X + (PLATE_W / 28) * i} y2={PLATE_Y + PLATE_H} stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" />
      ))}

      {/* Circulation paths (behind rooms) */}
      <CirculationPaths rects={rects} />

      {/* Zone rooms */}
      {rects.map((r, i) => <ZoneRoom key={i} rect={r} index={i} />)}

      {/* Outer wall border */}
      <rect
        x={PLATE_X} y={PLATE_Y}
        width={PLATE_W} height={PLATE_H}
        fill="none" stroke="rgba(30,40,60,0.85)" strokeWidth={WALL + 0.5}
      />

      {/* Overlays */}
      <NorthArrow />
      <ScaleBar sqm={squareMetres} />
      <Legend rects={rects} />

      {/* Footer */}
      <rect x={0} y={SVG_H - FOOTER_H} width={SVG_W} height={FOOTER_H} fill="hsl(220,20%,9%)" />
      <line x1={0} y1={SVG_H - FOOTER_H} x2={SVG_W} y2={SVG_H - FOOTER_H} stroke="rgba(184,150,12,0.3)" strokeWidth="0.8" />
      <text x={PLATE_X} y={SVG_H - FOOTER_H + 14} fontFamily="Arial, sans-serif" fontSize="7" fill="rgba(255,255,255,0.3)">
        Workspace Layout Concept — The Corporate Desk · thecorporatedesk.com.au · 1300 977 607
      </text>
      <text x={PLATE_X} y={SVG_H - FOOTER_H + 25} fontFamily="Arial, sans-serif" fontSize="7" fill="rgba(255,255,255,0.2)">
        This is an AI-generated concept layout. Actual fit-out subject to site measure and detailed specification by a qualified workplace consultant.
      </text>
      <text x={SVG_W - MARGIN_R} y={SVG_H - FOOTER_H + 22} fontFamily="Arial, sans-serif" fontSize="8" fontWeight="bold" fill="rgba(184,150,12,0.4)" textAnchor="end">
        TCD
      </text>
    </svg>
  );
}

// ─── PNG Export ───────────────────────────────────────────────────────────────
function exportAsPNG(svgEl: SVGSVGElement | null, filename: string) {
  if (!svgEl) return;
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const scale = 2;
  const W = SVG_W * scale, H = SVG_H * scale;
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "hsl(220,20%,8%)";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png", 0.95);
    link.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ─── Main exported component ──────────────────────────────────────────────────
export default function WorkspaceLayout2D({
  zones,
  squareMetres,
  staffCount,
  officeType,
  isPaid = false,
  onUnlockClick,
  unlocking = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const rects = useMemo(() => {
    const valid = zones.filter((z) => z.percentage > 0);
    if (!valid.length) return [];
    return partitionZones(valid);
  }, [zones]);

  if (!rects.length) return null;

  const svgContent = (
    <SVGLayout
      rects={rects}
      zones={zones}
      squareMetres={squareMetres}
      staffCount={staffCount}
      officeType={officeType}
      svgRef={svgRef}
    />
  );

  if (!isPaid) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-[rgba(201,168,76,0.15)]">
        {/* Blurred preview */}
        <div className="filter blur-[6px] brightness-75 pointer-events-none select-none">
          {svgContent}
        </div>
        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgba(8,12,22,0.55)] backdrop-blur-[1px]">
          <div className="w-14 h-14 rounded-full bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.3)] flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-[hsl(43,78%,52%)]" />
          </div>
          <p className="text-white font-serif font-bold text-lg mb-1 text-center px-4">Your AI Workspace Layout is Ready</p>
          <p className="text-white/50 text-sm text-center mb-6 max-w-xs px-4">Unlock the full visual layout, furniture placement plan, and downloadable PDF/PNG export.</p>
          <Button
            onClick={onUnlockClick}
            disabled={unlocking}
            className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-bold min-h-[48px] px-8"
            data-testid="button-unlock-layout"
          >
            {unlocking ? "Redirecting to Checkout…" : "Unlock Full Layout — $399 AUD"}
          </Button>
          <p className="text-white/25 text-xs mt-3">Includes PDF export · 3D walkthrough · Full furniture plan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden border border-[rgba(201,168,76,0.2)]">
        {svgContent}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-white/30 text-xs flex items-center gap-1.5">
          <Maximize2 className="w-3 h-3" />
          AI-generated concept layout · Not to scale · Subject to site measure
        </p>
        <Button
          size="sm"
          onClick={() => exportAsPNG(svgRef.current, "tcd-workspace-layout.png")}
          className="bg-[rgba(201,168,76,0.15)] text-[hsl(43,78%,65%)] border border-[rgba(201,168,76,0.3)] hover:bg-[rgba(201,168,76,0.25)] min-h-[36px]"
          data-testid="button-export-png"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" /> Download PNG
        </Button>
      </div>
    </div>
  );
}
