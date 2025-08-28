// File: api/chat.js - FINAL AND CORRECTED FOR GEMINI 2.5 PRO

export const config = {
  runtime: 'edge',
};

// --- Your existing system prompt remains unchanged ---
const systemPrompt = `
Adhere to the following directives:
... (your full system prompt) ...
`;

const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { message, history } = await req.json();
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 });
    }
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 });
    }
    
    const formattedHistory = (history || []).map(item => ({
      role: item.role,
      parts: [{ text: item.text }],
    }));

    // --- FIX #1: The model is changed to gemini-2.5-pro ---
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key=${geminiApiKey}&alt=sse`;

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // --- FIX #2: The invalid "role: 'system'" property is removed ---
        // This is the critical change that makes the request valid for the Pro model.
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          ...formattedHistory,
          { role: 'user', parts: [{ text: message }] }
        ],
        safetySettings,
      }),
    });

    if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        console.error('Gemini API Error:', apiResponse.status, errorBody);
        return new Response(errorBody, { status: apiResponse.status, statusText: apiResponse.statusText });
    }

    // Directly stream the response, which is the most stable method.
    return new Response(apiResponse.body, {
      headers: { 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Handler Error:', error);
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), { status: 500 });
  }
}
