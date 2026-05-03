export function getNexoraCatalystCalendar(input: any = {}) {
  const now = new Date();
  const provided = Array.isArray(input.events) ? input.events : [];

  const defaults = [
    { name: "CPI / inflation release", category: "macro", importance: 0.9 },
    { name: "Federal Reserve / rates decision", category: "macro", importance: 0.95 },
    { name: "Major poll release", category: "politics", importance: 0.75 },
    { name: "Sports injury / lineup confirmation", category: "sports", importance: 0.8 },
    { name: "Court ruling / legal deadline", category: "politics", importance: 0.85 },
    { name: "Crypto ETF / unlock / exchange event", category: "crypto", importance: 0.8 },
    { name: "Earnings / company event", category: "markets", importance: 0.7 },
  ];

  const events = [...defaults, ...provided].map((e: any) => ({
    name: String(e.name || "Unnamed catalyst"),
    category: String(e.category || "general"),
    importance: Math.max(0, Math.min(1, Number(e.importance ?? 0.5))),
    expectedAt: e.expectedAt || null,
    tradeMode: Number(e.importance ?? 0.5) >= 0.8 ? "watch_reprice" : "observe",
  }));

  return {
    ok: true,
    service: "nexora_catalyst_calendar",
    paperOnly: true,
    now: now.toISOString(),
    events,
    rule: "Known catalysts trigger watch mode, repricing checks, and tighter risk controls.",
    updatedAt: new Date().toISOString(),
  };
}
