// Talks to the Claude Messages API directly over fetch rather than through
// @anthropic-ai/sdk. The SDK's dependency graph pulls in a webhook-signature
// helper (`standardwebhooks`) that CommonJS-requires an ESM-only package
// (`@stablelib/base64`) — Node can't do that, and it crashes the whole
// module on import under Vercel's runtime (FUNCTION_INVOCATION_FAILED on
// every request, including the CORS preflight). This one call is simple
// enough that the plain REST API avoids the whole dependency chain.
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const PROMPT = `You are reading a nutrition facts label from a photo for a food-tracking app. Extract ONLY total calories, protein, carbohydrates, and fat, expressed per 100g (or per 100ml for liquids) of the food.

Rules:
- If the label already states values per 100g / per 100ml, use those directly.
- If the label states values per serving, use the serving size printed on the label to convert to per-100g values: (value / serving_size_in_grams) * 100. Only convert if the serving size is given as a weight in grams or millilitres.
- If the serving size is given only in a non-metric unit (e.g. "1 cup", "2 cookies", "1 bar") with no gram/ml weight listed anywhere on the label, you cannot reliably convert — do not guess.
- Round calories to the nearest whole number, and protein/carbs/fat to one decimal place.
- Set "readable" to true only if you are confident in all four numbers. If the photo is blurry, cropped, doesn't show a nutrition label, or is missing what you'd need to compute per-100g values, set "readable" to false and leave the four numeric fields null.

Respond with ONLY a single JSON object, no markdown code fences, no explanation, no other text — exactly this shape:
{"readable": boolean, "kcal": number|null, "protein": number|null, "carbs": number|null, "fat": number|null}`;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseLabelMacros(text) {
  // Strip a markdown fence if the model adds one despite instructions not to.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.readable !== 'boolean') return null;
  const nums = ['kcal', 'protein', 'carbs', 'fat'];
  for (const key of nums) {
    if (parsed[key] !== null && typeof parsed[key] !== 'number') return null;
  }
  return parsed;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'method-not-allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { imageBase64, mediaType } = body || {};
  if (!imageBase64 || !mediaType || !/^image\/(jpeg|png|webp|gif)$/.test(mediaType)) {
    res.status(400).json({ ok: false, reason: 'bad-request' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('scan-label: ANTHROPIC_API_KEY is not set in this deployment\'s environment variables');
    res.status(500).json({ ok: false, reason: 'server-error', stage: 'missing-key' });
    return;
  }

  try {
    const apiRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });

    const payload = await apiRes.json();

    if (!apiRes.ok) {
      console.error('scan-label: Claude API error', apiRes.status, payload && payload.error);
      res.status(500).json({ ok: false, reason: 'server-error', stage: 'api-error', detail: `${apiRes.status} ${payload && payload.error && payload.error.message}` });
      return;
    }

    const textBlock = (payload.content || []).find((b) => b.type === 'text');
    const parsed = textBlock && parseLabelMacros(textBlock.text);

    if (!parsed || !parsed.readable || parsed.kcal == null || parsed.protein == null || parsed.carbs == null || parsed.fat == null) {
      res.status(200).json({ ok: false, reason: 'unreadable' });
      return;
    }

    res.status(200).json({ ok: true, kcal: parsed.kcal, protein: parsed.protein, carbs: parsed.carbs, fat: parsed.fat });
  } catch (err) {
    console.error('scan-label: unexpected error', err);
    res.status(500).json({ ok: false, reason: 'server-error', stage: 'unexpected', detail: String((err && err.message) || err) });
  }
}
