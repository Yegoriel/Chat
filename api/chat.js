// File: api/chat.js - MODIFIED TO USE THE WORKING NON-STREAMING ENDPOINT

export const config = {
  runtime: 'edge',
};

const safetySettings = [ { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }, ];
const systemPrompt = `**CORE IDENTITY:**...`; // Your full system prompt remains here

export default async function handler(req) {
  if (req.method !== 'POST') { return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 }); }
  try {
    const { message, history } = await req.json();
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) { return new Response('API key not configured', { status: 500 }); }
    if (!message) { return new Response('Message is required', { status: 400 }); }
    
    const formattedHistory = (history || []).map(item => ({ role: item.role, parts: [{ text: item.text }], }));
    const primingTurnUser = { role: 'user', parts: [{ text: systemPrompt }] };
    const primingTurnModel = { role: 'model', parts: [{ text: "Understood!" }] };
    
    // --- START OF CRITICAL CHANGES ---

    // 1. Change the URL to use the working ":generateContent" endpoint.
    //    Note that "&alt=sse" is removed as it's for streaming only.
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`;

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [ primingTurnUser, primingTurnModel, ...formattedHistory, { role: 'user', parts: [{ text: message }] } ], safetySettings, }),
    });

    if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        console.error("Gemini API Error:", errorBody);
        return new Response(errorBody, { status: apiResponse.status, statusText: apiResponse.statusText });
    }

    // 2. Since this is not a stream, we await the full JSON response.
    const responseData = await apiResponse.json();

    // 3. Extract the full text content from the response.
    //    Add robust error checking in case the structure is unexpected.
    const fullText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof fullText !== 'string') {
        console.error("Invalid response structure from Gemini:", responseData);
        return new Response('Failed to parse response from AI model', { status: 500 });
    }
    
    // 4. Manually create a fake "stream" in the Server-Sent Events (SSE) format
    //    that your frontend expects. This sends the entire response as a single chunk.
    const sseFormattedResponse = `data: ${JSON.stringify({
        candidates: [{
            content: {
                parts: [{
                    text: fullText
                }]
            }
        }]
    })}\n\n`;

    // 5. Return this formatted response. The frontend will receive it and render it.
    return new Response(sseFormattedResponse, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
    
    // --- END OF CRITICAL CHANGES ---

  } catch (error) {
    console.error('Handler Error:', error);
    return new Response('An internal error occurred', { status: 500 });
  }
}
