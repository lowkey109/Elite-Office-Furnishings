import { NexoraBot } from './services/AutonomousEngine';
import capitalLadderRouter from './routes/nexora/capital-ladder';

// NEXORA SYSTEM INITIALIZATION
app.use("/api/nexora/capital-ladder", capitalLadderRouter);

NexoraBot.start();
