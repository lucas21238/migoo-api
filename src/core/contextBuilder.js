export function buildUserContext({
  userId,
  character,
  memoryState,
  message
}) {
  const now = new Date();

  const userProfile = buildUserProfileBlock(memoryState);
  const sessionContext = buildSessionContextBlock(character, memoryState);
  const temporalContext = buildTemporalContextBlock(now, memoryState);
  const recentMemory = buildRecentMemoryBlock(memoryState);

  return `USER_PROFILE:
${userProfile}

SESSION_CONTEXT:
${sessionContext}

TEMPORAL_CONTEXT:
${temporalContext}

RECENT_MEMORY:
${recentMemory}

CURRENT_MESSAGE:
${String(message || "").trim()}`;
}

function buildUserProfileBlock(memoryState) {
  const longMemory = Array.isArray(memoryState?.longMemory)
    ? memoryState.longMemory
    : [];

  if (longMemory.length === 0) {
    return "- No durable user profile available yet.";
  }

  return longMemory
    .slice(-8)
    .map((item) => `- ${normalizeLongMemoryItem(item)}`)
    .join("\n");
}

function buildSessionContextBlock(character, memoryState) {
  const shortState = memoryState?.shortState || {};
  const topics = Array.isArray(shortState.currentTopics)
    ? shortState.currentTopics
    : [];

  const lines = [
    `- active_character: ${character?.name || "Unknown"}`,
    `- short_summary: ${shortState.summary || "No active session summary yet."}`
  ];

  if (topics.length > 0) {
    lines.push(`- current_topics: ${topics.join(", ")}`);
  }

  const dailyData = shortState.dailyData || {};
  const dailyKeys = Object.keys(dailyData);

  if (dailyKeys.length > 0) {
    lines.push(`- daily_state: ${JSON.stringify(dailyData)}`);
  }

  return lines.join("\n");
}

function buildTemporalContextBlock(now, memoryState) {
  const shortState = memoryState?.shortState || {};

  return [
    `- current_datetime: ${now.toISOString()}`,
    `- current_date: ${now.toISOString().slice(0, 10)}`,
    `- short_state_day: ${shortState.dayStamp || "unknown"}`,
    `- short_state_last_updated: ${shortState.lastUpdatedAt || "unknown"}`
  ].join("\n");
}

function buildRecentMemoryBlock(memoryState) {
  const midSummary = Array.isArray(memoryState?.midSummary)
    ? memoryState.midSummary
    : [];

  if (midSummary.length === 0) {
    return "- No recent memory available yet.";
  }

  return midSummary
    .slice(-5)
    .map((item, index) => `- ${index + 1}. ${normalizeMidSummaryItem(item)}`)
    .join("\n");
}

function normalizeLongMemoryItem(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object" && item.text) return item.text;
  return String(item);
}

function normalizeMidSummaryItem(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object" && item.text) return item.text;
  return String(item);
}
