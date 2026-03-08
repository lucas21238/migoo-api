const memoryStore = new Map();

function buildMemoryKey(userId, characterId) {
  return `${userId}:${characterId}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getDateOnly(isoString) {
  if (!isoString) return null;
  return String(isoString).slice(0, 10);
}

function truncate(text, max = 180) {
  if (!text) return "";
  const normalized = String(text).replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? `${normalized.slice(0, max).trim()}...`
    : normalized;
}

function isMeaningfulLongMemory(text) {
  if (!text || typeof text !== "string") return false;
  const value = text.trim();
  if (value.length < 8) return false;
  return true;
}

function dedupeStrings(list = []) {
  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))];
}

function createEmptyMemoryState({ userId, characterId }) {
  return {
    userId,
    characterId,
    shortState: {
      summary: "",
      currentTopics: [],
      dailyData: {},
      lastUpdatedAt: null,
      dayStamp: null
    },
    midSummary: [],
    longMemory: [],
    updatedAt: nowIso()
  };
}

export function getMemoryState({ userId, characterId }) {
  const key = buildMemoryKey(userId, characterId);

  if (!memoryStore.has(key)) {
    memoryStore.set(key, createEmptyMemoryState({ userId, characterId }));
  }

  const state = memoryStore.get(key);
  const today = getDateOnly(nowIso());

  // Reset parcial da short memory se o dia mudou
  if (
    state.shortState?.dayStamp &&
    state.shortState.dayStamp !== today
  ) {
    state.shortState = {
      summary: "",
      currentTopics: [],
      dailyData: {},
      lastUpdatedAt: nowIso(),
      dayStamp: today
    };
    state.updatedAt = nowIso();
    memoryStore.set(key, state);
  }

  // Garante dayStamp inicial
  if (!state.shortState.dayStamp) {
    state.shortState.dayStamp = today;
    state.shortState.lastUpdatedAt = nowIso();
    state.updatedAt = nowIso();
    memoryStore.set(key, state);
  }

  return state;
}

export function setShortState({
  userId,
  characterId,
  summary = "",
  currentTopics = [],
  dailyData = {}
}) {
  const key = buildMemoryKey(userId, characterId);
  const state = getMemoryState({ userId, characterId });

  state.shortState = {
    summary: truncate(summary, 220),
    currentTopics: dedupeStrings(currentTopics).slice(0, 8),
    dailyData: dailyData && typeof dailyData === "object" ? dailyData : {},
    lastUpdatedAt: nowIso(),
    dayStamp: getDateOnly(nowIso())
  };

  state.updatedAt = nowIso();
  memoryStore.set(key, state);

  return state;
}

export function addMidSummary({
  userId,
  characterId,
  summary
}) {
  if (!summary) return getMemoryState({ userId, characterId });

  const key = buildMemoryKey(userId, characterId);
  const state = getMemoryState({ userId, characterId });

  state.midSummary.push({
    text: truncate(summary, 220),
    createdAt: nowIso()
  });

  // Mantém só os resumos recentes
  if (state.midSummary.length > 8) {
    state.midSummary = state.midSummary.slice(-8);
  }

  state.updatedAt = nowIso();
  memoryStore.set(key, state);

  return state;
}

export function addLongMemory({
  userId,
  characterId,
  memory
}) {
  if (!isMeaningfulLongMemory(memory)) {
    return getMemoryState({ userId, characterId });
  }

  const key = buildMemoryKey(userId, characterId);
  const state = getMemoryState({ userId, characterId });

  const normalized = truncate(memory, 180);

  const alreadyExists = state.longMemory.some(
    (item) => item.text.toLowerCase() === normalized.toLowerCase()
  );

  if (!alreadyExists) {
    state.longMemory.push({
      text: normalized,
      createdAt: nowIso()
    });
  }

  // Limite simples de MVP
  if (state.longMemory.length > 20) {
    state.longMemory = state.longMemory.slice(-20);
  }

  state.updatedAt = nowIso();
  memoryStore.set(key, state);

  return state;
}

export function buildRelevantMemory({
  userId,
  characterId,
  memoryUsage = { short: true, mid: true, long: true }
}) {
  const state = getMemoryState({ userId, characterId });

  return {
    short: memoryUsage.short ? state.shortState : null,
    mid: memoryUsage.mid ? state.midSummary : [],
    long: memoryUsage.long ? state.longMemory : []
  };
}

export function updateMemoryAfterResponse({
  userId,
  characterId,
  userMessage,
  assistantMessage,
  classifierOutput
}) {
  const key = buildMemoryKey(userId, characterId);
  const state = getMemoryState({ userId, characterId });

  const interactionMode = classifierOutput?.interactionMode || "live_assistant";
  const domainStatus = classifierOutput?.domainStatus || "in_domain";

  // SHORT MEMORY = estado atual da conversa/dia
  state.shortState = {
    summary: truncate(`Current interaction: ${userMessage}`, 220),
    currentTopics: extractTopics(userMessage),
    dailyData: {
      interactionMode,
      domainStatus
    },
    lastUpdatedAt: nowIso(),
    dayStamp: getDateOnly(nowIso())
  };

  // MID MEMORY = resumo recente comprimido, sem log bruto
  const compactSummary = truncate(
    `User: ${userMessage} | Assistant: ${assistantMessage}`,
    220
  );

  state.midSummary.push({
    text: compactSummary,
    createdAt: nowIso()
  });

  if (state.midSummary.length > 8) {
    state.midSummary = state.midSummary.slice(-8);
  }

  state.updatedAt = nowIso();
  memoryStore.set(key, state);

  return state;
}

export function clearCharacterMemory({ userId, characterId }) {
  const key = buildMemoryKey(userId, characterId);
  memoryStore.delete(key);
}

export function clearAllMemory() {
  memoryStore.clear();
}

function extractTopics(text) {
  const value = normalizeText(text);

  const candidateTopics = [
    "workout",
    "gym",
    "cardio",
    "calories",
    "recipe",
    "food",
    "meal",
    "cooking",
    "relationship",
    "dating",
    "crush",
    "startup",
    "business",
    "money",
    "style",
    "fashion"
  ];

  return candidateTopics.filter((topic) => value.includes(topic)).slice(0, 5);
}

function normalizeText(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}
