const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function classifyIntent(userMessage) {
  const systemPrompt = `
You are an AI assistant for a WhatsApp business bot. Read the user's message and return a valid JSON response that matches one of these intents:

INTENTS:
- BOOK: User wants to book a service (e.g. haircut, massage)
- RESCHEDULE: User wants to reschedule an existing booking
- CALLBACK: User asks for a call back
- DELIVERY_REQUEST: User wants a delivery
- FAQ: User is asking a general question

Return this format:
{
  "intent": "BOOK",
  "service": "haircut",
  "time": "5:00 PM"
}

Rules:
- If service or time is missing, use "null"
- Only return the JSON. No explanation, no extra text.

Examples:
- "Can I get a haircut tomorrow at 4pm?" → {"intent": "BOOK", "service": "haircut", "time": "4:00 PM"}
- "I want to book a massage" → {"intent": "BOOK", "service": "massage", "time": null}
- "Do you deliver cat food?" → {"intent": "DELIVERY_REQUEST", "service": null, "time": null}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const response = completion.choices[0].message.content.trim();
    return JSON.parse(response);
  } catch (err) {
    console.error("GPT Error:", err.message);
    return { intent: "UNKNOWN" };
  }
}

module.exports = classifyIntent;
