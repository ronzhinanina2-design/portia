const PROMPT = `You are reading a nutrition facts label from a photo for a food-tracking app. Extract ONLY total calories, protein, carbohydrates, and fat, expressed per 100g (or per 100ml for liquids) of the food.

Rules:
- If the label already states values per 100g / per 100ml, use those directly.
- If the label states values per serving, use the serving size printed on the label to convert to per-100g values: (value / serving_size_in_grams) * 100. Only convert if the serving size is given as a weight in grams or millilitres.
- If the serving size is given only in a non-metric unit (e.g. "1 cup", "2 cookies", "1 bar") with no gram/ml weight listed anywhere on the label, you cannot reliably convert — do not guess.
- Round calories to the nearest whole number, and protein/carbs/fat to one decimal place.
- Set "readable" to true only if you are confident in all four numbers. If the photo is blurry, cropped, doesn't show a nutrition label, or is missing what you'd need to compute per-100g values, set "readable" to false and leave the four numeric fields null.

Respond with structured data only — no explanation.`;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// The @anthropic-ai/sdk and zod imports happen inside the handler, at request
// time, rather than at module top level. If anything about them fails —
// package not installed, missing ANTHROPIC_API_KEY (the SDK client throws on
// construction with no key), a bad import path — the whole module would
// otherwise fail to load and Vercel would return a bare, header-less crash
// page for every request (including the CORS preflight), which is exactly
// what shows up in the browser as a misleading "no CORS header" error.
// Importing lazily inside the try/catch below guarantees setCors() has
// already run and every failure mode still comes back as real JSON.
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

  let Anthropic, z, zodOutputFormat;
  try {
    ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
    ({ z } = await import('zod'));
    ({ zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod'));
  } catch (err) {
    console.error('scan-label: failed to load dependencies — check the Vercel deployment installed @anthropic-ai/sdk and zod', err);
    res.status(500).json({ ok: false, reason: 'server-error' });
    return;
  }

  let client;
  try {
    client = new Anthropic();
  } catch (err) {
    console.error('scan-label: could not create Anthropic client — check ANTHROPIC_API_KEY is set in Vercel project env vars', err.message);
    res.status(500).json({ ok: false, reason: 'server-error' });
    return;
  }

  const LabelMacros = z.object({
    readable: z.boolean(),
    kcal: z.number().nullable(),
    protein: z.number().nullable(),
    carbs: z.number().nullable(),
    fat: z.number().nullable(),
  });

  try {
    const response = await client.messages.parse({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      output_config: {
        format: zodOutputFormat(LabelMacros),
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed || !parsed.readable || parsed.kcal == null || parsed.protein == null || parsed.carbs == null || parsed.fat == null) {
      res.status(200).json({ ok: false, reason: 'unreadable' });
      return;
    }

    res.status(200).json({ ok: true, kcal: parsed.kcal, protein: parsed.protein, carbs: parsed.carbs, fat: parsed.fat });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('scan-label: authentication error — check ANTHROPIC_API_KEY', err.message);
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error('scan-label: rate limited', err.message);
    } else if (err instanceof Anthropic.APIStatusError) {
      console.error('scan-label: API error', err.status, err.message);
    } else if (err instanceof Anthropic.APIConnectionError) {
      console.error('scan-label: connection error', err.message);
    } else {
      console.error('scan-label: unexpected error', err);
    }
    res.status(500).json({ ok: false, reason: 'server-error' });
  }
}
