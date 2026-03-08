import express from "express";
import cors from "cors";
import OpenAI from "openai";

import { characters, buildCharacterRuntime } from "./src/config/characters.js";
import { GLOBAL_SYSTEM } from "./src/config/system.js";
import { classifyMessage } from "./src/core/classifier.js";
import {
  getMemoryState,
  updateMemoryAfterResponse
} from "./src/core/memory.js";
import { buildUserContext } from "./src/core/contextBuilder.js";
import { buildMessages } from "./src/core/promptBuilder.js";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("Migoo API running");
});

app.post("/chat", async (req, res) => {
  try {
    const {
      userId = "guest",
      persona = "nana",
      message = "",
      history = [],
      hasImage = false
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    const character = characters[persona] || characters.nana;

    const classifierOutput = classifyMessage({
      character,
      userMessage: message,
      hasImage,
      history
    });

    const memoryState = getMemoryState({
      userId,
      characterId: character.id
    });

    const userContext = buildUserContext({
      userId,
      character,
      memoryState,
      message
    });

    const characterRuntime = buildCharacterRuntime(character);

    const messages = buildMessages({
      globalSystem: GLOBAL_SYSTEM,
      characterRuntime,
      userContext,
      history,
      userMessage: message,
      classifierOutput
    });

    const instructions = buildInstructions(messages);
    const input = buildResponsesInput(messages);

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      instructions,
      input,
      max_output_tokens: Math.max(200, classifierOutput.outputTokenLimit)
    });
    
console.log("RAW RESPONSE:", JSON.stringify(response, null, 2));
    
    const reply =
  response?.output_text?.trim?.() ||
  response?.output?.[0]?.content?.[0]?.text?.trim?.() ||
  response?.output?.[0]?.content?.[0]?.output_text?.trim?.() ||
  "No response.";

    updateMemoryAfterResponse({
      userId,
      characterId: character.id,
      userMessage: message,
      assistantMessage: reply,
      classifierOutput
    });

    res.json({
      reply,
      meta: {
        persona: character.id,
        interactionMode: classifierOutput.interactionMode,
        responseDepth: classifierOutput.responseDepth,
        domainStatus: classifierOutput.domainStatus,
        redirectCharacter: classifierOutput.redirectCharacter
      }
    });
  } catch (err) {
    console.error("CHAT ERROR:", err);

    const apiMessage =
      err?.message ||
      err?.error?.message ||
      "server error";

    res.status(500).json({
      error: "server error",
      details: apiMessage
    });
  }
});

function buildInstructions(messages) {
  const systemTexts = messages
    .filter((msg) => msg && msg.role === "system")
    .map((msg) => String(msg.content || "").trim())
    .filter(Boolean);

  return systemTexts.join("\n\n");
}

function buildResponsesInput(messages) {
  return messages
    .filter((msg) => msg && typeof msg === "object")
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map((msg) => ({
      role: msg.role,
      content: [
        {
          type: "input_text",
          text: String(msg.content || "").trim()
        }
      ]
    }))
    .filter((msg) => msg.content[0].text.length > 0);
}

function extractTextFromResponse(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const output = Array.isArray(response?.output) ? response.output : [];

  const parts = [];

  for (const item of output) {
    if (item?.type !== "message") continue;

    const content = Array.isArray(item?.content) ? item.content : [];

    for (const piece of content) {
      if (piece?.type === "output_text" && typeof piece?.text === "string") {
        parts.push(piece.text);
      }
    }
  }

  return parts.join("\n").trim();
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on", port);
});
