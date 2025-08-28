// File: api/chat.js - FINAL, TYPO-CORRECTED, AND ROBUST ERROR-HANDLING

export const config = {
  runtime: 'edge',
};

const safetySettings = [ { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }, ];
const systemPrompt = `**CORE IDENTITY:**...`; // Your full system prompt remains here

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

    const stream = new ReadableStream({
      async start(controller) {
        const formattedHistory = (history || []).map(item => ({ role: item.role, parts: [{ text: item.text }], }));
        const primingTurnUser = { role: 'user', parts: [{ text: systemPrompt }] };
        const primingTurnModel = { role: 'model', parts: [{ text: "Understood!" }] };

        // --- FIX #1: Corrected the typo in the URL ---
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`;

        try {
          const apiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [ primingTurnUser, primingTurnModel, ...formattedHistory, { role: 'user', parts: [{ text: message }] } ], safetySettings, }),
          });

          if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            throw new Error(`Gemini API Error: ${apiResponse.status} ${errorBody}`);
          }

          const responseData = await apiResponse.json();
          const fullText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (typeof fullText === 'string') {
            const sseFormattedResponse = `data: ${JSON.stringify({
              candidates: [{ content: { parts: [{ text: fullText }] } }]
            })}\n\n`;
            controller.enqueue(sseFormattedResponse);
          } else {
            throw new Error('Failed to parse a valid text response from the Gemini API.');
          }

        } catch (error) {
            // --- FIX #2: Send errors in a format the frontend can RENDER ---
            // This ensures you will always see the error message in the chat window.
            const errorMessage = `A backend error occurred: ${error.message}`;
            const errorSse = `data: ${JSON.stringify({
              candidates: [{ content: { parts: [{ text: errorMessage }] } }]
            })}\n\n`;
            controller.enqueue(errorSse);
        } finally {
            controller.close();
        }
      },
    });
    
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });

  } catch (error) {
    // This outer catch is unlikely to be hit now, but is good practice.
    return new Response(JSON.stringify({ error: `Outer Handler Error: ${error.message}` }), { status: 500 });
  }
}
