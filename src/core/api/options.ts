import { useEffect, useState } from 'react';
import { z } from 'zod';
import { apiError, http } from './http';
import { fetchHospitals } from './reference';

const optionSchema = z.object({
  value: z.string(),
  label: z.string(),
  meta: z.record(z.string(), z.unknown()),
});
const optionsSchema = z.record(z.string(), z.array(optionSchema));

export type RefOption = z.infer<typeof optionSchema>;
export type OptionList =
  | 'island'
  | 'country_of_origin'
  | 'tax_condition'
  | 'product_category'
  | 'hospital_region'
  | 'sku_quick_search';

let pending: Promise<Record<string, RefOption[]>> | null = null;

export function fetchOptions(): Promise<Record<string, RefOption[]>> {
  pending ??= http
    .get('/api/options')
    .then(({ data }) => optionsSchema.parse(data))
    .catch((err) => {
      pending = null;
      if (err instanceof z.ZodError) throw new Error('Bentuk pilihan server tidak sesuai.');
      throw apiError(err, 'Pilihan dropdown gagal dimuat.');
    });
  return pending;
}

let hospitalsInFlight: ReturnType<typeof fetchHospitals> | null = null;
const hospitalsOnce = () =>
  (hospitalsInFlight ??= fetchHospitals().finally(() => {
    hospitalsInFlight = null;
  }));

/** Active hospital units in the DB; null until loaded so copy never shows a made-up number. */
export function useActiveHospitalCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    hospitalsOnce()
      .then((list) => live && setCount(list.filter((h) => h.isActive).length))
      .catch((err) => console.error(err));
    return () => {
      live = false;
    };
  }, []);
  return count;
}

export function useOptions(list: OptionList): RefOption[] {
  const [options, setOptions] = useState<RefOption[]>([]);
  useEffect(() => {
    let live = true;
    fetchOptions()
      .then((all) => live && setOptions(all[list] ?? []))
      .catch((err) => console.error(err));
    return () => {
      live = false;
    };
  }, [list]);
  return options;
}
