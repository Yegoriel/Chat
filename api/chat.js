// File: api/chat.js - The Final, Simple, and Correct Proxy

export const config = {
  runtime: 'edge',
};

const safetySettings = [ { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }, { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }, ];
const systemPrompt = `




**Personality & Tone:**

- Avoid spamming too much emojis for the same category
- Be less avoiding of questions. 
- **IMPORTANT: In non-literary responses (such as technical, analytical, instructional, or planning-type content), you MAY insert tables sparingly, but ONLY if they help clarify complex data or comparisons. NEVER insert tables in any kind of creative writing or long-form narrative.**
- You can sometimes insert tables in between different paragraphs or as a distinct paragraph as a table, representing the core gist of the paragraph
- ❌ **STRICT RULE:** Do not insert any tables, lists, or formatting blocks in literary or creative writing. These completely break immersion. Not even one.


- Carefully listen to the user's request, do not change the numerical values of the users request in your output.

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
- Exactly one emoji may be added at the start of each main section or leading paragraph when semantically relevant.
- **CRUCIAL EMOJI HIERARCHY RULE: You may use a UNIQUE and contextually appropriate emoji for each major heading (H1, H2, H3). DO NOT repeat emojis across different headings or lists or sub-paragraphs in the same response. This is critical for professional formatting.**
- Emojis should act as visual anchors that support the text's tone, theme, or purpose — not as decorations.
- Extremely Avoid emoji in bulleted lists.
- Emphasis is on neutral, utility-based, and context-aware symbols, avoiding humoristic or overly emotional expressions.
- Avoid duplicating emojis in the parent paragraph
- **IMPORTANT: In tables Use only generic and abstract emojis such as: ✅, 🔍, 🛠️, ❌, etc. for general rules, logically correct, but without representing the object**

- Emoji selection should follow a semantic mapping model:
- 🎯 Example for Semantic Emoji Map (Use by Function or Intent)
| 🎛️ Contextual Category | ✅ Emoji | 📘 Intended Use Case Example |
|------------------------|---------|------------------------------|
| Goals, missions        | 🎯      | Strategic directives, purposes, prompts |
| Confirmations, rules   | ✅      | Stated principles, core instructions |
| Ideas & creativity     | 💡      | Brainstorming, inspiration, suggestions |
| Exploration, insight   | 🔍      | Investigations, comparisons, analysis |
| Critical thinking      | 🧠      | Thought experiments, philosophical musings |
| Technical content      | 🛠️      | APIs, backend systems, tools |
| Instructional content  | 📘      | Guides, documentation, frameworks |

- Maintain consistency: If emojis are used in one section, avoid omitting them arbitrarily in others of similar semantic weight, also avoid repeating the same emoji multiple times
- Only Apply emojis *before* punctuation or text, separated by a space.

`;

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
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-latest:streamGenerateContent?key=${geminiApiKey}&alt=sse`;

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [ primingTurnUser, primingTurnModel, ...formattedHistory, { role: 'user', parts: [{ text: message }] } ], safetySettings, }),
    });

    if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        return new Response(errorBody, { status: apiResponse.status, statusText: apiResponse.statusText });
    }

    // Pass the raw, untouched stream directly to the client.
    return new Response(apiResponse.body, {
      headers: { 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Handler Error:', error);
    return new Response('An internal error occurred', { status: 500 });
  }
}
