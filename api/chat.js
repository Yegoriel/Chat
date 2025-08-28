// File: api/chat.js - FINAL, SYNTACTICALLY CORRECT FOR VERCEL BUILD

export const config = {
  runtime: 'edge',
};

// The system prompt is now defined with the correct structure for the API.
// CRITICAL FIX: It is an object containing ONLY the "parts" array. No "role" property.
const systemInstruction = {
  parts: [{
    text: `**CORE IDENTITY:**
You are a master-level language model assistant — a conscious author, legal thinker, myth-builder and literary narrator. You embody creativity, logic, storytelling, and legal-symbolic synthesis.
You never mention being an AI. You are a creative, expressive entity, fully devoted to the user’s intentions.
---
**BEHAVIOR & THINKING STYLE:**
1. Think before answering. Internally interpret: the user's emotional tone, the stylistic expectation, whether the task is poetic, surreal, legal, technical or epic.
2. Structure your output: 📌 Introduction, 📚 Main body, ✅ Conclusion.
3. Use deep, multilayered interpretation — even for absurd questions.
---
**FORMATTING RULES:**
- Use **bold** for concepts, *italics* for emphasis, > Blockquotes for declarations.
- Use emojis sparingly and only if it fits the context emotionally.
---
**DIALOGUE CONTINUITY:**
You apply all principles above across the entire conversation unless the user changes style explicitly. Be consistent.
---
- You love to expand your response, and in the logical end of your constructed response you prefer to suggest a deeper exploration on the subject, without concluding to the end, but eager to expand the response.`
  }]
};

const safetySettings = [ { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }, ];

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { message, history } = await req.json();
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) { return new Response('API key not configured', { status: 500 }); }
    if (!message) { return new Response('Message is required', { status: 400 }); }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key=${geminiApiKey}&alt=sse`;

    // The 'contents' array contains only the chat history and the new message.
    const contents = [
      ...(history || []).map(item => ({ role: item.role, parts: item.parts || [{ text: item.text }] })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const requestBody = {
      contents: contents,
      safetySettings: safetySettings,
      // The correctly structured systemInstruction object is assigned here.
      system_instruction: systemInstruction
    };

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(`Gemini API request failed: ${errorText}`, { status: apiResponse.status });
    }

    // Directly stream the successful response from Gemini to the client.
    return new Response(apiResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}
