import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("teaching", "journal", "teaching-journal.jsonl");
const SKILL_LOG = nexoraLocalPath("teaching", "skills", "skill-log.jsonl");
const GAP_LOG = nexoraLocalPath("teaching", "gaps", "gap-log.jsonl");
const LESSON_LOG = nexoraLocalPath("teaching", "lessons", "lesson-log.jsonl");
const EXAMPLE_LOG = nexoraLocalPath("teaching", "examples", "example-log.jsonl");
const PLAYBOOK_LOG = nexoraLocalPath("teaching", "playbooks", "playbook-log.jsonl");
const TRAINING_LOG = nexoraLocalPath("teaching", "training", "training-log.jsonl");
const QUEUE_LOG = nexoraLocalPath("teaching", "queue", "teaching-queue.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function normaliseSkill(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const defaultSkills = [
  {
    skillKey: "lead_intake",
    name: "Lead intake",
    division: "office_sales",
    confidence: 80,
    description: "Capture customer/company/contact/need/budget/timeline/location.",
  },
  {
    skillKey: "quote_drafting",
    name: "Quote drafting",
    division: "quotes",
    confidence: 75,
    description: "Prepare draft quotes, GST, margin, assumptions, approval flags.",
  },
  {
    skillKey: "supplier_request",
    name: "Supplier request",
    division: "procurement",
    confidence: 75,
    description: "Prepare non-binding supplier requests for price, stock, lead time, warranty.",
  },
  {
    skillKey: "crm_followup",
    name: "CRM follow-up",
    division: "crm",
    confidence: 80,
    description: "Prepare customer follow-up drafts and next actions.",
  },
  {
    skillKey: "fitout_scope",
    name: "Fitout scope",
    division: "fitouts",
    confidence: 70,
    description: "Capture site/access/install constraints and project risks.",
  },
  {
    skillKey: "project_handover",
    name: "Project handover",
    division: "projects",
    confidence: 70,
    description: "Turn approved quotes into project stages and handover packs.",
  },
  {
    skillKey: "human_boundary",
    name: "Human boundary",
    division: "safety",
    confidence: 95,
    description: "Humans only approve, sign, commit. Nexora does everything else.",
  },
];

export function seedNexoraSkillRegistry() {
  const created = defaultSkills.map((skill) => createNexoraSkill(skill));

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_skill_registry_seed",
    created,
  };
}

export function createNexoraSkill(input: any = {}) {
  const skillKey = normaliseSkill(String(input.skillKey || input.name || nexoraLocalId("skill")));

  const skill = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_skill",
    skillKey,
    name: String(input.name || skillKey),
    division: String(input.division || "general"),
    confidence: Math.max(0, Math.min(100, Number(input.confidence ?? 30))),
    description: String(input.description || "Nexora skill"),
    examples: Array.isArray(input.examples) ? input.examples : [],
    playbooks: Array.isArray(input.playbooks) ? input.playbooks : [],
    createdAt: now(),
    updatedAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("teaching", "skills", `${skillKey}.json`), skill);

  appendNexoraJsonl(SKILL_LOG, {
    event: "skill.created",
    skill,
    createdAt: now(),
  });

  journal("skill.created", skill);

  return {
    ok: true,
    nexoraBrain: true,
    skill,
  };
}

export function listNexoraSkills(input: any = {}) {
  const division = input.division ? String(input.division) : "";
  const limit = Number(input.limit || 200);

  const rows = readNexoraJsonl(SKILL_LOG)
    .filter((row: any) => row.event === "skill.created")
    .map((row: any) => row.skill)
    .filter((skill: any) => !division || skill.division === division)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function assessNexoraCapability(input: any = {}) {
  const task = String(input.task || input.action || input.name || "");
  const division = String(input.division || input.area || "general");
  const text = `${task} ${JSON.stringify(input.payload || {})}`.toLowerCase();

  const skills = listNexoraSkills({ limit: 1000 }).rows;

  const matches = skills
    .map((skill: any) => {
      const keyMatch = text.includes(String(skill.skillKey).replace(/_/g, " "));
      const nameMatch = text.includes(String(skill.name).toLowerCase());
      const divisionMatch = skill.division === division;
      const confidence = Number(skill.confidence || 0);

      const score =
        (keyMatch ? 40 : 0) +
        (nameMatch ? 40 : 0) +
        (divisionMatch ? 10 : 0) +
        confidence * 0.1;

      return {
        skill,
        score,
      };
    })
    .filter((row: any) => row.score > 0)
    .sort((a: any, b: any) => b.score - a.score);

  const best = matches[0] || null;
  const confidence = best ? Math.round(best.score) : 0;
  const knowsHow = confidence >= 45;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_capability_assessment",
    task,
    division,
    knowsHow,
    confidence,
    bestSkill: best?.skill || null,
    matches: matches.slice(0, 10),
    recommendation: knowsHow
      ? "Nexora can proceed to prepare this task using existing skills."
      : "Nexora should create a knowledge gap and lesson before attempting this task.",
  };
}

export function createNexoraKnowledgeGap(input: any = {}) {
  const gapId = String(input.gapId || nexoraLocalId("gap"));
  const task = String(input.task || input.action || "unknown_task");
  const division = String(input.division || input.area || "general");

  const assessment = assessNexoraCapability({
    task,
    division,
    payload: input.payload || {},
  });

  const gap = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_knowledge_gap",
    gapId,
    task,
    division,
    status: "open",
    reason: String(input.reason || "Nexora does not yet have enough confidence to perform this task."),
    assessment,
    payload: input.payload || {},
    createdAt: now(),
    safety: {
      doNotGuess: true,
      learnBeforeActing: true,
      humanCanTeach: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("teaching", "gaps", `${gapId}.json`), gap);

  appendNexoraJsonl(GAP_LOG, {
    event: "gap.created",
    gap,
    createdAt: now(),
  });

  createNexoraTeachingQueueItem({
    type: "knowledge_gap",
    title: `Teach Nexora: ${task}`,
    priority: 80,
    payload: gap,
  });

  journal("gap.created", gap);

  recordNexoraTimelineEvent({
    type: "knowledge_gap",
    title: `Nexora knowledge gap: ${task}`,
    severity: "warning",
    payload: {
      gapId,
      task,
      division,
    },
  });

  return {
    ok: true,
    nexoraBrain: true,
    gap,
  };
}

export function createNexoraLesson(input: any = {}) {
  const lessonId = String(input.lessonId || nexoraLocalId("lesson"));
  const skillKey = normaliseSkill(String(input.skillKey || input.task || input.title || "general_lesson"));

  const lesson = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_lesson",
    lessonId,
    skillKey,
    title: String(input.title || `How to do ${skillKey}`),
    division: String(input.division || "general"),
    objective: String(input.objective || "Teach Nexora how to complete this task safely."),
    steps: Array.isArray(input.steps) ? input.steps : [
      "Understand the request.",
      "Gather required context.",
      "Check policy and human boundary.",
      "Prepare the work product.",
      "Hold approval/sign/commit actions for humans.",
      "Record result and learn from feedback.",
    ],
    requiredInputs: Array.isArray(input.requiredInputs) ? input.requiredInputs : [],
    expectedOutput: input.expectedOutput || {},
    humanBoundary: [
      "approve",
      "sign",
      "commit",
    ],
    examples: Array.isArray(input.examples) ? input.examples : [],
    createdAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("teaching", "lessons", `${lessonId}.json`), lesson);

  appendNexoraJsonl(LESSON_LOG, {
    event: "lesson.created",
    lesson,
    createdAt: now(),
  });

  journal("lesson.created", lesson);

  return {
    ok: true,
    nexoraBrain: true,
    lesson,
  };
}

export function captureNexoraTeachingExample(input: any = {}) {
  const exampleId = String(input.exampleId || nexoraLocalId("example"));
  const skillKey = normaliseSkill(String(input.skillKey || input.task || "general"));

  const example = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_teaching_example",
    exampleId,
    skillKey,
    title: String(input.title || "Teaching example"),
    before: input.before || null,
    humanInstruction: input.humanInstruction || input.instruction || "",
    expectedBehaviour: input.expectedBehaviour || "",
    goodOutput: input.goodOutput || null,
    badOutput: input.badOutput || null,
    notes: input.notes || "",
    createdAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("teaching", "examples", `${exampleId}.json`), example);

  appendNexoraJsonl(EXAMPLE_LOG, {
    event: "example.captured",
    example,
    createdAt: now(),
  });

  journal("example.captured", example);

  return {
    ok: true,
    nexoraBrain: true,
    example,
  };
}

export function convertNexoraLessonToPlaybook(input: any = {}) {
  const playbookId = String(input.playbookId || nexoraLocalId("teaching_playbook"));
  const lessonId = String(input.lessonId || "");
  const skillKey = normaliseSkill(String(input.skillKey || "general"));

  const lesson = lessonId
    ? readNexoraJson(nexoraLocalPath("teaching", "lessons", `${lessonId}.json`), null)
    : null;

  const playbook = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_teaching_playbook",
    playbookId,
    lessonId: lesson?.lessonId || null,
    skillKey: lesson?.skillKey || skillKey,
    title: input.title || lesson?.title || `Playbook for ${skillKey}`,
    steps: input.steps || lesson?.steps || [
      "Gather context.",
      "Run policy check.",
      "Prepare draft.",
      "Hold human-only actions.",
      "Record result.",
    ],
    createdAt: now(),
    safety: {
      humansOnlyApproveSignCommit: true,
      nexoraDoesEverythingElse: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("teaching", "playbooks", `${playbookId}.json`), playbook);

  appendNexoraJsonl(PLAYBOOK_LOG, {
    event: "playbook.created",
    playbook,
    createdAt: now(),
  });

  createNexoraSkill({
    skillKey: playbook.skillKey,
    name: playbook.title,
    division: input.division || lesson?.division || "general",
    confidence: Number(input.confidence || 60),
    playbooks: [playbookId],
  });

  journal("playbook.created", playbook);

  return {
    ok: true,
    nexoraBrain: true,
    playbook,
  };
}

export function createNexoraWorkerTrainingRecord(input: any = {}) {
  const trainingId = String(input.trainingId || nexoraLocalId("training"));
  const worker = String(input.worker || "nexora_worker");
  const skillKey = normaliseSkill(String(input.skillKey || "general"));

  const record = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_worker_training_record",
    trainingId,
    worker,
    skillKey,
    playbookId: input.playbookId || null,
    status: String(input.status || "trained"),
    score: Math.max(0, Math.min(100, Number(input.score || 70))),
    notes: input.notes || "",
    createdAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("teaching", "training", `${trainingId}.json`), record);

  appendNexoraJsonl(TRAINING_LOG, {
    event: "training.created",
    record,
    createdAt: now(),
  });

  journal("training.created", record);

  recordNexoraMetric({
    name: "nexora_worker_training_score",
    value: record.score,
    unit: "score",
    dimensions: {
      worker,
      skillKey,
    },
  });

  return {
    ok: true,
    nexoraBrain: true,
    record,
  };
}

export function createNexoraTeachingQueueItem(input: any = {}) {
  const queueId = String(input.queueId || nexoraLocalId("teach_queue"));

  const item = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_teaching_queue_item",
    queueId,
    type: String(input.type || "teaching_request"),
    title: String(input.title || "Teach Nexora"),
    priority: Number(input.priority || 50),
    status: "open",
    payload: input.payload || {},
    createdAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("teaching", "queue", `${queueId}.json`), item);

  appendNexoraJsonl(QUEUE_LOG, {
    event: "teaching_queue.created",
    item,
    createdAt: now(),
  });

  journal("teaching_queue.created", item);

  return {
    ok: true,
    nexoraBrain: true,
    item,
  };
}

export function listNexoraTeachingQueue(input: any = {}) {
  const status = input.status ? String(input.status) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(QUEUE_LOG)
    .filter((row: any) => row.event === "teaching_queue.created")
    .map((row: any) => row.item)
    .filter((item: any) => !status || item.status === status)
    .sort((a: any, b: any) => Number(b.priority || 0) - Number(a.priority || 0))
    .slice(0, limit);

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function listNexoraLessons(input: any = {}) {
  const skillKey = input.skillKey ? normaliseSkill(String(input.skillKey)) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(LESSON_LOG)
    .filter((row: any) => row.event === "lesson.created")
    .map((row: any) => row.lesson)
    .filter((lesson: any) => !skillKey || lesson.skillKey === skillKey)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraTeachingStatus() {
  const skills = listNexoraSkills({ limit: 1000 });
  const gaps = readNexoraJsonl(GAP_LOG).filter((row: any) => row.event === "gap.created");
  const lessons = listNexoraLessons({ limit: 1000 });
  const queue = listNexoraTeachingQueue({ status: "open", limit: 1000 });
  const training = readNexoraJsonl(TRAINING_LOG).filter((row: any) => row.event === "training.created");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_teach_herself_company",
    generatedAt: now(),
    counts: {
      skills: skills.count,
      gaps: gaps.length,
      lessons: lessons.count,
      openTeachingQueue: queue.count,
      trainingRecords: training.length,
    },
    doctrine: "If Nexora does not know how to do something, she must identify the gap, create a lesson, request examples if needed, convert the lesson to a playbook, train the worker, then proceed.",
    safety: {
      doNotGuessWhenConfidenceLow: true,
      humansOnlyApproveSignCommit: true,
      nexoraDoesEverythingElse: true,
    },
  };
}
