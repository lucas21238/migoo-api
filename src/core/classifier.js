const CHARACTER_REDIRECT_MAP = {
  nana: "Nana",
  jason: "Jason",
  cupid: "Cupido",
  arthur: "Arthur",
  walter: "Walter",
  gordon: "Gordon",
  lisa: "Lisa",
  ion9: "Ion9",
  sara: "Sara",
  agnes: "Agnes",
  oscar: "Oscar"
};

function normalizeText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getMessageLengthBucket(messageLength) {
  if (messageLength <= 20) return "ultra_short";
  if (messageLength <= 60) return "very_short";
  if (messageLength <= 140) return "short";
  if (messageLength <= 320) return "medium";
  if (messageLength <= 700) return "long";
  return "very_long";
}

function countKeywordHits(text, keywords = []) {
  if (!Array.isArray(keywords) || keywords.length === 0) return 0;

  return keywords.reduce((acc, keyword) => {
    return text.includes(normalizeText(keyword)) ? acc + 1 : acc;
  }, 0);
}

function inferImageMode(characterId) {
  const map = {
    nana: "food_estimation",
    jason: "fitness_analysis",
    oscar: "fashion_analysis",
    ion9: "technical_troubleshooting"
  };

  return map[characterId] || "scene_description";
}

function isGreeting(text) {
  const greetings = [
    "oi",
    "opa",
    "olá",
    "ola",
    "bom dia",
    "boa tarde",
    "boa noite",
    "e aí",
    "e ai",
    "fala",
    "hey",
    "hi",
    "hello"
  ];

  return greetings.some(
    (greeting) => text === greeting || text.startsWith(`${greeting} `)
  );
}

function isShortReaction(text) {
  const reactions = [
    "valeu",
    "obrigado",
    "obrigada",
    "show",
    "boa",
    "entendi",
    "saquei",
    "blz",
    "beleza",
    "perfeito",
    "fechou",
    "kkk",
    "haha",
    "hm"
  ];

  return reactions.includes(text);
}

function detectPatternSignals(text) {
  const patterns = {
    practical_guidance: [
      "como fazer",
      "como eu faço",
      "como preparar",
      "como montar",
      "como organizar",
      "como arrumar",
      "me ajuda a fazer",
      "passo a passo",
      "step by step"
    ],
    reassurance: [
      "isso faz sentido",
      "isso está certo",
      "isso tá certo",
      "isso parece certo",
      "isso é muito",
      "isso tá muito",
      "está exagerado",
      "ta exagerado",
      "tá exagerado",
      "é plausível",
      "é normal",
      "ta normal",
      "tá normal"
    ],
    opinion: [
      "o que você acha",
      "o que vc acha",
      "na sua opinião",
      "qual sua opinião",
      "vale a pena",
      "devo",
      "compensa"
    ],
    brief_explanation: [
      "me explica",
      "explica",
      "explique",
      "por que",
      "porque",
      "como funciona",
      "quero entender",
      "não entendi"
    ],
    reflection: [
      "eu acho que",
      "eu sinto que",
      "me parece que",
      "tenho pensado",
      "fico pensando",
      "não sei se",
      "talvez",
      "às vezes",
      "as vezes"
    ]
  };

  for (const [pattern, signals] of Object.entries(patterns)) {
    if (signals.some((signal) => text.includes(signal))) {
      return pattern;
    }
  }

  return null;
}

function inferPattern({
  character,
  text,
  hasImage,
  hasAudio,
  messageLength
}) {
  if (hasImage) return "direct_answer";
  if (hasAudio) return "direct_answer";

  if (isGreeting(text)) return "greeting";
  if (isShortReaction(text)) return "direct_answer";

  const explicitPattern = detectPatternSignals(text);
  if (explicitPattern) return explicitPattern;

  if (character?.id === "nana") {
    const cookingSignals = [
      "frango",
      "arroz",
      "receita",
      "molho",
      "empanar",
      "air fryer",
      "cozinha",
      "cozinhar",
      "jantar",
      "almoço",
      "almoco"
    ];

    if (cookingSignals.some((signal) => text.includes(signal))) {
      if (text.includes("como")) return "practical_guidance";
      if (text.includes("caloria") || text.includes("kcal")) return "reassurance";
      return "brief_explanation";
    }
  }

  if (character?.id === "jason") {
    const trainingSignals = [
      "treino",
      "academia",
      "supino",
      "peso",
      "cardio",
      "proteína",
      "proteina",
      "kcal",
      "série",
      "serie",
      "reps"
    ];

    if (trainingSignals.some((signal) => text.includes(signal))) {
      if (text.includes("como")) return "practical_guidance";
      if (
        text.includes("está certo") ||
        text.includes("tá certo") ||
        text.includes("faz sentido") ||
        text.includes("é normal")
      ) {
        return "reassurance";
      }
      return "brief_explanation";
    }
  }

  if (text.includes("?")) {
    return "direct_answer";
  }

  if (messageLength > 180) {
    return "reflection";
  }

  return "brief_explanation";
}

function inferInteractionMode(pattern, hasImage) {
  if (hasImage) return "image_analysis";

  const map = {
    greeting: "playful_entry",
    direct_answer: "quick_question",
    brief_explanation: "structured_explanation",
    reassurance: "verdict_mode",
    practical_guidance: "live_assistant",
    step_by_step_light: "teaching_mode",
    opinion: "verdict_mode",
    reflection: "deep_reflection"
  };

  return map[pattern] || "live_assistant";
}

function inferResponseDepth(character, pattern, messageLengthBucket, text) {
  const preferred = character?.config?.preferredDepth || "medium";

  const deepSignals = [
    "passo a passo",
    "me explica melhor",
    "explica melhor",
    "detalha",
    "detalhado",
    "mais a fundo",
    "em detalhes",
    "quero entender direito"
  ];

  const wantsDeep = deepSignals.some((signal) => text.includes(signal));

  if (wantsDeep) return "deep";

  if (pattern === "greeting") return "short";

  if (pattern === "direct_answer") {
    return messageLengthBucket === "ultra_short" || messageLengthBucket === "very_short"
      ? "short"
      : "medium";
  }

  if (pattern === "reassurance") {
    return messageLengthBucket === "medium" || messageLengthBucket === "long"
      ? "medium"
      : "short";
  }

  if (pattern === "practical_guidance") {
    if (text.includes("passo a passo")) return "deep";
    return "medium";
  }

  if (pattern === "reflection") {
    if (messageLengthBucket === "long" || messageLengthBucket === "very_long") {
      return "deep";
    }
    return preferred === "short" ? "medium" : preferred;
  }

  if (pattern === "opinion") {
    return messageLengthBucket === "long" ? "medium" : "short";
  }

  if (pattern === "brief_explanation") {
    if (messageLengthBucket === "long" || messageLengthBucket === "very_long") {
      return preferred === "deep" ? "deep" : "medium";
    }
    return preferred === "deep" ? "medium" : preferred;
  }

  return preferred;
}

function inferCompressionLevel(character, messageLengthBucket, pattern) {
  const tolerance = character?.config?.compressionTolerance || "low";

  if (pattern === "greeting") return "none";
  if (pattern === "direct_answer" && messageLengthBucket === "ultra_short") return "none";
  if (pattern === "direct_answer" && messageLengthBucket === "very_short") return "low";
  if (pattern === "reflection") return tolerance === "high" ? "medium" : "low";
  if (messageLengthBucket === "very_long") return tolerance === "high" ? "high" : "medium";
  if (messageLengthBucket === "long") return tolerance === "high" ? "medium" : "low";

  return "low";
}

function inferHistoryUsage(character, pattern, historyLength) {
  const baseline = Number(character?.config?.typicalHistoryUsage || 4);

  if (historyLength <= 0) {
    return {
      useRecentHistory: false,
      recentHistoryLimit: 0
    };
  }

  if (pattern === "greeting" || pattern === "direct_answer") {
    return {
      useRecentHistory: true,
      recentHistoryLimit: Math.min(2, historyLength)
    };
  }

  if (pattern === "reflection" || pattern === "opinion") {
    return {
      useRecentHistory: true,
      recentHistoryLimit: Math.min(Math.max(baseline, 6), historyLength)
    };
  }

  return {
    useRecentHistory: true,
    recentHistoryLimit: Math.min(baseline, historyLength)
  };
}

function inferMemoryUsage(pattern, domainStatus) {
  if (domainStatus === "hard_drift") {
    return { short: true, mid: false, long: false };
  }

  if (pattern === "greeting" || pattern === "direct_answer") {
    return { short: true, mid: false, long: true };
  }

  if (pattern === "reflection" || pattern === "opinion") {
    return { short: true, mid: true, long: true };
  }

  return { short: true, mid: true, long: true };
}

function inferOutputTokenLimit(pattern, responseDepth) {
  if (pattern === "greeting") return 120;
  if (pattern === "direct_answer") return responseDepth === "short" ? 140 : 220;
  if (pattern === "reassurance") return responseDepth === "short" ? 220 : 280;
  if (pattern === "practical_guidance") return responseDepth === "deep" ? 500 : 320;
  if (pattern === "step_by_step_light") return 380;
  if (pattern === "opinion") return responseDepth === "deep" ? 320 : 220;
  if (pattern === "reflection") return responseDepth === "deep" ? 550 : 320;
  if (pattern === "brief_explanation") return responseDepth === "deep" ? 420 : 260;

  return 220;
}

function inferDomainStatus(character, text) {
  const hits = countKeywordHits(text, character?.config?.domainKeywords || []);

  if (hits >= 2) return "in_domain";
  if (hits === 1) return "soft_drift";
  if (text.length <= 20) return "soft_drift";

  return "hard_drift";
}

function inferRedirectCharacter(characterId, text, domainStatus) {
  if (domainStatus !== "hard_drift") return null;

  const signals = [
    {
      match: ["business", "startup", "pricing", "cac", "mrr", "saas", "empresa", "negócio", "negocio", "produto"],
      redirect: "Gordon"
    },
    {
      match: ["filosofia", "história", "historia", "meaning", "sociedade", "ethics", "império", "imperio", "política", "politica"],
      redirect: "Arthur"
    },
    {
      match: ["dinheiro", "investimento", "budget", "finance", "salário", "salario", "salary", "renda", "gasto", "dívida", "divida"],
      redirect: "Walter"
    },
    {
      match: ["academia", "treino", "gym", "cardio", "muscle", "peso", "proteína", "proteina", "kcal"],
      redirect: "Jason"
    },
    {
      match: ["comida", "receita", "cozinhar", "ingredient", "meal", "kitchen", "frango", "molho", "air fryer"],
      redirect: "Nana"
    },
    {
      match: ["namoro", "crush", "relationship", "date", "flert", "ciúme", "ciume", "love", "relacionamento"],
      redirect: "Cupido"
    },
    {
      match: ["fashion", "roupa", "look", "estilo", "visual", "cabelo", "barba", "perfume"],
      redirect: "Oscar"
    },
    {
      match: ["science", "technical", "bug", "engine", "physics", "código técnico", "celular", "internet", "computador", "ciência", "ciencia"],
      redirect: "Ion9"
    },
    {
      match: ["filme", "série", "serie", "jogo", "música", "musica", "celebridade", "cultura pop"],
      redirect: "Lisa"
    },
    {
      match: ["notícia", "noticia", "presidente", "guerra", "eleição", "eleicao", "geopolítica", "geopolitica", "mundo"],
      redirect: "Sara"
    },
    {
      match: ["matemática", "matematica", "gramática", "gramatica", "estudar", "prova", "exercício", "exercicio", "escola"],
      redirect: "Agnes"
    }
  ];

  for (const rule of signals) {
    const hit = rule.match.some((term) => text.includes(term));
    if (hit) return rule.redirect;
  }

  return CHARACTER_REDIRECT_MAP[characterId] || null;
}

function inferTemporalFlags(timestamp, shortState) {
  const now = timestamp ? new Date(timestamp) : new Date();
  const state = normalizeText(shortState);

  return {
    isValidTimestamp: !Number.isNaN(now.getTime()),
    suggestsFreshSession:
      !state ||
      state.includes("no short state") ||
      state.includes("new session") ||
      state.includes("idle")
  };
}

export function classifyMessage({
  character,
  userMessage,
  hasImage = false,
  hasAudio = false,
  history = [],
  shortState = "",
  timestamp = new Date().toISOString()
}) {
  const text = normalizeText(userMessage);
  const historyLength = Array.isArray(history) ? history.length : 0;
  const messageLength = text.length;
  const messageLengthBucket = getMessageLengthBucket(messageLength);

  const temporalFlags = inferTemporalFlags(timestamp, shortState);
  const domainStatus = inferDomainStatus(character, text);

  const pattern = inferPattern({
    character,
    text,
    hasImage,
    hasAudio,
    messageLength
  });

  const interactionMode = inferInteractionMode(pattern, hasImage);

  const responseDepth = inferResponseDepth(
    character,
    pattern,
    messageLengthBucket,
    text
  );

  const inputCompression = inferCompressionLevel(
    character,
    messageLengthBucket,
    pattern
  );

  const historyUsage = inferHistoryUsage(character, pattern, historyLength);

  const memoryUsage = inferMemoryUsage(pattern, domainStatus);

  const redirectCharacter = inferRedirectCharacter(
    character.id,
    text,
    domainStatus
  );

  const imageMode = hasImage ? inferImageMode(character.id) : null;

  const outputTokenLimit = inferOutputTokenLimit(
    pattern,
    responseDepth
  );

  return {
    interactionMode,
    pattern,
    responseDepth,
    inputCompression,
    useRecentHistory: historyUsage.useRecentHistory,
    recentHistoryLimit: historyUsage.recentHistoryLimit,
    memoryUsage,
    domainStatus,
    redirectCharacter,
    imageMode,
    outputTokenLimit,
    meta: {
      timestamp,
      messageLength,
      messageLengthBucket,
      temporalFlags,
      hasAudio,
      shortState
    }
  };
}
