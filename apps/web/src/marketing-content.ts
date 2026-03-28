export const marketingNavItems = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" }
] as const;

export const marketingHero = {
  eyebrow: "Claritect",
  headline: "Ask your data anything.",
  subline:
    "Claritect gives you the power of a data analyst and a consulting team — available whenever you need insight, at a fraction of the cost.",
  proof: "From quick questions to full business cases — governed, auditable, always ready.",
  primaryCta: { href: "mailto:hello@claritect.ai?subject=Book%20a%20Claritect%20Live%20Pilot", label: "Book a Live Pilot" },
  secondaryCta: { href: "/pricing", label: "See Pricing" },
  tertiaryCta: { href: "/login", label: "Customer Login" }
} as const;

export const heroMetrics = [
  { value: "5x", label: "value delivered vs cost" },
  { value: "24/7", label: "insight on demand" },
  { value: "Same day", label: "question to report" },
  { value: "Any scope", label: "quick check to business case" }
] as const;

export const problemPanels = [
  {
    label: "The insight gap",
    title: "Great data, hard to unlock",
    body: "You have the data. Turning it into a clear, trustworthy answer takes time, skill, and context that isn't always available when you need it."
  },
  {
    label: "The access gap",
    title: "Good analysis shouldn't need a project",
    body: "A quick question shouldn't require a ticket, a sprint, or a week. Sometimes you just need to ask and get a straight answer."
  },
  {
    label: "The action gap",
    title: "Numbers need interpretation",
    body: "Dashboards show what happened. Understanding what it means — and what to do next — is where the real value lives."
  }
] as const;

export const shiftLayers = [
  {
    label: "Data",
    title: "What happened",
    body: "Rows, charts, and query results. The raw material — necessary, but not sufficient."
  },
  {
    label: "Insight",
    title: "What it means",
    body: "Trends, comparisons, and structured findings. The kind of analysis that takes hours to do well."
  },
  {
    label: "Intelligence",
    title: "What to do next",
    body: "Governed answers, actionable recommendations, and context that carries forward."
  }
] as const;

export const solutionStages = [
  {
    step: "01",
    title: "Ask in plain English",
    body: "Type any business question the way you'd ask a colleague. No SQL, no data requests, no prompt engineering."
  },
  {
    step: "02",
    title: "Governed analysis",
    body: "Claritect scopes the work, writes read-only SQL, and builds evidence you can trust and audit."
  },
  {
    step: "03",
    title: "Insight with actions",
    body: "Get findings, interpretation, and recommended next steps — not just numbers in a table."
  },
  {
    step: "04",
    title: "Run it again anytime",
    body: "Use it once for a quick answer. Schedule it for regular updates. Build on it for a full business case. Your call."
  }
] as const;

export const audienceTiles = [
  {
    role: "Finance",
    question: "What drove the margin shift this quarter — and what should we present to the board?"
  },
  {
    role: "Operations",
    question: "Which suppliers are consistently underperforming, and what's the cost impact?"
  },
  {
    role: "Product",
    question: "How has the latest release affected adoption, retention, and support volume?"
  },
  {
    role: "Strategy",
    question: "Build me a business case for expanding into the APAC market next quarter."
  }
] as const;

export const outcomeBullets = [
  "From quick questions to full business cases — one tool.",
  "Governed analysis you can trust and share across your team.",
  "Like having a data analyst and consultant available on demand.",
  "Scheduled insights, ad hoc deep dives, or one-off questions — your call."
] as const;

export const pricingPlans: ReadonlyArray<{
  name: string;
  price: string;
  cadence: string;
  summary: string;
  features: readonly string[];
  cta: string;
  featured?: boolean;
}> = [
  {
    name: "Starter",
    price: "$499",
    cadence: "/month",
    summary: "Like having a consultant on retainer. One data source, unlimited questions, executive-ready output.",
    features: [
      "One governed data source",
      "Unlimited on-demand analysis",
      "Executive-ready HTML reports",
      "Follow-up clarifications in chat"
    ],
    cta: "Start with Starter"
  },
  {
    name: "Growth",
    price: "$1,499",
    cadence: "/month",
    summary: "The analytical firepower of a consulting engagement — available every day. Multiple sources, scheduled insights, business cases.",
    features: [
      "Multiple governed sources",
      "Scheduled + on-demand reports",
      "Usage and AI balance visibility",
      "Business-case workflows"
    ],
    cta: "Start with Growth",
    featured: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    summary: "Multi-team rollout with admin control, custom entitlements, and dedicated support.",
    features: [
      "Admin console and team management",
      "Custom entitlements and limits",
      "Dedicated rollout support",
      "Enterprise SLA and support"
    ],
    cta: "Contact Sales"
  }
] as const;

export const benchmarkScenario = {
  label: "Based on typical executive analysis — 6 questions, same-day turnaround",
  bullets: [
    "1 executive-grade analysis",
    "6 scoped questions per run",
    "Same-day delivery",
    "Follow-up clarifications included",
    "Comparable consulting cost: $100/hour",
    "Self-serve AI tool stack: $120/month"
  ]
} as const;

export const benchmarkRows = [
  {
    approach: "Claritect",
    hours: "< 2 hrs",
    cost: "$499/month",
    timeToValue: "Same day",
    repeatability: "On-demand or scheduled",
    followUp: "Grounded clarifications with full context",
    governance: "Governed, read-only, auditable",
    efficiency: "5x value — available whenever you need it"
  },
  {
    approach: "Self-serve AI tools",
    hours: "10 hrs/month",
    cost: "$1,120/month",
    timeToValue: "Same day — manual cleanup needed",
    repeatability: "Manual prompt + query rework",
    followUp: "Context lost between sessions",
    governance: "Inconsistent, operator-dependent",
    efficiency: "Fast but requires significant hands-on work"
  },
  {
    approach: "External consultants",
    hours: "24 hrs/month",
    cost: "$2,400/month",
    timeToValue: "Days to a week",
    repeatability: "New engagement each time",
    followUp: "Re-briefing required",
    governance: "High quality but slow to iterate",
    efficiency: "Best for one-off projects, expensive for ongoing needs"
  }
] as const;

export const comparisonCards: ReadonlyArray<{
  name: string;
  cost: string;
  costNote: string;
  time: string;
  featured?: boolean;
  traits: ReadonlyArray<{ label: string; status: "yes" | "no" | "partial" }>;
}> = [
  {
    name: "Claritect",
    cost: "$499",
    costNote: "/month",
    time: "Same day",
    featured: true,
    traits: [
      { label: "Unlimited on-demand questions", status: "yes" },
      { label: "Context retained across follow-ups", status: "yes" },
      { label: "Governed and auditable", status: "yes" },
      { label: "Schedule recurring insights", status: "yes" },
      { label: "Business-case workflows", status: "yes" }
    ]
  },
  {
    name: "Self-serve AI tools",
    cost: "$1,120",
    costNote: "/month effective",
    time: "Same day, manual cleanup",
    traits: [
      { label: "Unlimited on-demand questions", status: "partial" },
      { label: "Context retained across follow-ups", status: "no" },
      { label: "Governed and auditable", status: "no" },
      { label: "Schedule recurring insights", status: "no" },
      { label: "Business-case workflows", status: "no" }
    ]
  },
  {
    name: "External consultants",
    cost: "$2,400",
    costNote: "/month typical",
    time: "Days to a week",
    traits: [
      { label: "Unlimited on-demand questions", status: "no" },
      { label: "Context retained across follow-ups", status: "no" },
      { label: "Governed and auditable", status: "partial" },
      { label: "Schedule recurring insights", status: "partial" },
      { label: "Business-case workflows", status: "yes" }
    ]
  }
];

export const benchmarkSavings = [
  { stat: "5x value", detail: "vs cost of Claritect", context: "Consulting-grade insight at a fraction of the cost." },
  { stat: "22 hrs freed", detail: "vs external consulting", context: "Time your team gets back to focus on the work that matters." },
  { stat: "Always ready", detail: "no scheduling needed", context: "Ask a question at any time — no engagement letter required." },
  { stat: "$1,901/mo saved", detail: "vs external consulting", context: "Over $22K annually — reinvest in growth, not reports." }
] as const;

export const narrativeSlides = [
  {
    eyebrow: "The question",
    title: "You have a question about your business.",
    body: "It could be a quick check on pipeline, a deep dive into churn, or a business case for the board. You shouldn't need a project to get an answer."
  },
  {
    eyebrow: "The ask",
    title: "Ask Claritect.",
    body: "Type it in plain English — the way you'd ask a sharp colleague. No SQL, no data requests, no waiting."
  },
  {
    eyebrow: "The answer",
    title: "Get insight, not just data.",
    body: "Governed analysis, clear findings, and recommended actions — ready to share across your team."
  },
  {
    eyebrow: "The payoff",
    title: "Use it for everything.",
    body: "Quick questions, scheduled updates, business cases, deep dives — Claritect grows with how you use it."
  }
] as const;

export const publicFooterText =
  "Claritect — your AI-powered data analyst and consultant, turning business questions into governed insight and recommended actions.";
