import {
  assessNexoraCapability,
  captureNexoraTeachingExample,
  convertNexoraLessonToPlaybook,
  createNexoraKnowledgeGap,
  createNexoraLesson,
  createNexoraSkill,
  createNexoraTeachingQueueItem,
  createNexoraWorkerTrainingRecord,
  getNexoraTeachingStatus,
  listNexoraLessons,
  listNexoraSkills,
  listNexoraTeachingQueue,
  seedNexoraSkillRegistry,
} from "../teaching/nexoraTeachingEngine";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraTeachingRoutes(app: any) {
  app.get("/api/nexora/teaching/status", (_req: any, res: any) => {
    try { res.json(getNexoraTeachingStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/teaching/skills/seed", (_req: any, res: any) => {
    try { res.json(seedNexoraSkillRegistry()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/teaching/skill/create", (req: any, res: any) => {
    try { res.json(createNexoraSkill(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/teaching/skills", (req: any, res: any) => {
    try { res.json(listNexoraSkills({ division: req.query?.division || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/teaching/capability/assess", (req: any, res: any) => {
    try { res.json(assessNexoraCapability(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/teaching/gap/create", (req: any, res: any) => {
    try { res.json(createNexoraKnowledgeGap(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/teaching/lesson/create", (req: any, res: any) => {
    try { res.json(createNexoraLesson(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/teaching/lessons", (req: any, res: any) => {
    try { res.json(listNexoraLessons({ skillKey: req.query?.skillKey || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/teaching/example/capture", (req: any, res: any) => {
    try { res.json(captureNexoraTeachingExample(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/teaching/playbook/from-lesson", (req: any, res: any) => {
    try { res.json(convertNexoraLessonToPlaybook(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/teaching/training/create", (req: any, res: any) => {
    try { res.json(createNexoraWorkerTrainingRecord(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/teaching/queue/create", (req: any, res: any) => {
    try { res.json(createNexoraTeachingQueueItem(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/teaching/queue", (req: any, res: any) => {
    try { res.json(listNexoraTeachingQueue({ status: req.query?.status || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}
