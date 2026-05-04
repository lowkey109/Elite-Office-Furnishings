import type { Express } from "express";
import fs from "fs";
import path from "path";

type R = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "learning-memory");
const STATE = path.join(ROOT, "state.json");
const EVENTS = path.join(ROOT, "events.jsonl");
const LESSONS = path.join(ROOT, "lessons.jsonl");
const PLAYBOOK = path.join(ROOT, "playbook.json");

function now() {
  return new Date().toISOString();
}

function ensure() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safety() {
  return {
    learnsFrom: ["paper_trading", "risk_outcomes", "quote_outcomes", "human_feedback"],
    liveTradingEnabledNow: false,
    autonomousMoneyMovement: false,
    autonomousBindingQuotes: false,
    autonomousEmailSending: false,
    humanApprovalRequired: true,
  };
}

function readJson(file: string, fallback: R): R {
  ensure();
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  return fallback;
}

function writeJson(file: string, value: R) {
  ensure();
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function append(file: string, value: R) {
  ensure();
  fs.appendFileSync(file, JSON.stringify(value) + "\n");
}

function readState(): R {
  return readJson(STATE, {
    ok: true,
    service: "nexora_learning_memory_state",
    createdAt: now(),
    updatedAt: now(),
    events: 0,
    lessons: 0,
    playbookUpdates: 0,
    recommendations: 0,
    latestEvent: null,
    latestLesson: null,
    latestRecommendation: null,
    status: "ready",
    safety: safety(),
  });
}

function saveState(patch: R): R {
  const next = {
    ...readState(),
    ...patch,
    updatedAt: now(),
    safety: safety(),
  };
  writeJson(STATE, next);
  return next;
}

function readLines(file: string, limit = 50): R[] {
  ensure();
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .slice(-limit)
    .map((line) => {
      try { return JSON.parse(line); } catch { return { badLine: true, line }; }
    });
}

function scoreEvent(input: R): R {
  const domain = String(input.domain || "general");
  const result = String(input.result || "unknown");
  const approved = input.humanApproved === true;
  const rejected = input.humanRejected === true;
  const pnl = Number(input.pnl || 0);
  const margin = Number(input.margin || 0);
  const riskTriggered = input.riskTriggered === true;

  let score = 50;

  if (result.includes("win") || result.includes("success")) score += 20;
  if (result.includes("loss") || result.includes("fail")) score -= 20;
  if (approved) score += 10;
  if (rejected) score -= 15;
  if (pnl > 0) score += Math.min(20, Math.round(pnl));
  if (pnl < 0) score -= Math.min(20, Math.abs(Math.round(pnl)));
  if (margin > 0) score += Math.min(15, Math.round(margin));
  if (riskTriggered) score -= 10;

  score = Math.max(0, Math.min(100, score));

  return {
    domain,
    score,
    grade: score >= 75 ? "good" : score >= 50 ? "neutral" : "bad",
    shouldRepeat: score >= 70,
    shouldAvoid: score < 40,
    needsHumanReview: rejected || riskTriggered || domain.includes("real_money"),
  };
}

function recordEvent(input: R): R {
  const id = `event-${Date.now()}`;
  const scored = scoreEvent(input);

  const event = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_learning_memory_event",
    id,
    generatedAt: now(),
    domain: input.domain || "general",
    product: input.product || "nexora",
    action: input.action || "unknown_action",
    result: input.result || "unknown_result",
    metrics: input.metrics || {},
    scored,
    raw: input,
    safety: safety(),
  };

  append(EVENTS, event);

  const state = readState();
  const next = saveState({
    status: "event_recorded",
    events: Number(state.events || 0) + 1,
    latestEvent: event,
  });

  return { ...event, state: next };
}

function createLesson(input: R): R {
  const event = input.event || readState().latestEvent || {};
  const scored = event.scored || scoreEvent(event);

  const lesson = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_learning_memory_lesson",
    id: `lesson-${Date.now()}`,
    generatedAt: now(),
    domain: event.domain || input.domain || "general",
    product: event.product || input.product || "nexora",
    lessonType: scored.shouldRepeat ? "repeat_pattern" : scored.shouldAvoid ? "avoid_pattern" : "watch_pattern",
    summary: scored.shouldRepeat
      ? "This action performed well. Prefer similar conditions next time."
      : scored.shouldAvoid
        ? "This action performed poorly or triggered risk. Avoid or require human review."
        : "This action was neutral. Keep monitoring before promoting.",
    action: event.action || input.action || "unknown_action",
    result: event.result || input.result || "unknown_result",
    score: scored.score,
    recommendation: scored.needsHumanReview
      ? "require_human_review"
      : scored.shouldRepeat
        ? "increase_priority"
        : scored.shouldAvoid
          ? "decrease_priority"
          : "keep_testing",
    safety: safety(),
  };

  append(LESSONS, lesson);

  const state = readState();
  const next = saveState({
    status: "lesson_created",
    lessons: Number(state.lessons || 0) + 1,
    latestLesson: lesson,
  });

  return { ...lesson, state: next };
}

function updatePlaybook(input: R): R {
  const lessons = readLines(LESSONS, 100);
  const current = readJson(PLAYBOOK, {
    ok: true,
    service: "nexora_learning_memory_playbook",
    createdAt: now(),
    updatedAt: now(),
    domains: {},
    safety: safety(),
  });

  const domains = current.domains || {};

  for (const lesson of lessons) {
    const domain = lesson.domain || "general";
    if (!domains[domain]) {
      domains[domain] = {
        goodPatterns: [],
        avoidPatterns: [],
        watchPatterns: [],
        lastUpdated: now(),
      };
    }

    const entry = {
      lessonId: lesson.id,
      action: lesson.action,
      result: lesson.result,
      score: lesson.score,
      recommendation: lesson.recommendation,
      generatedAt: lesson.generatedAt,
    };

    if (lesson.lessonType === "repeat_pattern") domains[domain].goodPatterns.push(entry);
    else if (lesson.lessonType === "avoid_pattern") domains[domain].avoidPatterns.push(entry);
    else domains[domain].watchPatterns.push(entry);

    domains[domain].goodPatterns = domains[domain].goodPatterns.slice(-20);
    domains[domain].avoidPatterns = domains[domain].avoidPatterns.slice(-20);
    domains[domain].watchPatterns = domains[domain].watchPatterns.slice(-20);
    domains[domain].lastUpdated = now();
  }

  const playbook = {
    ...current,
    updatedAt: now(),
    domains,
    requested: input,
    safety: safety(),
  };

  writeJson(PLAYBOOK, playbook);

  const state = readState();
  const next = saveState({
    status: "playbook_updated",
    playbookUpdates: Number(state.playbookUpdates || 0) + 1,
  });

  return { ...playbook, state: next };
}

function recommendNext(input: R): R {
  const playbook = readJson(PLAYBOOK, { domains: {} });
  const domain = String(input.domain || "polymarket");
  const d = playbook.domains?.[domain] || {
    goodPatterns: [],
    avoidPatterns: [],
    watchPatterns: [],
  };

  const recommendation = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_learning_memory_recommend_next",
    id: `recommendation-${Date.now()}`,
    generatedAt: now(),
    domain,
    product: input.product || (domain === "office" ? "The Corporate Desk" : "Phantom X"),
    recommendation: d.goodPatterns.length
      ? "Prefer actions similar to the strongest good patterns, but keep human approval gates."
      : "Keep learning. Not enough positive evidence yet.",
    use: {
      prefer: d.goodPatterns.slice(-5),
      avoid: d.avoidPatterns.slice(-5),
      watch: d.watchPatterns.slice(-5),
    },
    nextAction: domain === "office"
      ? "draft_quote_or_supplier_pack_with_human_approval"
      : "draft_trade_intent_or_run_more_replay_with_human_approval",
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "recommendation_generated",
    recommendations: Number(state.recommendations || 0) + 1,
    latestRecommendation: recommendation,
  });

  return { ...recommendation, state: next };
}

function runCycle(input: R): R {
  const event = recordEvent(input);
  const lesson = createLesson({ event });
  const playbook = updatePlaybook({ source: "cycle" });
  const recommendation = recommendNext({
    domain: input.domain || event.domain,
    product: input.product || event.product,
  });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_learning_memory_cycle",
    id: `learning-cycle-${Date.now()}`,
    generatedAt: now(),
    completed: [
      "event_recorded",
      "lesson_created",
      "playbook_updated",
      "next_action_recommended",
    ],
    event: { id: event.id, score: event.scored.score, grade: event.scored.grade },
    lesson: { id: lesson.id, type: lesson.lessonType, recommendation: lesson.recommendation },
    playbook: { updatedAt: playbook.updatedAt },
    recommendation: { id: recommendation.id, nextAction: recommendation.nextAction },
    safety: safety(),
  };
}

export function registerNexoraLearningMemoryRoutes(app: Express): void {
  app.get("/api/nexora/learning-memory/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_learning_memory_status",
      generatedAt: now(),
      state: readState(),
      recentEvents: readLines(EVENTS, 5),
      recentLessons: readLines(LESSONS, 5),
      safety: safety(),
    });
  });

  app.post("/api/nexora/learning-memory/record", (req, res) => {
    res.json(recordEvent((req.body || {}) as R));
  });

  app.post("/api/nexora/learning-memory/lesson", (req, res) => {
    res.json(createLesson((req.body || {}) as R));
  });

  app.post("/api/nexora/learning-memory/playbook", (req, res) => {
    res.json(updatePlaybook((req.body || {}) as R));
  });

  app.post("/api/nexora/learning-memory/recommend-next", (req, res) => {
    res.json(recommendNext((req.body || {}) as R));
  });

  app.post("/api/nexora/learning-memory/cycle", (req, res) => {
    res.json(runCycle((req.body || {}) as R));
  });
}
