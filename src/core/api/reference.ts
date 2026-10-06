import { z } from 'zod';
import { HospitalUnit, TenderEvent } from '../types';
import { apiError, http } from './http';

const hospitalSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  city: z.string(),
  province: z.string(),
  island: z.string(),
  type: z.string().nullish(),
  bedCapacity: z.number().nullish(),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const tenderSchema = z.object({
  id: z.string(),
  tenderNumber: z.string(),
  title: z.string(),
  description: z.string(),
  submissionDeadline: z.string(),
  status: z.enum(['draft', 'open', 'evaluation', 'completed']),
  targetUnits: z.array(z.string()),
  totalSkus: z.number(),
  createdAt: z.string(),
});

function hospitalFromDoc(row: z.infer<typeof hospitalSchema>): HospitalUnit {
  return {
    ...row,
    type: row.type ?? undefined,
    bedCapacity: row.bedCapacity ?? undefined,
    address: row.address ?? undefined,
    phone: row.phone ?? undefined,
  };
}

export async function saveHospitalDoc(unit: HospitalUnit): Promise<HospitalUnit> {
  try {
    const { data } = await http.post('/api/hospitals', unit);
    return hospitalFromDoc(hospitalSchema.parse(data));
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data rumah sakit tidak sesuai.');
    throw apiError(err, 'Rumah sakit gagal disimpan.');
  }
}

export async function patchHospitalActive(id: string, isActive: boolean): Promise<HospitalUnit> {
  try {
    const { data } = await http.patch(`/api/hospitals/${encodeURIComponent(id)}`, { isActive });
    return hospitalFromDoc(hospitalSchema.parse(data));
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data rumah sakit tidak sesuai.');
    throw apiError(err, 'Status rumah sakit gagal diubah.');
  }
}

export async function deleteHospitalDoc(id: string): Promise<void> {
  try {
    await http.delete(`/api/hospitals/${encodeURIComponent(id)}`);
  } catch (err) {
    throw apiError(err, 'Rumah sakit gagal dihapus.');
  }
}

export async function fetchHospitals(): Promise<HospitalUnit[]> {
  try {
    const { data } = await http.get('/api/hospitals');
    return z.array(hospitalSchema).parse(data).map(hospitalFromDoc);
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data rumah sakit tidak sesuai.');
    throw apiError(err, 'Daftar rumah sakit gagal dimuat.');
  }
}

export async function fetchTenders(): Promise<TenderEvent[]> {
  try {
    const { data } = await http.get('/api/staff/tenders');
    return z.array(tenderSchema).parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) throw new Error('Bentuk data tender tidak sesuai.');
    throw apiError(err, 'Daftar tender gagal dimuat.');
  }
}
