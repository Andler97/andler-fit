// food-search edge function
// Hybrid food lookup for andler-fit:
//   - text query (default)      -> USDA FoodData Central (clean generic/whole foods)
//   - text query (source=off)   -> Open Food Facts text search (packaged foods)
//   - barcode                   -> Open Food Facts product
// Results are normalized to per-100g macros + named portions, cached into `foods`
// (service role, so it bypasses RLS), and returned with a stable `foodId`.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const USDA_KEY = Deno.env.get('USDA_FDC_API_KEY') ?? 'DEMO_KEY';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const UA = 'andler-fit/0.1 (nutrition tracker)';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

type Portion = { label: string; grams: number };
type Per100g = {
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null;
  sugars: number | null; fiber: number | null; satFat: number | null; salt: number | null;
};
type Item = {
  source: 'usda' | 'off';
  externalId: string;
  name: string;
  brand: string | null;
  verified: boolean;
  per100g: Per100g;
  servingSizeG: number | null;
  portions: Portion[];
  imageUrl: string | null;
};

function num(v: unknown): number | null {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof x === 'number' && !Number.isNaN(x) ? x : null;
}
function round1(v: number | null): number | null {
  return v == null ? null : Math.round(v * 10) / 10;
}
function parseServingG(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/([\d.]+)\s*g/i);
  return m ? num(m[1]) : null;
}

async function searchUsda(q: string, limit: number): Promise<Item[]> {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('query', q);
  url.searchParams.set('pageSize', String(limit));
  url.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS)');
  url.searchParams.set('api_key', USDA_KEY);
  const res = await fetch(url);
  if (!res.ok) return [];
  const j = await res.json();
  const foods: any[] = Array.isArray(j.foods) ? j.foods : [];
  return foods.map((f): Item => {
    const nut = (n: string) => {
      const e = (f.foodNutrients ?? []).find((x: any) => String(x.nutrientNumber) === n);
      return e ? num(e.value) : null;
    };
    let kcal = nut('208');
    if (kcal == null) {
      const kj = nut('268') ?? nut('958');
      if (kj != null) kcal = Math.round(kj / 4.184);
    }
    const sodiumMg = nut('307');
    const portions: Portion[] = [];
    for (const m of (f.foodMeasures ?? f.foodPortions ?? [])) {
      const grams = num(m.gramWeight);
      const label = m.disseminationText ?? m.modifier ?? m.portionDescription ?? m.measureUnitName;
      if (grams && grams > 0 && label) portions.push({ label: String(label), grams });
    }
    return {
      source: 'usda',
      externalId: String(f.fdcId),
      name: f.description ?? 'Food',
      brand: f.brandOwner ?? f.brandName ?? null,
      verified: true,
      per100g: {
        kcal, protein: round1(nut('203')), carbs: round1(nut('205')), fat: round1(nut('204')),
        sugars: round1(nut('269')), fiber: round1(nut('291')), satFat: round1(nut('606')),
        salt: sodiumMg != null ? round1((sodiumMg * 2.5) / 1000) : null,
      },
      servingSizeG: null,
      portions: portions.slice(0, 8),
      imageUrl: null,
    };
  });
}

function offProduct(p: any): Item | null {
  if (!p) return null;
  const nut = p.nutriments ?? {};
  const kcal = num(nut['energy-kcal_100g']) ??
    (num(nut['energy_100g']) != null ? Math.round((num(nut['energy_100g']) as number) / 4.184) : null);
  const ss = num(p.serving_quantity) ?? parseServingG(p.serving_size);
  return {
    source: 'off',
    externalId: String(p.code ?? ''),
    name: p.product_name || 'Unknown product',
    brand: p.brands ?? null,
    verified: false,
    per100g: {
      kcal, protein: round1(num(nut.proteins_100g)), carbs: round1(num(nut.carbohydrates_100g)),
      fat: round1(num(nut.fat_100g)), sugars: round1(num(nut.sugars_100g)), fiber: round1(num(nut.fiber_100g)),
      satFat: round1(num(nut['saturated-fat_100g'])), salt: round1(num(nut.salt_100g)),
    },
    servingSizeG: ss,
    portions: ss ? [{ label: `Serving (${ss} g)`, grams: ss }] : [],
    imageUrl: p.image_front_small_url ?? p.image_url ?? null,
  };
}

async function searchOff(q: string, limit: number): Promise<Item[]> {
  const url = new URL('https://search.openfoodfacts.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('page_size', String(limit));
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const j = await res.json();
  const hits: any[] = j.hits ?? j.products ?? [];
  return hits.map(offProduct).filter((x): x is Item => !!x && !!x.externalId);
}

async function lookupBarcode(barcode: string): Promise<Item | null> {
  const fields = 'product_name,brands,nutriments,image_front_small_url,serving_size,serving_quantity';
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`,
    { headers: { 'User-Agent': UA } },
  );
  if (!res.ok) return null;
  const j = await res.json();
  if (j.status !== 1 || !j.product) return null;
  return offProduct({ ...j.product, code: barcode });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const q = String(body.q ?? url.searchParams.get('q') ?? '').trim();
    const barcode = String(body.barcode ?? url.searchParams.get('barcode') ?? '').trim();
    const source = String(body.source ?? url.searchParams.get('source') ?? 'usda');
    const limit = Math.min(Number(body.limit ?? url.searchParams.get('limit') ?? 25) || 25, 40);

    let items: Item[] = [];
    if (barcode) {
      const one = await lookupBarcode(barcode);
      items = one ? [one] : [];
    } else if (q) {
      items = source === 'off' ? await searchOff(q, limit) : await searchUsda(q, limit);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const rows = items.filter((i) => i.externalId).map((i) => ({
      source: i.source,
      external_id: i.externalId,
      barcode: i.source === 'off' ? i.externalId : null,
      name: i.name,
      brand: i.brand,
      serving_size_g: i.servingSizeG,
      energy_kcal_100g: i.per100g.kcal,
      protein_100g: i.per100g.protein,
      carbs_100g: i.per100g.carbs,
      fat_100g: i.per100g.fat,
      sugars_100g: i.per100g.sugars,
      fiber_100g: i.per100g.fiber,
      saturated_fat_100g: i.per100g.satFat,
      salt_100g: i.per100g.salt,
      image_url: i.imageUrl,
      portions: i.portions,
      is_public: true,
    }));

    const idByExt = new Map<string, string>();
    if (rows.length) {
      const { data, error } = await admin
        .from('foods')
        .upsert(rows, { onConflict: 'source,external_id' })
        .select('id,source,external_id');
      if (error) console.error('upsert error', error.message);
      for (const r of data ?? []) idByExt.set(`${r.source}:${r.external_id}`, r.id);
    }

    const out = items.map((i) => ({ ...i, foodId: idByExt.get(`${i.source}:${i.externalId}`) ?? null }));
    return new Response(JSON.stringify({ items: out }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
