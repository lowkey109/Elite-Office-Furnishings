import express from 'express';
const router = express.Router();

let liveState = {
    currentCapital: 50.00, 
    currency: 'AUD',
    liveExecutionEnabled: true,
    consecutiveLosses: 0
};

const getLiveLimit = (cap: number) => {
    if (cap < 50) return 0;
    if (cap >= 50 && cap <= 99) return 1.00;
    if (cap >= 100 && cap <= 249) return 2.50;
    if (cap >= 250 && cap <= 499) return 5.00;
    if (cap >= 500 && cap <= 999) return 10.00;
    if (cap >= 1000 && cap <= 2499) return 50.00;
    if (cap >= 5000 && cap <= 10000) return 150.00;
    return 150.00; 
};

router.get('/status', (req, res) => {
    res.json({ ok: true, state: liveState, limit: getLiveLimit(liveState.currentCapital) });
});

router.post('/evaluate', (req, res) => {
    const { amount } = req.body;
    const limit = getLiveLimit(liveState.currentCapital);
    
    if (liveState.consecutiveLosses >= 3) {
        return res.json({ approved: false, reason: "Risk Gate: 3 consecutive losses. Stopping for 24h." });
    }
    if (amount > limit) {
        return res.json({ approved: false, reason: "Risk Gate: Trade amount exceeds Capital Ladder limit." });
    }
    res.json({ approved: true });
});

export default router;
