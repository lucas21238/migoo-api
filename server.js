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

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages,
      max_tokens: classifierOutput.outputTokenLimit
    });

    const reply = completion.choices?.[0]?.message?.content || "No response.";

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
    res.status(500).json({ error: "server error" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server running on", port);
});
