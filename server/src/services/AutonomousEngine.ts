import { runTradeLogic } from './TradeLogic'; 

class AutonomousEngine {
    private isRunning: boolean = false;

    public async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("!!! LIVE 24/7 TRADING ENGINE ACTIVATED !!!");
        this.loop();
    }

    private async loop() {
        while (this.isRunning) {
            try {
                // Call your live trade logic here
                await runTradeLogic(); 
            } catch (e) {
                console.error("Live Loop Error:", e);
            }
            await new Promise(r => setTimeout(r, 60000)); // 1 min pulse
        }
    }
}
export const NexoraBot = new AutonomousEngine();
