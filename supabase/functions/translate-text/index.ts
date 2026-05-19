import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese (Brazilian)',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const texts: string[] = Array.isArray(body?.texts) ? body.texts.filter((t: any) => typeof t === 'string') : [];
    const target: string = typeof body?.target === 'string' ? body.target : 'en';
    if (texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing LOVABLE_API_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const targetName = LANG_NAMES[target] || target;

    const prompt = `Translate every item below into ${targetName}. ALWAYS translate normal words and phrases, even when written in ALL CAPS — uppercase is just styling, not a code. Preserve the original casing style (ALL CAPS stays ALL CAPS, Title Case stays Title Case). Only keep untouched: proper product/brand names, SKU codes, dosages (e.g. "5mg", "10ml") and pure numbers. Return ONLY a JSON array of strings in the same order, no comments, no markdown fences.\n\nITEMS:\n${JSON.stringify(texts)}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: 'You are a precise translator. Output only valid JSON arrays of strings.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: 'AI gateway error', detail: errText }), { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    let translations: string[] = texts;
    try {
      const match = content.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(match ? match[0] : content);
      if (Array.isArray(parsed)) translations = parsed.map((v) => String(v));
    } catch {
      // fall back to original
    }
    if (translations.length !== texts.length) translations = texts;

    return new Response(JSON.stringify({ translations }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});