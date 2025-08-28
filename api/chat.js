// File: api/chat.js - FINAL VERSION WITH HISTORY SANITIZATION

export const config = {
  runtime: 'edge',
};

// Ваш рабочий системный промпт
const systemPrompt = `
Adhere to the following directives:
... (весь ваш системный промпт здесь) ...
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

    if (!geminiApiKey) { return new Response('API key not configured', { status: 500 }); }
    if (!message) { return new Response('Message is required', { status: 400 }); }

    // Создаем управляемый поток для предотвращения тайм-аутов Vercel.
    const stream = new ReadableStream({
      async start(controller) {
        
        // --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: ОЧИСТКА ИСТОРИИ ---
        // Мы фильтруем историю, чтобы удалить любые сообщения без текста.
        // Это предотвращает отправку "пустых" сообщений, которые вызывают сбой gemini-2.5-pro.
        const sanitizedHistory = (history || [])
          .filter(item => item.text && item.text.trim() !== '')
          .map(item => ({
            role: item.role,
            parts: [{ text: item.text }],
          }));

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key=${geminiApiKey}&alt=sse`;

        try {
          const apiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              },
              contents: [
                ...sanitizedHistory, // Используем очищенную историю
                { role: 'user', parts: [{ text: message }] }
              ],
              safetySettings,
            }),
          });

          if (!apiResponse.ok || !apiResponse.body) {
            const errorBody = await apiResponse.text();
            throw new Error(`Gemini API Error: ${apiResponse.status} ${errorBody}`);
          }

          const reader = apiResponse.body.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }

        } catch (error) {
          const errorMessage = `A backend error occurred: ${error.message}`;
          const errorSse = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: errorMessage }] } }] })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorSse));
        } finally {
          controller.close();
        }
      },
    });

    // Немедленно возвращаем поток, чтобы избежать тайм-аута.
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), { status: 500 });
  }
}
