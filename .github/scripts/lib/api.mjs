const AI_API_URL =
    process.env.AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

export async function callAIWithRetry({
    systemPrompt,
    userPrompt,
    temperature,
    maxTokens = 2048,
}) {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const response = await fetch(AI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.AI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature,
                    max_tokens: maxTokens,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 429 && attempt < MAX_RETRIES) {
                    const match = errorText.match(
                        /try again in (\d+(?:\.\d+)?)s/,
                    );
                    const waitMs = match
                        ? Math.ceil(parseFloat(match[1]) * 1000) + 1000
                        : 5000;
                    console.warn(
                        `Rate limited, retrying in ${waitMs}ms (attempt ${attempt}/${MAX_RETRIES})...`,
                    );
                    await new Promise((r) => setTimeout(r, waitMs));
                    continue;
                }
                throw new Error(
                    `AI API error (${response.status}): ${errorText}`,
                );
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    }
}
