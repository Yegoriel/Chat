// File: api/chat.js - FINAL VERSION WITH DUPLICATION FIX

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
    // Мы по-прежнему получаем оба поля, но будем использовать только `history`.
    const { history } = await req.json();
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) { return new Response('API key not configured', { status: 500 }); }
    // Проверяем, что история вообще существует.
    if (!history || history.length === 0) { return new Response('History is required', { status: 400 }); }

    const stream = new ReadableStream({
      async start(controller) {
        
        // --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: ИСПОЛЬЗУЕМ ТОЛЬКО HISTORY ---
        // `history`, приходящая с фронтенда, уже содержит последнее сообщение пользователя.
        // Мы просто реконструируем ее, правильно обрабатывая файлы.
        const reconstructedContents = (history || []).map(item => {
          let fullText = item.text || '';
          if (item.role === 'user' && item.fileName && item.fileContent) {
            const fileContext = `\n\n--- Start of File: ${item.fileName} ---\n${item.fileContent}\n--- End of File ---`;
            fullText += fileContext;
          }
          return {
            role: item.role,
            parts: [{ text: fullText }],
          };
        }).filter(item => item.parts[0].text && item.parts[0].text.trim() !== '');

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key=${geminiApiKey}&alt=sse`;

        try {
          const apiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              },
              // Мы больше не добавляем отдельную переменную `message`, предотвращая дублирование.
              contents: reconstructedContents, 
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

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), { status: 500 });
  }
}
