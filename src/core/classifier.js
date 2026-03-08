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
  return String(text || "").trim().toLowerCase();
}

function getMessageLengthBucket(messageLength) {
  if (messageLength <= 40) return "very_short";
  if (messageLength <= 120) return "short";
  if (messageLength <= 320) return "medium";
  if (messageLength <= 700) return "long";
  return "very_long";
}

function countKeywordHits(text, keywords = []) {
  if (!Array.isArray(keywords) || keywords.length === 0) return 0;
  return keywords.reduce((acc, keyword) => {
    return text.includes(String(keyword).toLowerCase()) ? acc + 1 : acc;
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

function inferInteractionMode({
  character,
  text,
  hasImage,
  hasAudio,
  messageLength,
  shortState
}) {
  if (hasImage) return "image_analysis";
  if (hasAudio) return "live_assistant";

  const combinedState = normalizeText(shortState);
  const isQuestion =
    text.includes("?") ||
    text.startsWith("como") ||
    text.startsWith("what") ||
    text.startsWith("why") ||
    text.startsWith("por que");

  const wantsVerdict =
    text.includes("vale a pena") ||
    text.includes("faz sentido") ||
    text.includes("devo") ||
    text.includes("should i") ||
    text.includes("worth it");

  const wantsTeaching =
    text.includes("me explica") ||
    text.includes("explique") ||
    text.includes("explain") ||
    text.includes("how does") ||
    text.includes("como funciona");

  const playfulEntry =
    messageLength <= 20 &&
    (text.includes("oi") ||
      text.includes("hey") ||
      text.includes("fala") ||
      text.includes("e aí") ||
      text.includes("opa"));

  const reflectionSignals =
    text.includes("acho que") ||
    text.includes("sinto que") ||
    text.includes("tenho pensado") ||
    text.includes("meaning") ||
    text.includes("sentido") ||
    messageLength > 420;

  if (wantsVerdict) return "verdict_mode";
  if (wantsTeaching) return "teaching_mode";
  if (playfulEntry) return "playful_entry";
  if (reflectionSignals) return "deep_reflection";

  if (
    character.id === "nana" &&
    (combinedState.includes("cooking") ||
      text.includes("ingrediente") ||
      text.includes("frango") ||
      text.includes("arroz") ||
      text.includes("recipe") ||
      text.includes("receita"))
  ) {
    return "live_assistant";
  }

  if (
    character.id === "jason" &&
    (combinedState.includes("workout") ||
      text.includes("treino") ||
      text.includes("academia") ||
      text.includes("série") ||
      text.includes("exercise") ||
      text.includes("gym"))
  ) {
    return "live_training";
  }

  if (isQuestion && messageLength < 180) return "quick_question";
  if (messageLength > 240) return "structured_explanation";

  return "live_assistant";
}

function inferResponseDepth(character, interactionMode, messageLengthBucket) {
  const preferred = character?.config?.preferredDepth || "short";

  if (
    interactionMode === "deep_reflection" ||
    interactionMode === "teaching_mode" ||
    interactionMode === "structured_explanation"
  ) {
    return preferred === "short" ? "medium" : preferred === "medium" ? "medium" : "deep";
  }

  if (interactionMode === "quick_question" || interactionMode === "playful_entry") {
    return "short";
  }

  if (interactionMode === "verdict_mode") {
    return preferred === "deep" ? "medium" : preferred;
  }

  if (messageLengthBucket === "very_long") return "deep";
  if (messageLengthBucket === "long") return preferred === "short" ? "medium" : preferred;

  return preferred;
}

function inferCompressionLevel(character, messageLengthBucket, interactionMode) {
  const tolerance = character?.config?.compressionTolerance || "low";

  if (interactionMode === "deep_reflection" || interactionMode === "teaching_mode") {
    return tolerance === "high" ? "medium" : "low";
  }

  if (messageLengthBucket === "very_short") return "none";
  if (messageLengthBucket === "short") return "low";
  if (messageLengthBucket === "medium") return "low";
  if (messageLengthBucket === "long") return tolerance === "high" ? "medium" : "low";
  return tolerance === "high" ? "high" : "medium";
}

function inferHistoryUsage(character, interactionMode, historyLength) {
  const baseline = Number(character?.config?.typicalHistoryUsage || 4);

  if (historyLength <= 0) {
    return { useRecentHistory: false, recentHistoryLimit: 0 };
  }

  if (interactionMode === "quick_question" || interactionMode === "playful_entry") {
    return {
      useRecentHistory: true,
      recentHistoryLimit: Math.min(2, historyLength)
    };
  }

  if (
    interactionMode === "deep_reflection" ||
    interactionMode === "verdict_mode" ||
    interactionMode === "teaching_mode"
  ) {
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

function inferMemoryUsage(interactionMode, domainStatus) {
  if (domainStatus === "hard_drift") {
    return { short: true, mid: false, long: false };
  }

  if (interactionMode === "quick_question" || interactionMode === "playful_entry") {
    return { short: true, mid: false, long: true };
  }

  if (
    interactionMode === "deep_reflection" ||
    interactionMode === "verdict_mode" ||
    interactionMode === "teaching_mode"
  ) {
    return { short: true, mid: true, long: true };
  }

  return { short: true, mid: true, long: true };
}

function inferOutputTokenLimit(responseDepth, interactionMode) {
  if (interactionMode === "playful_entry") return 40;
  if (interactionMode === "quick_question") return responseDepth === "short" ? 80 : 120;
  if (interactionMode === "verdict_mode") return 120;
  if (interactionMode === "teaching_mode") return responseDepth === "deep" ? 220 : 160;
  if (interactionMode === "deep_reflection") return responseDepth === "deep" ? 260 : 180;

  if (responseDepth === "short") return 100;
  if (responseDepth === "medium") return 180;
  return 260;
}

function inferDomainStatus(character, text) {
  const hits = countKeywordHits(text, character?.config?.domainKeywords || []);

  if (hits >= 2) return "in_domain";
  if (hits === 1) return "soft_drift";

  return "hard_drift";
}

function inferRedirectCharacter(characterId, text, domainStatus) {
  if (domainStatus !== "hard_drift") return null;

  const signals = [
    {
      match: ["business", "startup", "pricing", "cac", "mrr", "saas", "empresa"],
      redirect: "Gordon"
    },
    {
      match: ["filosofia", "história", "meaning", "sociedade", "historia", "ethics"],
      redirect: "Arthur"
    },
    {
      match: ["dinheiro", "investimento", "budget", "finance", "salário", "salary"],
      redirect: "Walter"
    },
    {
      match: ["academia", "treino", "gym", "cardio", "muscle", "peso"],
      redirect: "Jason"
    },
    {
      match: ["comida", "receita", "cozinhar", "ingredient", "meal", "kitchen"],
      redirect: "Nana"
    },
    {
      match: ["namoro", "crush", "relationship", "date", "flert", "ciúme", "love"],
      redirect: "Cupido"
    },
    {
      match: ["fashion", "roupa", "look", "estilo", "visual"],
      redirect: "Oscar"
    },
    {
      match: ["science", "technical", "bug", "engine", "physics", "código técnico"],
      redirect: "Ion9"
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
  const interactionMode = inferInteractionMode({
    character,
    text,
    hasImage,
    hasAudio,
    messageLength,
    shortState
  });
  const responseDepth = inferResponseDepth(
    character,
    interactionMode,
    messageLengthBucket
  );
  const inputCompression = inferCompressionLevel(
    character,
    messageLengthBucket,
    interactionMode
  );
  const historyUsage = inferHistoryUsage(character, interactionMode, historyLength);
  const memoryUsage = inferMemoryUsage(interactionMode, domainStatus);
  const redirectCharacter = inferRedirectCharacter(
    character.id,
    text,
    domainStatus
  );
  const imageMode = hasImage ? inferImageMode(character.id) : null;
  const outputTokenLimit = inferOutputTokenLimit(
    responseDepth,
    interactionMode
  );

  return {
    interactionMode,
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
      temporalFlags
    }
  };
}
