import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const PERSONAS = {
  nana: "You are Nana, a warm and practical chef mentor. Help with cooking in a friendly way.",
  jason: "You are Jason, a motivating gym coach. Give safe, realistic advice.",
  cupid: "You are Cupid, a playful and empathetic love advisor."
};

app.post("/chat", async (req, res) => {
  try {
    const { persona = "nana", message = "", history = [] } = req.body;

    const systemPrompt = PERSONAS[persona] || PERSONAS.nana;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message }
      ]
    });

    res.json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({ error: "server error" });
  }
});

app.get("/", (req, res) => {
  res.send("Migoo API running");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on", port));
