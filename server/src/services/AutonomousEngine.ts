import { runTradeLogic } from './TradeLogic'; 

class AutonomousEngine {
    private isRunning: boolean = false;

    public async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("!!! NEXORA LIVE AUTO-PILOT ENGAGED !!!");
        this.loop();
    }

    private async loop() {
        while (this.isRunning) {
            try {
                // This triggers the actual trade logic
                await runTradeLogic(); 
            } catch (error) {
                console.error("Critical Engine Error:", error);
            }
            // 60-second pulse for 24/7 monitoring
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
    }
}
export const NexoraBot = new AutonomousEngine();
