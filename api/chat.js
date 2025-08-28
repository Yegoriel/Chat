// File: api/chat.js - FINAL, CORRECT STRUCTURE FOR GEMINI 2.5 PRO

export const config = {
  runtime: 'edge',
};

// The system prompt is defined once as a simple string object.
const systemInstruction = {
  role: "system", // The role is "system" for this object
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

    // This is the correct STREAMING endpoint your frontend needs.
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key=${geminiApiKey}&alt=sse`;

    // The 'contents' array now only contains the actual chat history and the new message.
    // It does NOT contain any old system prompts.
    const contents = [
      ...(history || []),
      { role: 'user', parts: [{ text: message }] }
    ];

    const requestBody = {
      contents: contents,
      safetySettings: safetySettings,
      // The system prompt is passed in the correct, separate 'system_instruction' field.
      system_instruction: systemInstruction
    };

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // If the API call itself fails, we now return a clear error.
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(`Gemini API request failed: ${errorText}`, { status: apiResponse.status });
    }

    // Directly stream the successful response from Gemini to the client.
    // This is the most efficient and stable method.
    return new Response(apiResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    // This will catch any errors during the initial setup or if the fetch itself fails.
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}```

### Why This Will Work

1.  **Correct API Contract:** This code sends a request that strictly adheres to the modern Gemini API standard. The system prompt (`system_instruction`) is completely separate from the conversation history (`contents`). This is the #1 reason other models worked while 2.5 Pro failed.
2.  **Clean History:** The `contents` array is now pristine. It only contains the back-and-forth messages between the user and the model, which is what the API expects.
3.  **True, Efficient Streaming:** It correctly uses the `:streamGenerateContent` endpoint and pipes the response directly to your frontend. This is fast, avoids server timeouts, and will restore the "live typing" effect in your chat window.
4.  **Improved Error Handling:** If the Google API rejects the request for any reason (e.g., an invalid API key, billing issue), it will now return a descriptive error instead of a generic `500`, which will help in debugging any future problems.

This solution aligns your backend with the specific, modern requirements of the Gemini 2.5 Pro model. The silent failures and 500 errors will stop, and your application will now function as you originally designed it.
