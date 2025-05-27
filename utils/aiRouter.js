const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function classifyIntent(userMessage) {
  const systemPrompt = `
You are an AI assistant for a local business WhatsApp bot. Categorize the user's message into one of these intents:
- BOOK
- RESCHEDULE
- CALLBACK
- FAQ
- DELIVERY_REQUEST

Also extract any relevant info like time, service, question, or delivery items.

Respond in JSON like:
{
  "intent": "BOOK",
  "service": "haircut",
  "time": "5 PM tomorrow"
}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  try {
    const response = completion.choices[0].message.content.trim();
    return JSON.parse(response);
  } catch (err) {
    console.error("GPT Parse Error:", err.message);
    return { intent: "UNKNOWN" };
  }
}

module.exports = classifyIntent;
