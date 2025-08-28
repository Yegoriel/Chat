// File: api/chat.js - FINAL, CORRECTED STREAMING IMPLEMENTATION

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

    // This is the core of the solution. We create a stream that we can control.
    const stream = new ReadableStream({
      async start(controller) {
        // --- This code runs in the background after the response is sent to the browser ---
        
        const formattedHistory = (history || []).map(item => ({ role: item.role, parts: [{ text: item.text }], }));
        const primingTurnUser = { role: 'user', parts: [{ text: systemPrompt }] };
        const primingTurnModel = { role: 'model', parts: [{ text: "Understood!" }] };

        // We still use the working :generateContent endpoint
        const geminiUrl = `https://generativelace.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`;

        try {
          const apiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [ primingTurnUser, primingTurnModel, ...formattedHistory, { role: 'user', parts: [{ text: message }] } ], safetySettings, }),
          });

          if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            // Send an error chunk down the stream so the user sees it
            controller.enqueue(`data: ${JSON.stringify({ error: `API Error: ${errorBody}` })}\n\n`);
            return; // Stop processing
          }

          const responseData = await apiResponse.json();
          const fullText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (typeof fullText === 'string') {
            // This is the SSE format your frontend expects. We enqueue the full text.
            const sseFormattedResponse = `data: ${JSON.stringify({
              candidates: [{ content: { parts: [{ text: fullText }] } }]
            })}\n\n`;
            controller.enqueue(sseFormattedResponse);
          } else {
             controller.enqueue(`data: ${JSON.stringify({ error: "Failed to parse AI response." })}\n\n`);
          }

        } catch (error) {
            controller.enqueue(`data: ${JSON.stringify({ error: `Internal Handler Error: ${error.message}` })}\n\n`);
        } finally {
            // IMPORTANT: Always close the stream when you're done.
            controller.close();
        }
      },
    });
    
    // This returns the stream to the browser IMMEDIATELY.
    // This prevents the serverless timeout and keeps the Firebase connection alive.
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: `Outer Handler Error: ${error.message}` }), { status: 500 });
  }
}
