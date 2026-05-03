import {
  createNexoraDivisionObjective,
  createNexoraDurableTask,
  createNexoraMemoryGraphEdge,
  ensureNexoraDurableKernel,
  getNexoraDurableCommandSnapshot,
  upsertNexoraWorker,
  writeNexoraOperatingReport,
} from "../persistence/nexoraDurableKernel";
import { queryNexoraNeuralMemory } from "../strategy/nexoraStrategyCompiler";

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function registerNexoraAcademyWorkers() {
  await ensureNexoraDurableKernel();

  const workers = [
    {
      worker: "nexora_academy",
      area: "learning",
      capabilities: ["curriculum_generation", "worker_training", "playbook_training"],
    },
    {
      worker: "nexora_worker_examiner",
      area: "learning",
      capabilities: ["worker_skill_test", "knowledge_check", "safety_drill_score"],
    },
    {
      worker: "nexora_pattern_librarian",
      area: "learning",
      capabilities: ["pattern_library", "success_pattern_capture", "failure_pattern_capture"],
    },
  ];

  for (const worker of workers) {
    await upsertNexoraWorker({
      worker: worker.worker,
      area: worker.area,
      status: "idle",
      capabilities: worker.capabilities,
      metadata: {
        seededBy: "nexora_mega_build_18",
        nexoraBrain: true,
        registeredAt: now(),
      },
    });
  }

  await writeNexoraOperatingReport(
    "academy_workers",
    "info",
    "Nexora Academy workers registered",
    `Registered ${workers.length} academy workers.`,
    { workers }
  );

  return { ok: true, nexoraBrain: true, workers };
}

export function createNexoraTrainingModule(input: any = {}) {
  const moduleId = String(input.moduleId || id("module"));
  const topic = String(input.topic || "safe autonomous business operations");
  const targetWorker = String(input.targetWorker || "learning_worker");

  const lessons = [
    {
      title: "Nexora is the only brain",
      objective: "Workers execute delegated work and do not become separate decision authorities.",
    },
    {
      title: "Approval-gated execution",
      objective: "High-risk supplier, customer, trading, retirement, and production actions route to execution gate.",
    },
    {
      title: "Office furniture pipeline",
      objective: "Lead capture, quote draft, supplier confirmation, CRM next action, and project handover.",
    },
    {
      title: "Trading sandbox",
      objective: "Phantom X remains paper/sandbox unless explicitly promoted through approval.",
    },
    {
      title: "Learning loop",
      objective: "Capture success and failure patterns into durable memory and worker improvement tasks.",
    },
  ];

  return {
    ok: true,
    nexoraBrain: true,
    moduleId,
    topic,
    targetWorker,
    createdAt: now(),
    lessons,
    exam: lessons.map((lesson, index) => ({
      questionId: `${moduleId}_q_${index + 1}`,
      prompt: `Explain: ${lesson.objective}`,
      expectedSignal: lesson.title,
    })),
  };
}

export async function queueNexoraTraining(input: any = {}) {
  await ensureNexoraDurableKernel();
  await registerNexoraAcademyWorkers();

  const module = createNexoraTrainingModule(input);
  const memory = await queryNexoraNeuralMemory({
    subject: module.targetWorker,
    intent: "training_context",
  });

  const trainingTask = await createNexoraDurableTask({
    worker: "nexora_academy",
    area: "learning",
    action: "deliver_worker_training_module",
    risk: "safe",
    priority: 76,
    payload: { module, memory },
    source: "nexora.academy.training",
  });

  const examTask = await createNexoraDurableTask({
    worker: "nexora_worker_examiner",
    area: "learning",
    action: "score_worker_training_exam",
    risk: "safe",
    priority: 74,
    payload: { module },
    source: "nexora.academy.exam",
  });

  await createNexoraMemoryGraphEdge({
    sourceType: "training_module",
    sourceId: module.moduleId,
    relation: "improves",
    targetType: "worker",
    targetId: module.targetWorker,
    weight: 1.5,
    payload: module,
  });

  await createNexoraDivisionObjective({
    area: "learning",
    objective: `Train worker ${module.targetWorker} on ${module.topic}.`,
    metric: "training_module_completed",
    target: module.moduleId,
    ownerWorker: "nexora_academy",
    priority: 78,
    payload: module,
  });

  await writeNexoraOperatingReport(
    "academy_training",
    "info",
    "Nexora Academy training queued",
    `Training module ${module.moduleId} queued for ${module.targetWorker}.`,
    { module, memory, trainingTask, examTask }
  );

  return { ok: true, nexoraBrain: true, module, memory, trainingTask, examTask };
}

export async function getNexoraAcademyStatus() {
  await ensureNexoraDurableKernel();
  const snapshot = await getNexoraDurableCommandSnapshot();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_academy",
    capabilities: [
      "Training module generation",
      "Worker exams",
      "Pattern library",
      "Learning feedback loop",
    ],
    snapshot,
  };
}
