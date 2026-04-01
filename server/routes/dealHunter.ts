import { Router } from "express";
import {
  runDealHunterScan,
  pushDealHunterToPipeline,
  pushDealHunterToRadar,
  reviewDealHunterSignal,
  dismissDealHunterSignal,
  markDealHunterSignalDuplicate,
  getDealHunterStats,
} from "../services/dealHunter";

const router = Router();

// ─── RUN SCAN ─────────────────────────────────────────────

router.post("/scan", async (req, res) => {
  try {
    const count = Number(req.body?.count || 10);

    const result = await runDealHunterScan(count);

    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("[DealHunterRoute] scan error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Scan failed",
    });
  }
});

// ─── ACTIONS ─────────────────────────────────────────────

router.post("/:id/push-to-pipeline", async (req, res) => {
  try {
    const result = await pushDealHunterToPipeline(req.params.id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post("/:id/push-to-radar", async (req, res) => {
  try {
    const result = await pushDealHunterToRadar(req.params.id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post("/:id/review", async (req, res) => {
  try {
    const result = await reviewDealHunterSignal(req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post("/:id/dismiss", async (req, res) => {
  try {
    const result = await dismissDealHunterSignal(req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post("/:id/duplicate", async (req, res) => {
  try {
    const result = await markDealHunterSignalDuplicate(req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── STATS ─────────────────────────────────────────────

router.get("/stats", async (_req, res) => {
  try {
    const stats = await getDealHunterStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;