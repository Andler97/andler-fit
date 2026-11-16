const BASE = 'https://world.openfoodfacts.org/api/v2/product/';

export interface OffFood {
  barcode: string;
  name: string;
  brand: string | null;
  kcal100: number | null;
  protein100: number | null;
  carbs100: number | null;
  fat100: number | null;
  sugars100: number | null;
  fiber100: number | null;
  satFat100: number | null;
  salt100: number | null;
  imageUrl: string | null;
  servingSizeG: number | null;
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && !Number.isNaN(n) ? n : null;
}

function parseServingG(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/([\d.]+)\s*g/i);
  return m ? num(m[1]) : null;
}

export async function lookupBarcode(barcode: string): Promise<OffFood | null> {
  const fields =
    'product_name,brands,nutriments,image_front_small_url,serving_size';
  const res = await fetch(`${BASE}${encodeURIComponent(barcode)}.json?fields=${fields}`, {
    headers: { 'User-Agent': 'andler-fit/0.1 (nutrition tracker)' },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  if (json.status !== 1 || !json.product) return null;

  const p = json.product;
  const n = p.nutriments ?? {};
  const kcal100 =
    num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) != null ? Math.round((num(n['energy_100g']) as number) / 4.184) : null);

  return {
    barcode,
    name: p.product_name || 'Unknown product',
    brand: p.brands || null,
    kcal100,
    protein100: num(n.proteins_100g),
    carbs100: num(n.carbohydrates_100g),
    fat100: num(n.fat_100g),
    sugars100: num(n.sugars_100g),
    fiber100: num(n.fiber_100g),
    satFat100: num(n['saturated-fat_100g']),
    salt100: num(n.salt_100g),
    imageUrl: p.image_front_small_url || null,
    servingSizeG: parseServingG(p.serving_size),
  };
}

export function scaleMacros(food: OffFood, grams: number) {
  const f = (per100: number | null) => (per100 == null ? 0 : (per100 * grams) / 100);
  return {
    kcal: Math.round(f(food.kcal100)),
    protein_g: Math.round(f(food.protein100) * 10) / 10,
    carbs_g: Math.round(f(food.carbs100) * 10) / 10,
    fat_g: Math.round(f(food.fat100) * 10) / 10,
  };
}
