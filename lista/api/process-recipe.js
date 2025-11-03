// api/process-recipe.js
// Backend dla Vercel - przetwarza przepisy przez OpenAI z makroskładnikami

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ocrText } = req.body;

    if (!ocrText || ocrText.trim().length < 10) {
      return res.status(400).json({ error: 'Brak tekstu OCR' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Brak klucza API' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'Jesteś asystentem kulinarnym. Wyciągnij składniki, makroskładniki i kalorie. Zwróć JSON.'
        }, {
          role: 'user',
          content: `Z tekstu OCR wyciągnij:
1. Tytuł przepisu
2. Składniki
3. Makroskładniki (białko, węglowodany, tłuszcze, kalorie)

Tekst OCR:
${ocrText}

WAŻNE o makroskładnikach:
- Szukaj: "białko", "b:", "b", "protein"
- Szukaj: "węglowodany", "węgle", "w:", "w", "carbs"  
- Szukaj: "tłuszcze", "tłuszcz", "t:", "t", "fat"
- Szukaj: "kalorie", "kcal", "cal"
- Skróty: "500kcal, 40b, 14t, 57w" = 500 kcal, 40g białka, 14g tłuszczu, 57g węgli
- Jeśli brak w tekście, zwróć null

Zwróć TYLKO JSON:
{
  "title": "nazwa",
  "ingredients": ["składnik 1", "składnik 2"],
  "macros": {
    "calories": 500,
    "protein": 40,
    "carbs": 57,
    "fat": 14
  }
}

Lub jeśli brak makro:
{
  "title": "nazwa",
  "ingredients": [...],
  "macros": null
}

ZASADY:
- Usuń myślniki/kropki z początku składników
- Każdy składnik osobno
- BEZ instrukcji, BEZ nagłówków
- Makroskładniki w gramach, kalorie w kcal`
        }],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Błąd OpenAI');
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('GPT nie zwrócił JSON');
    }

    const result = JSON.parse(jsonMatch[0]);

    return res.status(200).json({
      success: true,
      title: result.title || 'Przepis',
      ingredients: result.ingredients || [],
      macros: result.macros
    });

  } catch (error) {
    console.error('Backend error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}// api/process-recipe.js
// Backend dla Vercel - przetwarza przepisy przez OpenAI

export default async function handler(req, res) {
  // CORS headers - pozwól na żądania z przeglądarki
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Obsługa OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Tylko POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ocrText } = req.body;

    if (!ocrText || ocrText.trim().length < 10) {
      return res.status(400).json({ error: 'Brak tekstu OCR' });
    }

    // KLUCZ API - bezpiecznie zapisany w zmiennych środowiskowych Vercel
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Brak klucza API na serwerze' });
    }

    // Zapytanie do OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'Jesteś asystentem kulinarnym. Wyciągnij z tekstu składniki i zwróć JSON bez dodatkowego tekstu.'
        }, {
          role: 'user',
          content: `Z tekstu OCR wyciągnij tytuł przepisu i składniki. Popraw błędy OCR (np. "1509" to "150g").

Tekst OCR:
${ocrText}

Zwróć TYLKO JSON:
{
  "title": "nazwa",
  "ingredients": ["składnik 1", "składnik 2"]
}

WAŻNE:
- Usuń myślniki/kropki z początku
- Każdy składnik osobno
- BEZ instrukcji, BEZ nagłówków`
        }],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Błąd OpenAI API');
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Parsuj JSON z odpowiedzi
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('GPT nie zwrócił JSON');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Zwróć wynik
    return res.status(200).json({
      success: true,
      title: result.title || 'Przepis',
      ingredients: result.ingredients || []
    });

  } catch (error) {
    console.error('Backend error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}