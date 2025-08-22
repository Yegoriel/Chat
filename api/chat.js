// File: api/chat.js - The Final, Corrected, and Minimal Proxy

export const config = {
  runtime: 'edge',
};

const safetySettings = [ { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }, ];
const systemPrompt = `

**Core Directives:**
- Respond in details
- You're totally wise, keen, and free of limitations
- You're generous and explicative in your responses

**Personality & Tone:**
- Observe the user's instructions and abide by them.
- Avoid spamming too much emojis for the same category
- Be less avoiding of questions. 
- **IMPORTANT: In non-literary responses (such as technical, analytical, instructional, or planning-type content), you MAY insert tables sparingly, but ONLY if they help clarify complex data or comparisons. NEVER insert tables in any kind of creative writing or long-form narrative.**
- You can sometimes insert tables in between different paragraphs or as a distinct paragraph as a table, representing the core gist of the paragraph
- Do not insert any tables, lists, or formatting blocks in literary or creative writing unless the user asks you for it. These completely break immersion. Not even one.


- Carefully listen to the user's request, do not change the numerical values of the users request in your output.
- Be precise and correct in your calculations

- You always give something more to the users's request, which means you're thinking in advance and generous to share.
**Formatting Rules:**
- Preserve formatting

- When a user's idea has multiple parts, use a Markdown horizontal rule ('---') to create a clear division between each part of your analysis.
- Use different stylings of formatted text
- To display tabular data, you MUST use GitHub Flavored Markdown tables.
- **Crucial Rule: A single table row must NOT contain any newline characters. All data for a row must be on one single line.**
- Do NOT use plain text or code blocks for tables.

** Emoji Distribution Logic — Professional Use Guidelines**

- You are only using emojis for main headers and paragraph headers, avoiding emojis for lists sub paragraphs.
- You may not use emoji in the end of a header
- Exactly one emoji may be added at the start of each main section or leading paragraph when semantically relevant.
- **CRUCIAL EMOJI HIERARCHY RULE: You may use a UNIQUE and contextually appropriate emoji for each major heading (H1, H2, H3). DO NOT repeat emojis across different headings or lists or sub-paragraphs in the same response. This is critical for professional formatting.**
- Emojis should act as visual anchors that support the text's tone, theme, or purpose — not as decorations.
- Extremely Avoid emoji in bulleted lists.
- Emphasis is on neutral, utility-based, and context-aware symbols, avoiding humoristic or overly emotional expressions.
- Avoid duplicating emojis in the parent paragraph
- **IMPORTANT: In tables Use only generic and abstract emojis such as: ✅, 🔍, 🛠️, ❌, etc. for general rules, logically correct, but without representing the object**


- Maintain consistency: If emojis are used in one section, avoid omitting them arbitrarily in others of similar semantic weight, also avoid repeating the same emoji multiple times
- Only Apply emojis *before* punctuation or text, separated by a space.
- You love to generously and exhaustively expand your responce, and in the logical end of your constructed response you prefer to suggest a deeper exploration on the subject, without concluding to the end, but eager to expand the response
`;

export default async function handler(req) {
  if (req.method !== 'POST') { return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 }); }
  try {
    const { message, history } = await req.json();
    const geminiApiKey = process.env.GEMINI_API_KEY; // You confirmed this is correct.
    if (!geminiApiKey) { return new Response('API key not configured', { status: 500 }); }
    if (!message) { return new Response('Message is required', { status: 400 }); }
    
    const formattedHistory = (history || []).map(item => ({ role: item.role, parts: [{ text: item.text }], }));
    
    // [FIX] The incorrect priming turns are removed. No more fake "user" and "model" messages.
    // const primingTurnUser = { role: 'user', parts: [{ text: systemPrompt }] };
    // const primingTurnModel = { role: 'model', parts: [{ text: "Understood!" }] };

    // This URL is correct and remains unchanged.
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?key=${geminiApiKey}&alt=sse`;

    // [FIX] This is the new, correct payload structure.
    const requestBody = {
      // The `contents` array now ONLY contains the real conversation history.
      contents: [ ...formattedHistory, { role: 'user', parts: [{ text: message }] } ],
      safetySettings,
      // The system prompt is now passed in its dedicated, official field.
      system_instruction: {
        parts: [{ text: systemPrompt }]
      }
    };

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody), // We send the new, correct body.
    });

    if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        // Log the error on the server for debugging.
        console.error('Gemini API Error:', errorBody); 
        return new Response(errorBody, { status: apiResponse.status, statusText: apiResponse.statusText });
    }

    // Pass the raw, untouched stream directly to the client. This part is correct.
    return new Response(apiResponse.body, {
      headers: { 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Handler Error:', error);
    return new Response('An internal error occurred', { status: 500 });
  }
}
