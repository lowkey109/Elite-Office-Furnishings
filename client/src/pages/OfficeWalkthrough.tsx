import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lock, RotateCcw, ZoomIn, Move, Box, Users, Layers,
  ArrowRight, Building2, Package, ChevronRight, X,
  Eye, Sparkles, Phone, Mail, MousePointer2, Upload,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceZone {
  zone: string;
  color: string;
  percentage: number;
  staffCapacity?: number;
  description?: string;
  priority?: string;
  keyFurniture?: string[];
}

interface ProductRec {
  zone: string;
  sku: string;
  category: string;
  productName: string;
  seriesRecommendation: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface FloorGeometryMeta {
  boundary: { x: number; y: number }[];
  aspectRatio: number;
  confidence: number;
  source: string;
  detectedShape?: string | null;
  fallback: boolean;
  internalWalls?: unknown[];
}

interface LayoutData {
  id: string;
  name: string;
  company: string;
  squareMetres?: string;
  staffCount?: string;
  projectBrief?: string;
  isPaid: boolean;
  accessStatus?: string;
  aiRecommendations?: {
    workspaceZones?: WorkspaceZone[];
    productRecommendations?: ProductRec[];
    totalBudget?: number;
    styleDirection?: string;
  } | null;
  floorGeometry?: FloorGeometryMeta | null;
  geometrySource?: string | null;
}

interface ZoneRect {
  x: number;
  z: number;
  w: number;
  d: number;
  zone: WorkspaceZone;
}

interface SelectedProduct {
  productName: string;
  sku: string;
  category: string;
  series: string;
  quantity: number;
  image: string;
  description: string;
  zone: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTreemap(zones: WorkspaceZone[], rect: { x: number; z: number; w: number; d: number }, vertical: boolean): ZoneRect[] {
  if (zones.length === 0) return [];
  const r = rect;
  if (zones.length === 1) return [{ ...r, zone: zones[0] }];
  const total = zones.reduce((s, z) => s + z.percentage, 0);
  let acc = 0;
  let splitIdx = 0;
  const half = total / 2;
  for (let i = 0; i < zones.length - 1; i++) {
    acc += zones[i].percentage;
    if (acc >= half) { splitIdx = i; break; }
  }
  const frac = (zones.slice(0, splitIdx + 1).reduce((s, z) => s + z.percentage, 0)) / total;
  const first = zones.slice(0, splitIdx + 1);
  const second = zones.slice(splitIdx + 1);
  let r1: { x: number; z: number; w: number; d: number };
  let r2: { x: number; z: number; w: number; d: number };
  if (vertical) {
    const w1 = r.w * frac;
    r1 = { x: r.x, z: r.z, w: w1, d: r.d };
    r2 = { x: r.x + w1, z: r.z, w: r.w - w1, d: r.d };
  } else {
    const d1 = r.d * frac;
    r1 = { x: r.x, z: r.z, w: r.w, d: d1 };
    r2 = { x: r.x, z: r.z + d1, w: r.w, d: r.d - d1 };
  }
  return [...buildTreemap(first, r1, !vertical), ...buildTreemap(second, r2, !vertical)];
}

function zoneTypeFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("exec") || n.includes("director") || n.includes("manager")) return "executive";
  if (n.includes("board")) return "boardroom";
  if (n.includes("meet") || n.includes("confer") || n.includes("training")) return "meeting";
  if (n.includes("break") || n.includes("lounge") || n.includes("café") || n.includes("cafe") || n.includes("kitchen") || n.includes("wellness")) return "lounge";
  if (n.includes("recep")) return "reception";
  if (n.includes("storage") || n.includes("archive")) return "storage";
  if (n.includes("focus") || n.includes("quiet") || n.includes("phone")) return "focus";
  return "workspace";
}

const PRODUCT_MAP: Record<string, { sku: string; name: string; series: string; category: string; image: string; desc: string }> = {
  workspace: { sku: "HSG-MIL-1612-E", name: "Milan 1612 Electric Sit-Stand Workstation", series: "Milan Series", category: "Workstations", image: "/images/category-fitout.png", desc: "Electric height-adjustable workstation, 1600×800mm. Dual-motor drive, anti-collision safety system, 3-position memory presets. SGS/BIFMA certified." },
  executive: { sku: "GJO-HX-HXM-A3625", name: "Presidia Type A Executive Desk — 3600mm", series: "Presidia Executive", category: "Executive Desks", image: "/images/category-desks.png", desc: "Grand 3600mm L-shape executive desk. Imported Zingana ebony hardwood veneer, pure copper hardware, gold metal accent rails, mortise-and-tenon joinery. Flowing Brilliance collection." },
  meeting: { sku: "FSZ-RUG-TBL-2412", name: "Presidia Conference Table", series: "Presidia Series", category: "Boardroom Tables", image: "/images/category-boardroom.png", desc: "Premium veneer meeting table for 8–10 persons. Integrated cable management, coordinating credenza available." },
  boardroom: { sku: "GJO-LRU-CON6016", name: "Executive Series Conference Table — 6000mm", series: "Executive Series", category: "Boardroom Tables", image: "/images/category-boardroom.png", desc: "6000×1600mm grand boardroom conference table. Seats 16–20 persons. Dark oak veneer with geometric metallic base. Part of the full executive suite collection." },
  lounge: { sku: "GJO-HX-HXS-A2380", name: "Presidia Executive Three-Person Lounge Sofa", series: "Presidia Executive", category: "Lounge Seating", image: "/images/category-seating.png", desc: "3-seater executive lounge sofa. Zingana hardwood frame with gold metal accent rails. Premium cream upholstery. Flowing Brilliance collection." },
  reception: { sku: "FSZ-WY-REC-01", name: "Presidia Reception Counter", series: "Presidia Series", category: "Reception Desks", image: "/images/category-reception.png", desc: "Statement reception counter with premium veneer finish. Integrated modesty panel and storage. Creates a powerful first impression." },
  storage: { sku: "GJO-YS-LF-4", name: "Executive 4-Drawer Lateral File Cabinet", series: "Steel Storage", category: "Storage & Filing", image: "/images/category-fitout.png", desc: "Full-height 4-drawer lateral filing cabinet. Cold-rolled steel, powder-coated white with accent handle. 900×450×1435mm. ISO certified." },
  focus: { sku: "HSG-CAPE-CPF02", name: "Cape CPF-02 Electric Sit-Stand Desk", series: "Cape Series", category: "Workstations", image: "/images/category-fitout.png", desc: "Premium electric sit-stand executive desk. Height range 620–1250mm, triple memory preset, anti-collision safety, whisper-quiet dual motor." },
};

// ─── Three.js Scene Builder ───────────────────────────────────────────────────

function buildScene(
  container: HTMLDivElement,
  zoneRects: ZoneRect[],
  officeW: number,
  officeD: number,
  onSelectProduct: (p: SelectedProduct | null) => void,
  productRecsByZone: Record<string, ProductRec[]>
): () => void {
  const W = container.clientWidth || 800;
  const H = container.clientHeight || 500;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12131a);
  scene.fog = new THREE.FogExp2(0x12131a, 0.018);

  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);
  camera.position.set(0, Math.max(14, officeW * 0.8), Math.max(12, officeD * 0.9));
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 4;
  controls.maxDistance = Math.max(officeW, officeD) * 2.5;
  controls.target.set(0, 0, 0);

  // Lighting
  const ambient = new THREE.AmbientLight(0xfff5e4, 0.55);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xfff8ee, 0x2a1e0f, 0.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(officeW * 0.4, officeW * 0.8, officeD * 0.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -officeW;
  sun.shadow.camera.right = officeW;
  sun.shadow.camera.top = officeD;
  sun.shadow.camera.bottom = -officeD;
  scene.add(sun);

  // Fill light from opposite side
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.3);
  fill.position.set(-officeW * 0.4, officeW * 0.5, -officeD * 0.3);
  scene.add(fill);

  // Materials
  const matFloor = new THREE.MeshStandardMaterial({ color: 0xddd8d0, roughness: 0.85, metalness: 0.02 });
  const matDeskWhite = new THREE.MeshStandardMaterial({ color: 0xf5f2ee, roughness: 0.18, metalness: 0.01 });
  const matDeskOak = new THREE.MeshStandardMaterial({ color: 0xc49a58, roughness: 0.45, metalness: 0.0 });
  const matMetalBlack = new THREE.MeshStandardMaterial({ color: 0x1a1a28, roughness: 0.22, metalness: 0.85 });
  const matMetalSilver = new THREE.MeshStandardMaterial({ color: 0x8a8a94, roughness: 0.28, metalness: 0.75 });
  const matFabricCharcoal = new THREE.MeshStandardMaterial({ color: 0x42424e, roughness: 0.92, metalness: 0.0 });
  const matFabricGreen = new THREE.MeshStandardMaterial({ color: 0x2a4838, roughness: 0.92, metalness: 0.0 });
  const matLeatherCream = new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 0.78, metalness: 0.0 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.15 });
  const matWall = new THREE.MeshStandardMaterial({ color: 0xf0ece8, roughness: 0.9 });
  const matPartition = new THREE.MeshStandardMaterial({ color: 0xdedada, roughness: 0.85 });

  // Office floor
  const cx = officeW / 2;
  const cz = officeD / 2;
  const floorGeo = new THREE.PlaneGeometry(officeW, officeD);
  const floor = new THREE.Mesh(floorGeo, matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Exterior walls
  const wallH = 3.2;
  const wallT = 0.18;
  const walls = [
    { w: officeW + wallT * 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: -cz },
    { w: officeW + wallT * 2, h: wallH, d: wallT, x: 0, y: wallH / 2, z: cz },
    { w: wallT, h: wallH, d: officeD, x: -cx, y: wallH / 2, z: 0 },
    { w: wallT, h: wallH, d: officeD, x: cx, y: wallH / 2, z: 0 },
  ];
  walls.forEach(w => {
    const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
    const mesh = new THREE.Mesh(geo, matWall);
    mesh.position.set(w.x, w.y, w.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  // Ceiling (subtle, partial)
  const ceilGeo = new THREE.PlaneGeometry(officeW, officeD);
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xfafaf8, roughness: 0.9 });
  const ceil = new THREE.Mesh(ceilGeo, ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = wallH;
  scene.add(ceil);

  // Ceiling lights
  for (let xi = -1; xi <= 1; xi++) {
    for (let zi = -1; zi <= 1; zi++) {
      const pt = new THREE.PointLight(0xfff4e0, 0.4, officeW * 0.9);
      pt.position.set(xi * officeW * 0.3, wallH - 0.1, zi * officeD * 0.3);
      scene.add(pt);
    }
  }

  // Zone overlays
  zoneRects.forEach(zr => {
    const col = new THREE.Color(zr.zone.color || "#4a8fa0");
    col.multiplyScalar(0.7);
    const geo = new THREE.PlaneGeometry(zr.w - 0.04, zr.d - 0.04);
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.09, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(zr.x + zr.w / 2 - cx, 0.005, zr.z + zr.d / 2 - cz);
    scene.add(plane);

    // Zone border lines
    const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(zr.w - 0.04, zr.d - 0.04));
    const borderMat = new THREE.LineBasicMaterial({ color: new THREE.Color(zr.zone.color || "#4a8fa0"), transparent: true, opacity: 0.35 });
    const border = new THREE.LineSegments(borderGeo, borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.set(zr.x + zr.w / 2 - cx, 0.012, zr.z + zr.d / 2 - cz);
    scene.add(border);
  });

  // Clickable furniture objects
  const clickables: THREE.Object3D[] = [];

  // Helper: create chair
  function createChair(x: number, y: number, z: number, rotation: number, seatMat: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    const seatGeo = new THREE.BoxGeometry(0.52, 0.08, 0.52);
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.y = 0.44;
    seat.castShadow = true;
    g.add(seat);
    const backGeo = new THREE.BoxGeometry(0.5, 0.52, 0.06);
    const back = new THREE.Mesh(backGeo, seatMat);
    back.position.set(0, 0.72, -0.24);
    back.castShadow = true;
    g.add(back);
    // Legs
    const legGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.42, 6);
    [[-0.2, -0.2], [-0.2, 0.2], [0.2, -0.2], [0.2, 0.2]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, matMetalBlack);
      leg.position.set(lx, 0.21, lz);
      g.add(leg);
    });
    g.rotation.y = rotation;
    g.position.set(x, y, z);
    return g;
  }

  // Helper: create desk workstation
  function createWorkstation(wx: number, wz: number, rotation: number, productInfo: SelectedProduct): THREE.Group {
    const g = new THREE.Group();
    g.userData.product = productInfo;
    // Surface
    const topGeo = new THREE.BoxGeometry(1.6, 0.04, 0.8);
    const top = new THREE.Mesh(topGeo, matDeskWhite);
    top.position.y = 0.73;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    // Frame (metal beam underside)
    const beamGeo = new THREE.BoxGeometry(1.54, 0.05, 0.04);
    const beamF = new THREE.Mesh(beamGeo, matMetalBlack);
    beamF.position.set(0, 0.68, 0.37);
    g.add(beamF);
    const beamB = beamF.clone();
    beamB.position.set(0, 0.68, -0.37);
    g.add(beamB);
    // Legs
    const legGeo = new THREE.BoxGeometry(0.04, 0.68, 0.7);
    [-0.74, 0.74].forEach(lx => {
      const leg = new THREE.Mesh(legGeo, matMetalBlack);
      leg.position.set(lx, 0.34, 0);
      leg.castShadow = true;
      g.add(leg);
    });
    // Monitor
    const monBase = new THREE.BoxGeometry(0.22, 0.02, 0.18);
    const monBaseMesh = new THREE.Mesh(monBase, matMetalBlack);
    monBaseMesh.position.set(0, 0.75, -0.15);
    g.add(monBaseMesh);
    const monArm = new THREE.BoxGeometry(0.02, 0.3, 0.02);
    const monArmMesh = new THREE.Mesh(monArm, matMetalBlack);
    monArmMesh.position.set(0, 0.9, -0.12);
    g.add(monArmMesh);
    const monScreen = new THREE.BoxGeometry(0.54, 0.32, 0.025);
    const monMat = new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.1, metalness: 0.5 });
    const monScreenMesh = new THREE.Mesh(monScreen, monMat);
    monScreenMesh.position.set(0, 1.06, -0.11);
    g.add(monScreenMesh);
    // Screen glow tint
    const screenGlow = new THREE.BoxGeometry(0.52, 0.3, 0.01);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x3a6080, transparent: true, opacity: 0.4 });
    const glowMesh = new THREE.Mesh(screenGlow, glowMat);
    glowMesh.position.set(0, 1.06, -0.095);
    g.add(glowMesh);
    // Chair
    const chair = createChair(0, 0, 0.62, 0, matFabricCharcoal);
    g.add(chair);
    g.rotation.y = rotation;
    g.position.set(wx, 0, wz);
    clickables.push(top);
    top.userData = { product: productInfo };
    return g;
  }

  // Helper: create executive desk (L-shape)
  function createExecutiveDesk(wx: number, wz: number, productInfo: SelectedProduct): THREE.Group {
    const g = new THREE.Group();
    g.userData.product = productInfo;
    // Main desk
    const mainGeo = new THREE.BoxGeometry(2.0, 0.05, 1.0);
    const mainTop = new THREE.Mesh(mainGeo, matDeskOak);
    mainTop.position.y = 0.75;
    mainTop.castShadow = true;
    mainTop.userData = { product: productInfo };
    clickables.push(mainTop);
    g.add(mainTop);
    // Return
    const retGeo = new THREE.BoxGeometry(1.1, 0.05, 0.8);
    const ret = new THREE.Mesh(retGeo, matDeskOak);
    ret.position.set(-1.5, 0.75, -0.88);
    ret.castShadow = true;
    g.add(ret);
    // Legs (panel style)
    const panelGeo = new THREE.BoxGeometry(1.94, 0.7, 0.04);
    [-0.48, 0.48].forEach(pz => {
      const panel = new THREE.Mesh(panelGeo, matMetalBlack);
      panel.position.set(0, 0.38, pz);
      g.add(panel);
    });
    // Chair (premium exec)
    const chair = createChair(0, 0, 0.72, 0, matLeatherCream);
    g.add(chair);
    g.position.set(wx, 0, wz);
    return g;
  }

  // Helper: create meeting table
  function createMeetingTable(wx: number, wz: number, seats: number, tw: number, td: number, productInfo: SelectedProduct): THREE.Group {
    const g = new THREE.Group();
    const tableGeo = new THREE.BoxGeometry(tw, 0.06, td);
    const table = new THREE.Mesh(tableGeo, matDeskWhite);
    table.position.y = 0.74;
    table.castShadow = true;
    table.userData = { product: productInfo };
    clickables.push(table);
    g.add(table);
    // Legs (X base)
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.72, 8);
    [[-tw * 0.35, -td * 0.3], [-tw * 0.35, td * 0.3], [tw * 0.35, -td * 0.3], [tw * 0.35, td * 0.3]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, matMetalSilver);
      leg.position.set(lx, 0.36, lz);
      leg.castShadow = true;
      g.add(leg);
    });
    // Chairs around perimeter
    const perSide = Math.max(1, Math.floor(seats / 2));
    const chairSpacing = (tw - 0.4) / Math.max(1, perSide - 1);
    for (let i = 0; i < perSide; i++) {
      const cx2 = perSide > 1 ? (-tw / 2 + 0.2) + i * chairSpacing : 0;
      g.add(createChair(cx2, 0, td / 2 + 0.56, Math.PI, matFabricCharcoal));
      g.add(createChair(cx2, 0, -(td / 2 + 0.56), 0, matFabricCharcoal));
    }
    if (td >= 1.4) {
      g.add(createChair(tw / 2 + 0.56, 0, 0, -Math.PI / 2, matFabricCharcoal));
      g.add(createChair(-(tw / 2 + 0.56), 0, 0, Math.PI / 2, matFabricCharcoal));
    }
    g.position.set(wx, 0, wz);
    return g;
  }

  // Helper: create boardroom table
  function createBoardroomTable(wx: number, wz: number, productInfo: SelectedProduct): THREE.Group {
    const g = new THREE.Group();
    const tw = 4.2; const td = 1.6;
    const tableGeo = new THREE.BoxGeometry(tw, 0.07, td);
    const table = new THREE.Mesh(tableGeo, matDeskOak);
    table.position.y = 0.76;
    table.castShadow = true;
    table.userData = { product: productInfo };
    clickables.push(table);
    g.add(table);
    // Power module strip on top
    const pwrGeo = new THREE.BoxGeometry(tw - 0.5, 0.03, 0.12);
    const pwrMesh = new THREE.Mesh(pwrGeo, matMetalBlack);
    pwrMesh.position.set(0, 0.795, 0);
    g.add(pwrMesh);
    // Base pedestals
    const pedGeo = new THREE.BoxGeometry(0.12, 0.72, td * 0.8);
    [-1.5, 0, 1.5].forEach(px => {
      const ped = new THREE.Mesh(pedGeo, matMetalBlack);
      ped.position.set(px, 0.36, 0);
      ped.castShadow = true;
      g.add(ped);
    });
    // Chairs
    const sideCount = 5;
    for (let i = 0; i < sideCount; i++) {
      const cx2 = -tw / 2 + 0.5 + i * (tw - 1.0) / (sideCount - 1);
      g.add(createChair(cx2, 0, td / 2 + 0.56, Math.PI, matFabricNavy()));
      g.add(createChair(cx2, 0, -(td / 2 + 0.56), 0, matFabricNavy()));
    }
    g.add(createChair(-(tw / 2 + 0.6), 0, 0, Math.PI / 2, matLeatherCream));
    g.add(createChair(tw / 2 + 0.6, 0, 0, -Math.PI / 2, matLeatherCream));
    g.position.set(wx, 0, wz);
    return g;
  }

  function matFabricNavy() {
    return new THREE.MeshStandardMaterial({ color: 0x1e2d4a, roughness: 0.92, metalness: 0.0 });
  }

  // Helper: create lounge set
  function createLoungeSet(wx: number, wz: number, productInfo: SelectedProduct): THREE.Group {
    const g = new THREE.Group();
    // Sofa
    const baseGeo = new THREE.BoxGeometry(2.2, 0.18, 0.88);
    const base = new THREE.Mesh(baseGeo, matFabricGreen);
    base.position.y = 0.18;
    base.castShadow = true;
    base.userData = { product: productInfo };
    clickables.push(base);
    g.add(base);
    // Seat cushions
    const cushGeo = new THREE.BoxGeometry(0.62, 0.22, 0.68);
    [-0.74, 0, 0.74].forEach(cx2 => {
      const cush = new THREE.Mesh(cushGeo, matFabricGreen);
      cush.position.set(cx2, 0.38, 0.06);
      cush.castShadow = true;
      g.add(cush);
    });
    // Back cushions
    const bCushGeo = new THREE.BoxGeometry(0.62, 0.42, 0.14);
    [-0.74, 0, 0.74].forEach(cx2 => {
      const bc = new THREE.Mesh(bCushGeo, matFabricGreen);
      bc.position.set(cx2, 0.52, -0.36);
      g.add(bc);
    });
    // Timber legs
    const legGeo = new THREE.BoxGeometry(0.06, 0.16, 0.06);
    [[-1.0, -0.38], [1.0, -0.38], [-1.0, 0.38], [1.0, 0.38]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, matDeskOak);
      leg.position.set(lx, 0.08, lz);
      g.add(leg);
    });
    // Coffee table
    const ctGeo = new THREE.BoxGeometry(1.0, 0.04, 0.65);
    const ct = new THREE.Mesh(ctGeo, matDeskWhite);
    ct.position.set(0, 0.4, 0.72);
    ct.castShadow = true;
    g.add(ct);
    const ctLegGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.38, 6);
    [[-0.45, 0.55], [0.45, 0.55], [-0.45, 0.9], [0.45, 0.9]].forEach(([lx, lz]) => {
      const cl = new THREE.Mesh(ctLegGeo, matMetalBlack);
      cl.position.set(lx, 0.19, lz);
      g.add(cl);
    });
    g.position.set(wx, 0, wz);
    return g;
  }

  // Helper: create storage cabinet
  function createStorageCabinet(wx: number, wz: number, count: number, productInfo: SelectedProduct): THREE.Group {
    const g = new THREE.Group();
    const cabW = 0.9;
    for (let i = 0; i < count; i++) {
      const cabGeo = new THREE.BoxGeometry(cabW - 0.03, 1.2, 0.42);
      const cab = new THREE.Mesh(cabGeo, matMetalBlack);
      cab.position.set((i - (count - 1) / 2) * cabW, 0.6, 0);
      cab.castShadow = true;
      if (i === 0) {
        cab.userData = { product: productInfo };
        clickables.push(cab);
      }
      g.add(cab);
      // Door handle
      const hGeo = new THREE.BoxGeometry(0.02, 0.18, 0.025);
      const h = new THREE.Mesh(hGeo, matMetalSilver);
      h.position.set((i - (count - 1) / 2) * cabW + 0.28, 0.6, 0.225);
      g.add(h);
      // Below-desk pedestal
      const pedGeo2 = new THREE.BoxGeometry(cabW - 0.03, 0.58, 0.42);
      const ped2 = new THREE.Mesh(pedGeo2, matMetalBlack);
      ped2.position.set((i - (count - 1) / 2) * cabW, -0.31, 0);
      g.add(ped2);
    }
    g.position.set(wx, 0.6, wz);
    return g;
  }

  // Helper: create reception counter
  function createReception(wx: number, wz: number, productInfo: SelectedProduct): THREE.Group {
    const g = new THREE.Group();
    // Counter top
    const topGeo = new THREE.BoxGeometry(2.4, 0.06, 0.9);
    const top = new THREE.Mesh(topGeo, matDeskWhite);
    top.position.y = 1.08;
    top.castShadow = true;
    top.userData = { product: productInfo };
    clickables.push(top);
    g.add(top);
    // Front panel
    const fpGeo = new THREE.BoxGeometry(2.4, 1.04, 0.06);
    const fp = new THREE.Mesh(fpGeo, matMetalBlack);
    fp.position.set(0, 0.56, 0.44);
    g.add(fp);
    // Acrylic lit strip
    const stripGeo = new THREE.BoxGeometry(1.8, 0.06, 0.04);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffd680, transparent: true, opacity: 0.8 });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 0.8, 0.46);
    g.add(strip);
    // Back counter
    const backGeo = new THREE.BoxGeometry(2.4, 0.06, 0.6);
    const back = new THREE.Mesh(backGeo, matDeskOak);
    back.position.set(0, 0.88, -0.28);
    g.add(back);
    // Desk chair
    const chair = createChair(0, 0, -0.5, Math.PI, matFabricCharcoal);
    g.add(chair);
    g.position.set(wx, 0, wz);
    return g;
  }

  // Helper: create glass partition wall
  function createPartition(x1: number, z1: number, x2: number, z2: number, h: number = 2.1): void {
    const len = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
    const geo = new THREE.BoxGeometry(len, h, 0.06);
    const mesh = new THREE.Mesh(geo, matGlass);
    mesh.position.set((x1 + x2) / 2 - cx, h / 2, (z1 + z2) / 2 - cz);
    mesh.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    scene.add(mesh);
    // Metal frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a38, roughness: 0.2, metalness: 0.8 });
    const fGeo = new THREE.BoxGeometry(len, 0.05, 0.08);
    const topF = new THREE.Mesh(fGeo, frameMat);
    topF.position.set((x1 + x2) / 2 - cx, h, (z1 + z2) / 2 - cz);
    topF.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    scene.add(topF);
  }

  // ─── Place furniture per zone ─────────────────────────────────────────────

  zoneRects.forEach(zr => {
    const type = zoneTypeFor(zr.zone.zone);
    const productBase = PRODUCT_MAP[type] || PRODUCT_MAP.workspace;
    const recs = productRecsByZone[zr.zone.zone] || [];
    const firstRec = recs[0];
    const productInfo: SelectedProduct = {
      productName: firstRec?.productName || productBase.name,
      sku: firstRec?.sku || productBase.sku,
      category: firstRec?.category || productBase.category,
      series: firstRec?.seriesRecommendation || productBase.series,
      quantity: firstRec?.quantity || 1,
      image: productBase.image,
      description: productBase.desc,
      zone: zr.zone.zone,
    };

    const margin = 0.5;
    const zx = zr.x + margin - cx;
    const zz = zr.z + margin - cz;
    const zw = zr.w - margin * 2;
    const zd = zr.d - margin * 2;
    if (zw <= 0 || zd <= 0) return;

    if (type === "workspace") {
      const staffHere = zr.zone.staffCapacity || Math.max(2, Math.round((zr.zone.percentage / 100) * 20));
      const cols = Math.max(1, Math.floor(zw / 1.9));
      const rows = Math.max(1, Math.ceil(staffHere / cols));
      let placed = 0;
      for (let row = 0; row < rows && placed < Math.min(staffHere, 12); row++) {
        for (let col = 0; col < cols && placed < Math.min(staffHere, 12); col++) {
          const wx2 = zx + col * 1.85 + 0.82;
          const wz2 = zz + row * 1.6 + 0.8;
          if (wx2 < zx + zw - 0.8 && wz2 < zz + zd - 0.8) {
            const desk = createWorkstation(wx2, wz2, row % 2 === 0 ? 0 : Math.PI, productInfo);
            scene.add(desk);
            placed++;
          }
        }
      }
    } else if (type === "executive") {
      scene.add(createExecutiveDesk(zx + zw / 2, zz + zd / 2, productInfo));
      if (zw >= 4) {
        createPartition(zr.x - cx, zr.z - cz, zr.x + zr.w - cx, zr.z - cz);
        createPartition(zr.x - cx, zr.z - cz, zr.x - cx, zr.z + zr.d - cz);
      }
    } else if (type === "boardroom") {
      scene.add(createBoardroomTable(zx + zw / 2, zz + zd / 2, productInfo));
      createPartition(zr.x - cx, zr.z - cz, zr.x + zr.w - cx, zr.z - cz);
      createPartition(zr.x - cx, zr.z - cz, zr.x - cx, zr.z + zr.d - cz);
      createPartition(zr.x + zr.w - cx, zr.z - cz, zr.x + zr.w - cx, zr.z + zr.d - cz);
      createPartition(zr.x - cx, zr.z + zr.d - cz, zr.x + zr.w - cx, zr.z + zr.d - cz);
    } else if (type === "meeting") {
      const tw = Math.min(2.8, zw - 1.4);
      const td = Math.min(1.4, zd - 1.4);
      if (tw > 1 && td > 0.8) {
        scene.add(createMeetingTable(zx + zw / 2, zz + zd / 2, 8, tw, td, productInfo));
        createPartition(zr.x - cx, zr.z - cz, zr.x + zr.w - cx, zr.z - cz);
        createPartition(zr.x - cx, zr.z - cz, zr.x - cx, zr.z + zr.d - cz);
      }
    } else if (type === "lounge") {
      const sets = Math.max(1, Math.floor((zw * zd) / 10));
      for (let s = 0; s < Math.min(sets, 2); s++) {
        scene.add(createLoungeSet(zx + zw * (s === 0 ? 0.3 : 0.7), zz + zd / 2, productInfo));
      }
    } else if (type === "reception") {
      scene.add(createReception(zx + zw / 2, zz + 0.8, productInfo));
    } else if (type === "storage") {
      const cabs = Math.max(1, Math.floor(zw / 0.95));
      scene.add(createStorageCabinet(zx + zw / 2, zz + 0.3, Math.min(cabs, 5), productInfo));
    } else if (type === "focus") {
      const count = Math.max(1, Math.floor((zw * zd) / 3.5));
      const cols = Math.max(1, Math.floor(zw / 1.7));
      let placed = 0;
      for (let row = 0; row < Math.ceil(count / cols) && placed < count; row++) {
        for (let col = 0; col < cols && placed < count; col++) {
          const fx = zx + col * 1.7 + 0.8;
          const fz2 = zz + row * 1.5 + 0.8;
          if (fx < zx + zw - 0.7 && fz2 < zz + zd - 0.7) {
            const focusProd: SelectedProduct = { ...productInfo, productName: PRODUCT_MAP.focus.name, sku: PRODUCT_MAP.focus.sku, series: PRODUCT_MAP.focus.series, image: PRODUCT_MAP.focus.image, description: PRODUCT_MAP.focus.desc };
            scene.add(createWorkstation(fx, fz2, 0, focusProd));
            placed++;
          }
        }
      }
    }
  });

  // Raycaster
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const handleClick = (e: MouseEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickables, true);
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      let product: SelectedProduct | null = null;
      while (obj) {
        if (obj.userData?.product) { product = obj.userData.product; break; }
        obj = obj.parent;
      }
      onSelectProduct(product);
    } else {
      onSelectProduct(null);
    }
  };

  renderer.domElement.addEventListener("click", handleClick);

  // Resize
  const resizeObs = new ResizeObserver(() => {
    const nW = container.clientWidth;
    const nH = container.clientHeight;
    camera.aspect = nW / nH;
    camera.updateProjectionMatrix();
    renderer.setSize(nW, nH);
  });
  resizeObs.observe(container);

  // Animation loop
  let animId: number;
  function animate() {
    animId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Reset camera function
  (container as any).__resetCamera = () => {
    camera.position.set(0, Math.max(14, officeW * 0.8), Math.max(12, officeD * 0.9));
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  return () => {
    cancelAnimationFrame(animId);
    resizeObs.disconnect();
    renderer.domElement.removeEventListener("click", handleClick);
    renderer.dispose();
    if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
  };
}

// ─── Demo data (no planning request) ─────────────────────────────────────────

const DEMO_ZONES: WorkspaceZone[] = [
  { zone: "Open Workspace", color: "#4a8fa0", percentage: 38, staffCapacity: 14, description: "Flexible workstation clusters" },
  { zone: "Boardroom", color: "#7c5cbf", percentage: 16, staffCapacity: 12, description: "Premium boardroom for 12" },
  { zone: "Meeting Room", color: "#4a7abf", percentage: 12, staffCapacity: 8, description: "Collaborative meeting space" },
  { zone: "Executive Office", color: "#c9a84c", percentage: 10, staffCapacity: 2, description: "Executive suite" },
  { zone: "Breakout Zone", color: "#4abf7a", percentage: 14, staffCapacity: 10, description: "Casual breakout area" },
  { zone: "Reception", color: "#bf7a4a", percentage: 6, staffCapacity: 2, description: "Welcoming reception" },
  { zone: "Storage", color: "#8a8a9a", percentage: 4, staffCapacity: 0, description: "Storage and filing" },
];

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function OfficeWalkthrough() {
  const planId = new URLSearchParams(window.location.search).get("id");

  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [webglError, setWebglError] = useState(false);

  const { data: layoutData, isLoading } = useQuery<LayoutData>({
    queryKey: ["/api/planning-requests", planId, "layout"],
    queryFn: async () => {
      const res = await fetch(`/api/planning-requests/${planId}/layout`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!planId,
    retry: false,
  });

  const isPaid = !planId || layoutData?.isPaid === true;
  const zones: WorkspaceZone[] = layoutData?.aiRecommendations?.workspaceZones || (!planId ? DEMO_ZONES : []);
  const products: ProductRec[] = layoutData?.aiRecommendations?.productRecommendations || [];
  const sqm = parseFloat(layoutData?.squareMetres || "") || 280;
  const staff = parseInt(layoutData?.staffCount || "") || 20;

  // Use real floor geometry aspect ratio if available for accurate 3D room shape
  const geomAspect = layoutData?.floorGeometry?.aspectRatio;
  const officeW = geomAspect && geomAspect > 0.3 && geomAspect < 5
    ? Math.sqrt(sqm * Math.max(0.6, Math.min(geomAspect, 2.5)))
    : Math.sqrt(sqm * 1.35);
  const officeD = sqm / officeW;

  const productRecsByZone: Record<string, ProductRec[]> = {};
  products.forEach(p => {
    if (!productRecsByZone[p.zone]) productRecsByZone[p.zone] = [];
    productRecsByZone[p.zone].push(p);
  });

  const zoneRects = buildTreemap(zones, { x: 0, z: 0, w: officeW, d: officeD }, true);

  useEffect(() => {
    document.title = "3D Office Walkthrough | The Corporate Desk";
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!isPaid) return;
    if (zones.length === 0) return;

    setSceneReady(false);
    setWebglError(false);
    let cleanup: (() => void) | null = null;
    try {
      cleanup = buildScene(
        canvasRef.current,
        zoneRects,
        officeW,
        officeD,
        setSelectedProduct,
        productRecsByZone
      );
    } catch (err) {
      console.warn("3D scene could not initialize:", err);
      setWebglError(true);
      setSceneReady(true);
      return;
    }
    const t = setTimeout(() => setSceneReady(true), 400);

    return () => {
      cleanup?.();
      clearTimeout(t);
    };
  }, [isPaid, zones.length, sqm, staff, planId]);

  const handleResetCamera = useCallback(() => {
    if (canvasRef.current && (canvasRef.current as any).__resetCamera) {
      (canvasRef.current as any).__resetCamera();
    }
  }, []);

  const totalBudget = layoutData?.aiRecommendations?.totalBudget;

  return (
    <Layout>
      <div className="min-h-screen bg-[hsl(220,20%,6%)]">

        {/* Hero */}
        <section className="bg-[hsl(220,18%,8%)] border-b border-[rgba(201,168,76,0.12)] pt-16 pb-10 px-4">
          <div className="max-w-6xl mx-auto">

            {/* DEMO MODE hero */}
            {!planId && (
              <>
                <div className="flex items-center gap-2 mb-5">
                  <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)] text-xs tracking-wider">
                    SAMPLE WORKSPACE LAYOUT
                  </Badge>
                  <Badge className="bg-[rgba(255,255,255,0.06)] text-white/50 border-[rgba(255,255,255,0.12)] text-xs">
                    INTERACTIVE DEMO
                  </Badge>
                </div>
                <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white mb-4 leading-tight">
                  See what your future office<br className="hidden sm:block" /> could look like
                </h1>
                <p className="text-white/60 text-base sm:text-lg max-w-2xl mb-6 leading-relaxed">
                  This is a sample demonstration workspace. Upload your floor plan to generate your own AI workspace concept — personalised to your team size, style, and budget.
                </p>
                <div className="flex flex-wrap gap-3" data-testid="hero-demo-ctas">
                  <Link href="/upload-your-floor-plan">
                    <Button className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-bold px-6 py-3 text-sm" data-testid="button-start-planner-hero">
                      <Sparkles className="w-4 h-4 mr-2" /> Get My Workspace Concept
                    </Button>
                  </Link>
                  <Link href="/upload-your-floor-plan">
                    <Button variant="outline" className="border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)] px-6 py-3 text-sm font-semibold" data-testid="button-upload-plan-hero">
                      <Upload className="w-4 h-4 mr-2" /> Upload Your Floor Plan
                    </Button>
                  </Link>
                </div>
                <p className="text-white/30 text-xs mt-4">No account required · AI concept generated instantly · Free</p>
              </>
            )}

            {/* PERSONALIZED mode hero */}
            {planId && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.25)] text-xs tracking-wider">
                    AI OFFICE PLANNER
                  </Badge>
                  {layoutData?.isPaid && (
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">
                      UNLOCKED
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-3">
                  Walk Through Your Future Workspace
                </h1>
                <p className="text-white/55 text-base max-w-2xl">
                  {layoutData
                    ? `Interactive 3D layout for ${layoutData.company || layoutData.name} — ${sqm}sqm · ${staff} staff`
                    : "Loading your workspace layout..."}
                </p>
                {layoutData && (
                  <div className="flex flex-wrap gap-4 mt-5">
                    {[
                      { label: "Floor Area", value: `${sqm} sqm` },
                      { label: "Staff", value: `${staff} people` },
                      { label: "Zones", value: `${zones.length} zones` },
                      totalBudget ? { label: "Furniture Investment", value: `$${totalBudget.toLocaleString()}` } : null,
                    ].filter(Boolean).map((s: any) => (
                      <div key={s.label} className="bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.15)] rounded-xl px-4 py-2.5">
                        <div className="text-[hsl(43,78%,65%)] text-xs font-medium tracking-wider uppercase">{s.label}</div>
                        <div className="text-white font-semibold text-sm mt-0.5">{s.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Loading */}
        {planId && isLoading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-[hsl(43,78%,52%)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/40 text-sm">Loading your workspace layout…</p>
            </div>
          </div>
        )}

        {/* Ready state */}
        {planId && !isLoading && layoutData && !isPaid && (
          <div className="max-w-3xl mx-auto px-4 py-16" data-testid="section-ready-state">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-[rgba(201,168,76,0.1)] border border-[rgba(201,168,76,0.2)] flex items-center justify-center mx-auto mb-5">
                <Lock className="w-7 h-7 text-[hsl(43,78%,60%)]" />
              </div>
              <p className="text-[hsl(43,78%,65%)] text-sm font-medium tracking-wider uppercase mb-3" data-testid="text-workspace-concept-ready">WORKSPACE CONCEPT READY</p>
              <h2 className="text-2xl font-serif font-bold text-white mb-3" data-testid="heading-concept-ready">
                Your AI workspace concept is ready.
              </h2>
              <p className="text-white/50 text-base" data-testid="text-view-message">
                View the full layout and furniture plan to access the interactive 3D walkthrough.
              </p>
            </div>
            {/* Blurred 3D preview */}
            <div className="relative rounded-2xl overflow-hidden mb-8 border border-[rgba(201,168,76,0.12)]" style={{ height: "220px" }}>
              <div className="absolute inset-0 bg-[hsl(220,20%,10%)]" />
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(2, 1fr)", gap: "1px" }}>
                {zones.slice(0, 6).map((z, i) => (
                  <div key={i} className="opacity-40" style={{ background: z.color + "22" }} />
                ))}
              </div>
              <div className="absolute inset-0 backdrop- flex items-center justify-center">
                <div className="text-center">
                  <Box className="w-10 h-10 text-[hsl(43,78%,52%)] mx-auto mb-2 opacity-80" />
                  <p className="text-white/60 text-sm font-medium">3D walkthrough ready</p>
                </div>
              </div>
            </div>
            <div className="bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.2)] rounded-2xl p-6 text-center">
              <p className="text-white/60 text-sm mb-4">View your full AI workspace plan at:</p>
              <Link href={`/upload-your-floor-plan?id=${planId}`}>
                <Button className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-bold px-8 py-3 text-base">
                  View Free 3D Walkthrough
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Main 3D viewer (paid or demo) */}
        {(isPaid && (zones.length > 0 || !isLoading)) && (
          <div className="relative">
            {/* Zone legend */}
            {zones.length > 0 && (
              <div className="max-w-6xl mx-auto px-4 py-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-white/35 text-xs tracking-wider uppercase mr-1">Zones:</span>
                  {zones.map((z, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-[rgba(255,255,255,0.04)] rounded-lg px-2.5 py-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: z.color }} />
                      <span className="text-white/70 text-xs font-medium">{z.zone}</span>
                      {z.staffCapacity ? <span className="text-white/35 text-xs">{z.staffCapacity}p</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Canvas area */}
            <div className="relative mx-4 sm:mx-6" style={{ borderRadius: "16px", overflow: "hidden" }}>
              <div
                ref={canvasRef}
                className="w-full bg-[hsl(220,14%,8%)]"
                style={{ height: "clamp(380px, 60vh, 640px)", cursor: "grab" }}
                data-testid="canvas-3d-walkthrough"
              />

              {/* WebGL fallback */}
              {webglError && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ borderRadius: "16px", background: "hsl(220,20%,9%)" }}>
                  <div className="text-center px-8">
                    <Box className="w-12 h-12 text-[hsl(43,78%,52%)] mx-auto mb-4 opacity-60" />
                    <h3 className="text-white font-semibold mb-2">3D Preview Not Available</h3>
                    <p className="text-white/40 text-sm max-w-xs mb-6">Your device doesn't support the 3D walkthrough. Use our AI planner or speak to a consultant instead.</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link href="/ai-office-planner">
                        <Button className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-bold px-6 py-2.5 text-sm" data-testid="button-webgl-fallback-planner">
                          Try AI Office Planner
                        </Button>
                      </Link>
                      <Link href="/request-a-quote">
                        <Button variant="outline" className="border-[rgba(201,168,76,0.35)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)] px-6 py-2.5 text-sm font-semibold" data-testid="button-webgl-fallback-quote">
                          Request a Quote
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading overlay */}
              {!sceneReady && !webglError && (
                <div className="absolute inset-0 bg-[hsl(220,20%,8%)] flex items-center justify-center" style={{ borderRadius: "16px" }}>
                  <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <div className="w-16 h-16 border-2 border-[rgba(201,168,76,0.2)] rounded-full" />
                      <div className="absolute inset-0 w-16 h-16 border-2 border-t-[hsl(43,78%,52%)] rounded-full animate-spin" />
                    </div>
                    <p className="text-white/40 text-sm font-medium">Building 3D workspace…</p>
                    <p className="text-white/20 text-xs mt-1">Placing {zones.length} zones · {staff} workstations</p>
                  </div>
                </div>
              )}

              {/* Controls overlay */}
              {sceneReady && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 flex-wrap">
                  <div className="bg-[rgba(0,0,0,0.65)] backdrop- rounded-xl px-3 py-2 flex items-center gap-3 text-white/50 text-xs">
                    <span className="flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Drag to rotate</span>
                    <span className="hidden sm:flex items-center gap-1"><ZoomIn className="w-3 h-3" /> Scroll to zoom</span>
                    <span className="hidden sm:flex items-center gap-1"><Move className="w-3 h-3" /> Right-drag pan</span>
                    <span className="flex items-center gap-1"><MousePointer2 className="w-3 h-3" /> Click furniture for info</span>
                  </div>
                  <button
                    onClick={handleResetCamera}
                    className="bg-[rgba(0,0,0,0.65)] backdrop- rounded-xl px-3 py-2 text-white/50 text-xs hover:text-white/80 transition-colors"
                    data-testid="button-reset-camera"
                  >
                    Reset view
                  </button>
                </div>
              )}

              {/* Demo badge */}
              {!planId && sceneReady && (
                <div className="absolute top-4 left-4 bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.3)] backdrop- rounded-lg px-3 py-1.5">
                  <span className="text-[hsl(43,78%,65%)] text-xs font-medium tracking-wider">DEMONSTRATION LAYOUT</span>
                </div>
              )}
            </div>

            {/* Product info panel */}
            {selectedProduct && (
              <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-72 bg-[hsl(220,18%,10%)] border border-[rgba(201,168,76,0.2)] rounded-2xl shadow-2xl overflow-hidden"
                data-testid="panel-product-info">
                <div className="relative h-36 bg-[hsl(220,20%,8%)] flex items-center justify-center">
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.productName}
                    className="h-full w-full object-cover opacity-70"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,18%,10%)] to-transparent" />
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[rgba(0,0,0,0.5)] flex items-center justify-center text-white/60 hover:text-white transition-colors"
                    data-testid="button-close-product-panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4">
                  <Badge className="bg-[rgba(201,168,76,0.12)] text-[hsl(43,78%,65%)] border-[rgba(201,168,76,0.2)] text-xs mb-2">
                    {selectedProduct.category}
                  </Badge>
                  <h3 className="text-white font-serif font-semibold text-base leading-tight mb-1">
                    {selectedProduct.productName}
                  </h3>
                  <p className="text-[hsl(43,78%,65%)] text-xs font-medium mb-1">{selectedProduct.series}</p>
                  <p className="text-white/40 text-xs font-mono mb-2">SKU: {selectedProduct.sku}</p>
                  <p className="text-white/55 text-xs leading-relaxed mb-3">{selectedProduct.description}</p>
                  <div className="flex items-center justify-between text-xs text-white/40 mb-3 border-t border-white/5 pt-3">
                    <span>Zone: <span className="text-white/60">{selectedProduct.zone}</span></span>
                    {selectedProduct.quantity > 1 && <span>Qty: <span className="text-white/60">{selectedProduct.quantity}</span></span>}
                  </div>
                  <Link href="/catalog">
                    <Button size="sm" className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-semibold text-xs">
                      View Product Range <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Furniture Package Summary */}
        {isPaid && zones.length > 0 && (
          <section className="max-w-6xl mx-auto px-4 py-12">
            <div className="flex items-center gap-3 mb-6">
              <Package className="w-5 h-5 text-[hsl(43,78%,52%)]" />
              <h2 className="text-xl font-serif font-bold text-white">Furniture Package by Zone</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {zones.map((z, i) => {
                const type = zoneTypeFor(z.zone);
                const prod = PRODUCT_MAP[type] || PRODUCT_MAP.workspace;
                const recs = productRecsByZone[z.zone] || [];
                return (
                  <div key={i} className="bg-[hsl(220,18%,9%)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 hover:border-[rgba(201,168,76,0.2)] transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ background: z.color }} />
                      <div>
                        <h3 className="text-white font-semibold text-sm">{z.zone}</h3>
                        <p className="text-white/35 text-xs mt-0.5">{z.percentage}% of floor · {z.staffCapacity || "—"} people</p>
                      </div>
                    </div>
                    {recs.length > 0 ? (
                      <div className="space-y-2">
                        {recs.slice(0, 2).map((r, ri) => (
                          <div key={ri} className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
                            <div>
                              <p className="text-white/70 font-medium">{r.productName}</p>
                              <p className="text-white/30 font-mono">{r.sku} · Qty {r.quantity}</p>
                            </div>
                            <p className="text-[hsl(43,78%,65%)] font-medium">${r.totalCost?.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border-t border-white/5 pt-2">
                        <p className="text-white/50 text-xs font-medium">{prod.name}</p>
                        <p className="text-white/30 text-xs font-mono">{prod.sku}</p>
                        <p className="text-white/35 text-xs mt-1">{prod.series}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* No layout message (planId but no data) */}
        {planId && !isLoading && !layoutData && (
          <div className="max-w-2xl mx-auto px-4 py-20 text-center">
            <Eye className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h2 className="text-xl font-serif font-bold text-white mb-2">Layout Not Found</h2>
            <p className="text-white/40 text-sm mb-6">This planning request could not be found. Please submit a new AI Office Planner request.</p>
            <Link href="/upload-your-floor-plan">
              <Button className="bg-[hsl(43,78%,52%)] text-[hsl(220,20%,6%)] font-semibold">
                Start AI Office Planner <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}

        {/* Demo mode mid-page CTA — start your own plan */}
        {!planId && (
          <section className="max-w-5xl mx-auto px-4 py-12" data-testid="section-demo-promo">
            <div className="bg-gradient-to-br from-[hsl(220,18%,10%)] to-[hsl(220,18%,8%)] border border-[rgba(201,168,76,0.2)] rounded-2xl overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
                {/* Left: Benefits */}
                <div className="p-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[rgba(201,168,76,0.1)] rounded-full border border-[rgba(201,168,76,0.2)] mb-5">
                    <Sparkles className="w-3 h-3 text-[hsl(43,78%,52%)]" />
                    <span className="text-[hsl(43,78%,65%)] text-xs font-medium tracking-wider uppercase">Free AI Office Planner</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mb-3 leading-snug">
                    Generate your own<br />personalised 3D workspace
                  </h2>
                  <p className="text-white/50 text-sm mb-6 leading-relaxed">
                    Answer a few questions about your office — size, team, style — and our AI will build a personalised workspace concept including zone layout, furniture plan, and cost estimate.
                  </p>
                  <ul className="space-y-2.5 mb-7">
                    {[
                      "Your own AI workspace zone layout",
                      "Personalised 3D walkthrough",
                      "Furniture SKUs matched to your brief",
                      "Cost estimate for your project",
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-white/65">
                        <div className="w-4 h-4 rounded-full bg-[rgba(201,168,76,0.2)] flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(43,78%,52%)]" />
                        </div>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/upload-your-floor-plan">
                      <Button className="bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-bold px-7 py-3 text-sm" data-testid="button-start-ai-planner">
                        <Sparkles className="w-4 h-4 mr-2" /> Start Free AI Office Planner
                      </Button>
                    </Link>
                    <Link href="/upload-your-floor-plan">
                      <Button variant="outline" className="border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)] px-6 py-3 text-sm font-semibold" data-testid="button-upload-floor-plan-mid">
                        <Upload className="w-4 h-4 mr-2" /> Upload Your Floor Plan
                      </Button>
                    </Link>
                  </div>
                  <p className="text-white/25 text-xs mt-3">Free concept · No account required · Full plan views for Free</p>
                </div>
                {/* Right: Funnel steps */}
                <div className="border-t sm:border-t-0 sm:border-l border-[rgba(201,168,76,0.1)] p-8">
                  <p className="text-white/35 text-xs font-medium tracking-wider uppercase mb-5">How it works</p>
                  <div className="space-y-4">
                    {[
                      { step: "1", title: "Submit your brief", desc: "Tell us your office size, team, style preference and budget — takes 3 minutes." },
                      { step: "2", title: "Get your free AI concept", desc: "Our AI analyses your brief and generates a personalised workspace zone breakdown instantly." },
                      { step: "3", title: "View the full plan", desc: "Pay Free to view the full visual layout, 3D walkthrough, furniture SKUs and cost estimate." },
                      { step: "4", title: "Request a quote", desc: "Share your plan with our team and receive a full fit-out proposal tailored to your space." },
                    ].map(({ step, title, desc }) => (
                      <div key={step} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-[rgba(201,168,76,0.15)] border border-[rgba(201,168,76,0.25)] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[hsl(43,78%,65%)] text-xs font-bold">{step}</span>
                        </div>
                        <div>
                          <p className="text-white/85 text-sm font-semibold">{title}</p>
                          <p className="text-white/40 text-xs leading-relaxed mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="bg-[hsl(220,18%,8%)] border-t border-[rgba(201,168,76,0.1)] py-14 px-4 mt-8">
          <div className="max-w-5xl mx-auto">
            {!planId ? (
              /* Demo mode bottom CTA */
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  <span className="text-[hsl(43,78%,65%)] text-xs font-medium tracking-wider uppercase">Start Your AI Office Plan</span>
                </div>
                <h2 className="text-2xl font-serif font-bold text-white mb-2">Ready to design your workspace?</h2>
                <p className="text-white/45 text-sm mb-8 max-w-xl">
                  Upload your floor plan or submit your brief to receive a personalised AI workspace concept — zones, furniture, 3D walkthrough and cost estimate.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                  <Link href="/upload-your-floor-plan">
                    <Button className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-bold py-4 text-sm" data-testid="button-request-quote-3d">
                      <Sparkles className="w-4 h-4 mr-2" /> Get My Workspace Concept
                    </Button>
                  </Link>
                  <Link href="/upload-your-floor-plan">
                    <Button variant="outline" className="w-full border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)] py-4 text-sm font-semibold" data-testid="button-book-strategy-3d">
                      <Upload className="w-4 h-4 mr-2" /> Upload Your Floor Plan
                    </Button>
                  </Link>
                  <Link href="/contact">
                    <Button variant="ghost" className="w-full text-white/50 hover:text-white py-4 text-sm">
                      <Phone className="w-4 h-4 mr-2" /> Speak to a Specialist
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              /* Personalized mode bottom CTA */
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-[hsl(43,78%,52%)]" />
                  <span className="text-[hsl(43,78%,65%)] text-xs font-medium tracking-wider uppercase">Ready to Proceed?</span>
                </div>
                <h2 className="text-2xl font-serif font-bold text-white mb-2">Turn this layout into reality.</h2>
                <p className="text-white/45 text-sm mb-8 max-w-xl">
                  Our commercial fitout specialists will refine this plan, source every product, and manage your project end-to-end.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                  <Link href="/send-us-your-quote">
                    <Button className="w-full bg-[hsl(43,78%,52%)] hover:bg-[hsl(43,78%,45%)] text-[hsl(220,20%,6%)] font-bold py-4 text-base" data-testid="button-request-quote-3d">
                      <Package className="w-4 h-4 mr-2" /> Request Full Quote
                    </Button>
                  </Link>
                  <Link href="/contact">
                    <Button variant="outline" className="w-full border-[rgba(201,168,76,0.3)] text-[hsl(43,78%,65%)] hover:bg-[rgba(201,168,76,0.08)] py-4 text-base font-semibold" data-testid="button-book-strategy-3d">
                      <Phone className="w-4 h-4 mr-2" /> Book Strategy Call
                    </Button>
                  </Link>
                </div>
              </>
            )}
            <div className="mt-6 flex flex-wrap gap-5 text-sm text-white/35">
              <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> 1300 977 607</span>
              <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> service@thecorporatedesk.com.au</span>
              <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> 10 Primrose St, Bowen Hills QLD</span>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}
