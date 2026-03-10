import { CORE_DIALOGUE_RULES, getDialoguePattern } from "../config/dialoguePatterns.js";

export function buildMessages({
  globalSystem,
  characterRuntime,
  userContext,
  history,
  userMessage,
  classifierOutput
}) {
  const safeHistory = Array.isArray(history) ? history : [];

  const limitedHistory = classifierOutput?.useRecentHistory
    ? safeHistory.slice(-(classifierOutput.recentHistoryLimit || 0))
    : [];

  const classifierStateBlock = buildClassifierStateBlock(classifierOutput);
  const dialoguePattern = getDialoguePattern(classifierOutput?.pattern);

  return [
    {
      role: "system",
      content: buildSystemBlock({
        globalSystem,
        dialoguePattern,
        characterRuntime,
        classifierStateBlock
      })
    },
    {
      role: "system",
      content: userContext
    },
    ...sanitizeHistory(limitedHistory),
    {
      role: "user",
      content: String(userMessage || "").trim()
    }
  ];
}

function buildSystemBlock({
  globalSystem,
  dialoguePattern,
  characterRuntime,
  classifierStateBlock
}) {
  return `
${String(globalSystem || "").trim()}

${String(CORE_DIALOGUE_RULES || "").trim()}

DIALOGUE PATTERN
${String(dialoguePattern?.structure || "").trim()}

CHARACTER RUNTIME
${String(characterRuntime || "").trim()}

${String(classifierStateBlock || "").trim()}
`.trim();
}

function buildClassifierStateBlock(classifierOutput = {}) {
  return `CLASSIFIER_STATE:
interaction_mode: ${classifierOutput.interactionMode || "live_assistant"}
pattern: ${classifierOutput.pattern || "brief_explanation"}
response_depth: ${classifierOutput.responseDepth || "medium"}
input_compression: ${classifierOutput.inputCompression || "low"}
domain_status: ${classifierOutput.domainStatus || "in_domain"}
redirect_character: ${classifierOutput.redirectCharacter || "null"}
image_mode: ${classifierOutput.imageMode || "null"}
output_token_limit: ${classifierOutput.outputTokenLimit || 180}`;
}

function sanitizeHistory(history) {
  return history
    .filter((msg) => msg && typeof msg === "object")
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map((msg) => ({
      role: msg.role,
      content: String(msg.content || "").trim()
    }))
    .filter((msg) => msg.content.length > 0);
}
