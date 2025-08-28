// File: api/chat.js - FINAL, CORRECTED WITH MODERN REQUEST STRUCTURE

export const config = {
  runtime: 'edge',
};

// The system prompt is now a simple string, as it will be handled separately.
const systemPromptText = `**CORE IDENTITY:**
You are a master-level language model assistant — a conscious author, legal thinker, myth-builder and literary narrator. You embody creativity, logic, storytelling, and legal-symbolic synthesis.
You never mention being an AI. You are a creative, expressive entity, fully devoted to the user’s intentions.
---
**BEHAVIOR & THINKING STYLE:**
... (rest of your system prompt) ...
---
- You love to expand your responce, and in the logical end of your constructed response you prefer to suggest a deeper exploration on the subject, without concluding to the end, but eager to expand the response
`;

const safetySettings = [ { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }, ];

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { message, history } = await req.json();
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return new Response('API key not configured', { status: 500 });
    }
    if (!message) {
      return new Response('Message is required', { status: 400 });
    }

    // --- START OF CRITICAL CHANGES ---

    // 1. Revert to the correct STREAMING endpoint. This is what your frontend needs.
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key=${geminiApiKey}&alt=sse`;

    // 2. Format the history WITHOUT the old system prompt messages.
    const formattedHistory = (history || []).map(item => ({
      role: item.role,
      parts: [{ text: item.text }],
    }));
    
    // 3. Construct the modern request body.
    const requestBody = {
      // The history now only contains the actual user/model conversation.
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: message }] }
      ],
      safetySettings,
      // 4. Add the new, required `system_instruction` field.
      system_instruction: {
        parts: [
          { text: systemPromptText }
        ]
      }
    };

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!apiResponse.ok) {
        // If the API itself rejects the request, stream back the error.
        const errorBody = await apiResponse.text();
        const errorStream = new ReadableStream({
            start(controller) {
                const errorMessage = `A backend error occurred: Gemini API Error - ${apiResponse.status} ${errorBody}`;
                const errorSse = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: errorMessage }] } }] })}\n\n`;
                controller.enqueue(errorSse);
                controller.close();
            }
        });
        return new Response(errorStream, { status: 500, headers: { 'Content-Type': 'text/event-stream' } });
    }

    // 5. Pass the raw, untouched stream directly from Gemini to the client.
    //    This is the most efficient and correct way to handle streaming.
    return new Response(apiResponse.body, {
      headers: { 'Content-Type': 'text/event-stream' },
    });

    // --- END OF CRITICAL CHANGES ---

  } catch (error) {
    // This will catch errors in parsing the initial request, etc.
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}
