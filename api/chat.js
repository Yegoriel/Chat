// File: api/chat.js - FINAL VERSION TO PREVENT VERCEL TIMEOUTS

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

    if (!geminiApiKey) {
      return new Response('API key not configured', { status: 500 });
    }
    if (!message) {
      return new Response('Message is required', { status: 400 });
    }

    // Создаем управляемый поток (stream).
    const stream = new ReadableStream({
      async start(controller) {
        // Этот код выполняется в фоновом режиме ПОСЛЕ того, как Vercel уже получил ответ.
        const formattedHistory = (history || []).map(item => ({
          role: item.role,
          parts: [{ text: item.text }],
        }));

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?key=${geminiApiKey}&alt=sse`;

        try {
          const apiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              // Используем правильную структуру запроса для 2.5 Pro
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

          // Если сам API Gemini вернет ошибку, мы безопасно обработаем ее.
          if (!apiResponse.ok || !apiResponse.body) {
            const errorBody = await apiResponse.text();
            throw new Error(`Gemini API Error: ${apiResponse.status} ${errorBody}`);
          }

          // Начинаем читать поток от Gemini и пересылать его клиенту.
          const reader = apiResponse.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break; // Поток от Gemini завершен.
            }
            // Пересылаем полученный кусок данных (chunk) напрямую в браузер.
            controller.enqueue(value);
          }

        } catch (error) {
          console.error('Stream Error:', error);
          // Отправляем сообщение об ошибке в браузер в формате, который он сможет отобразить.
          const errorMessage = `A backend error occurred: ${error.message}`;
          const errorSse = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: errorMessage }] } }] })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorSse));
        } finally {
          // Важно: всегда закрываем наш поток, когда все закончено.
          controller.close();
        }
      },
    });

    // САМОЕ ГЛАВНОЕ: Возвращаем поток Vercel НЕМЕДЛЕННО.
    // Это удовлетворяет требование Vercel по тайм-ауту и предотвращает ошибку 500.
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Outer Handler Error:', error);
    return new Response(JSON.stringify({ error: 'An internal error occurred' }), { status: 500 });
  }
}
