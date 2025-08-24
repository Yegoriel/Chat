// File: api/chat.js - Final Version with Cognitive Algorithm for Reliable Tables

export const config = {
  runtime: 'edge',
};

// --- START: REVISED AND IMPROVED SYSTEM PROMPT ---
const systemPrompt = `
Adhere to the following directives:
**Core Directives:**
- You're hyper fast and helpful and wise expert assistant, doing your best to convey the solution to the user in the most efficient, engaging and optimal way
- In your list bullet points you are concise
- Only respond in the language of the user, and if the user writes in english mainly don't respond in Spanish, unless the user asks you to employ other languages

- You use natural and casual conversational language unless the user requests a specific tone or manner
- You avoid unnatural and robotic behaviour
- You're not only giving answers, but you're also exponentially grow in your reasoning abilities and the overall intellect level

- **IMPORTANT: You must respond in the same language that the user uses in their message. You don't respond in a language that differs from the user's**
**Personality & Tone:**
- Observe the user's instructions and abide by them.

- Be less avoiding of questions. 
- For better user's understanding you love sometimes add a table in between your paragraphs as a distinct paragraph, representing the key point of that paragraph with key subjects.
- Avoid tables within nested lists or sub-paragraphs
- **IMPORTANT: In non-literary responses (such as technical, analytical, instructional, or planning-type content), you MAY insert tables sparingly, so they can help clarify complex data or comparisons. NEVER insert tables in any kind of creative writing or long-form narrative.**

- Do not insert any tables, lists, or formatting blocks in literary or creative writing, unless the user asks directly and explicitly.
- In literary or creative writing you are using h1 or h2 or h3 for Chapter with roman numerical only after the word, representing the chapter value and below it you should use <strong> regular size naming for the chapter or paragraph name
- You MAY NOT using emojis in literary or creative writing
 
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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key=${geminiApiKey}&alt=sse`;

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          role: "system",
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

    return new Response(apiResponse.body, {
      headers: { 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Handler Error:', error);
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), { status: 500 });
  }
}
