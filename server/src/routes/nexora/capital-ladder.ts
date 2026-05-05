import express from 'express';
const router = express.Router();

let liveState = {
    currentCapital: 50.00, // Starting AUD
    currency: 'AUD',
    liveExecutionEnabled: true,
    consecutiveLosses: 0
};

const getLiveLimit = (cap: number) => {
    if (cap < 50) return 0;
    if (cap < 100) return 1.00;
    if (cap < 250) return 2.50;
    if (cap < 500) return 5.00;
    if (cap < 1000) return 10.00;
    if (cap < 2500) return 50.00;
    if (cap < 10000) return 150.00;
    return 150.00;
};

router.get('/status', (req, res) => {
    res.json({ ok: true, state: liveState, limit: getLiveLimit(liveState.currentCapital) });
});

router.post('/evaluate', (req, res) => {
    const { amount } = req.body;
    const limit = getLiveLimit(liveState.currentCapital);
    
    if (liveState.consecutiveLosses >= 3) {
        return res.json({ approved: false, reason: "Daily loss streak limit reached." });
    }
    if (amount > limit) {
        return res.json({ approved: false, reason: `Trade ${amount} exceeds limit ${limit}` });
    }
    res.json({ approved: true });
});

export default router;
