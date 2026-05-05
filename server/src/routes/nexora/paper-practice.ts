import express from 'express';
const router = express.Router();

let isAutoTrading = true; // Default to TRUE for 24/7 operation

router.get('/control/status', (req, res) => {
    res.json({ 
        ok: true, 
        status: isAutoTrading ? 'AUTONOMOUS' : 'PAUSED',
        uptime: '24/7 ACTIVE',
        mode: 'PAPER-ONLY'
    });
});

router.post('/start', (req, res) => {
    isAutoTrading = true;
    res.json({ ok: true, message: "Autonomous 24/7 Loop Engaged." });
});

router.post('/stop', (req, res) => {
    isAutoTrading = false;
    res.json({ ok: true, message: "Manual Override: Loop Paused." });
});

export default router;
