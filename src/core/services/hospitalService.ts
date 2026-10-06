import * as XLSX from 'xlsx';
import { HospitalUnit, IndonesiaIsland } from '../types';
import { deleteHospitalDoc, fetchHospitals, patchHospitalActive, saveHospitalDoc } from '../api/reference';

class HospitalService {
  /**
   * Get all hospitals in master data
   */
  async getAllHospitals(): Promise<HospitalUnit[]> {
    return (await fetchHospitals()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get only active hospitals (for vendor portals, coverage selections, etc.)
   */
  async getActiveHospitals(): Promise<HospitalUnit[]> {
    const all = await this.getAllHospitals();
    return all.filter((h) => h.isActive);
  }

  /**
   * Save or update a single hospital
   */
  async saveHospital(data: Partial<HospitalUnit> & { name: string; city: string }): Promise<HospitalUnit> {
    const now = new Date().toISOString();
    const id = data.id || `hosp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const code = (data.code || data.name.substring(0, 4).toUpperCase()).trim();

    const hospital: HospitalUnit = {
      id,
      code,
      name: data.name.trim(),
      city: data.city.trim(),
      province: data.province?.trim() || '',
      island: (data.island?.trim() as IndonesiaIsland) || 'Jawa',
      type: data.type?.trim() || 'Rumah Sakit Umum',
      bedCapacity: Number(data.bedCapacity) || 0,
      address: data.address?.trim() || '',
      phone: data.phone?.trim() || '',
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: data.createdAt || now,
      updatedAt: now,
    };

    return await saveHospitalDoc(hospital);
  }

  /**
   * Bulk save hospitals (e.g. from Excel upload)
   */
  async bulkSaveHospitals(hospitals: HospitalUnit[]): Promise<HospitalUnit[]> {
    const saved: HospitalUnit[] = [];
    for (const hospital of hospitals) saved.push(await saveHospitalDoc(hospital));
    return saved;
  }

  /**
   * Delete hospital by ID
   */
  async deleteHospital(id: string): Promise<void> {
    await deleteHospitalDoc(id);
  }

  /**
   * Toggle hospital active state
   */
  async toggleHospitalActive(id: string, isActive: boolean): Promise<HospitalUnit | null> {
    return await patchHospitalActive(id, isActive);
  }

  /**
   * Parse uploaded Excel file for Master Hospitals
   */
  async parseHospitalExcel(file: File): Promise<{
    validHospitals: HospitalUnit[];
    errors: string[];
    summary: { totalRows: number; newCount: number; updatedCount: number };
  }> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('File Excel tidak memiliki lembar kerja (worksheet).');
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

    if (rawRows.length === 0) {
      throw new Error('Sheet Excel kosong, tidak ada baris data rumah sakit.');
    }

    const errors: string[] = [];
    const validHospitals: HospitalUnit[] = [];
    const now = new Date().toISOString();

    const existingHospitals = await this.getAllHospitals();
    const existingMapByCode = new Map(existingHospitals.map((h) => [h.code.toUpperCase(), h]));
    const existingMapByName = new Map(existingHospitals.map((h) => [h.name.toLowerCase().trim(), h]));

    let newCount = 0;
    let updatedCount = 0;

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2; // Row number in Excel (header is row 1)

      // Normalize keys: look for variations like 'Nama Rumah Sakit', 'Nama RS', 'Hospital Name', etc.
      const name = String(
        row['Nama Rumah Sakit'] ||
        row['Nama RS'] ||
        row['Hospital Name'] ||
        row['name'] ||
        row['Nama Unit'] ||
        ''
      ).trim();

      if (!name) {
        errors.push(`Baris ${rowNum}: Nama Rumah Sakit wajib diisi.`);
        return;
      }

      const codeRaw = String(
        row['Kode Unit'] ||
        row['Kode RS'] ||
        row['Hospital Code'] ||
        row['code'] ||
        row['Kode'] ||
        ''
      ).trim();

      const city = String(
        row['Kota / Kabupaten'] ||
        row['Kota'] ||
        row['City'] ||
        row['Kabupaten'] ||
        row['city'] ||
        ''
      ).trim() || 'Nasional';

      const province = String(
        row['Provinsi'] ||
        row['Province'] ||
        row['province'] ||
        ''
      ).trim();

      const islandRaw = String(
        row['Pulau / Wilayah'] ||
        row['Pulau'] ||
        row['Wilayah'] ||
        row['Island'] ||
        row['island'] ||
        ''
      ).trim();

      const island = this.normalizeIsland(islandRaw || city);

      const type = String(
        row['Tipe RS'] ||
        row['Tipe / Kelas'] ||
        row['Kelas'] ||
        row['type'] ||
        ''
      ).trim() || 'Rumah Sakit Umum';

      const bedCapacity = Number(row['Kapasitas Tempat Tidur'] || row['Beds'] || row['Kapasitas'] || 0) || undefined;

      const activeRaw = String(
        row['Status Aktif'] ||
        row['Status'] ||
        row['Aktif'] ||
        row['isActive'] ||
        ''
      ).trim().toLowerCase();

      const isActive =
        activeRaw === 'tidak' ||
        activeRaw === 'nonaktif' ||
        activeRaw === 'non-aktif' ||
        activeRaw === 'false' ||
        activeRaw === '0'
          ? false
          : true;

      // Determine matching existing record by Code or Name
      const codeKey = codeRaw.toUpperCase();
      const nameKey = name.toLowerCase().trim();
      const existing = (codeKey && existingMapByCode.get(codeKey)) || existingMapByName.get(nameKey);

      const id = existing
        ? existing.id
        : `hosp-${codeRaw ? codeRaw.toLowerCase() : Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const finalCode = codeRaw || (existing ? existing.code : name.substring(0, 4).toUpperCase());

      if (existing) {
        updatedCount++;
      } else {
        newCount++;
      }

      validHospitals.push({
        id,
        code: finalCode,
        name,
        city,
        province,
        island,
        type,
        bedCapacity,
        isActive,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      });
    });

    return {
      validHospitals,
      errors,
      summary: {
        totalRows: rawRows.length,
        newCount,
        updatedCount,
      },
    };
  }

  /**
   * Helper to normalize island name based on keyword or province/city
   */
  private normalizeIsland(rawText: string): IndonesiaIsland {
    const t = rawText.toLowerCase();
    if (t.includes('bali') || t.includes('lombok') || t.includes('nusa') || t.includes('kupang') || t.includes('bajo') || t.includes('ntb') || t.includes('ntt')) {
      return 'Bali & Nusa Tenggara';
    }
    if (t.includes('sumater') || t.includes('medan') || t.includes('palembang') || t.includes('padang') || t.includes('pekanbaru') || t.includes('lampung') || t.includes('riau') || t.includes('aceh')) {
      return 'Sumatera';
    }
    if (t.includes('kalimantan') || t.includes('balikpapan') || t.includes('banjarmasin') || t.includes('samarinda') || t.includes('pontianak') || t.includes('palangka')) {
      return 'Kalimantan';
    }
    if (t.includes('sulawesi') || t.includes('makassar') || t.includes('manado') || t.includes('palu') || t.includes('kendari') || t.includes('gorontalo') || t.includes('buton') || t.includes('baubau')) {
      return 'Sulawesi';
    }
    if (t.includes('maluku') || t.includes('papua') || t.includes('ambon') || t.includes('jayapura') || t.includes('sorong') || t.includes('ternate')) {
      return 'Maluku & Papua';
    }
    return 'Jawa';
  }

  /**
   * Download Excel Template for Hospitals
   */
  downloadHospitalTemplate(): void {
    const templateData = [
      {
        'Kode Unit': 'SHLV',
        'Nama Rumah Sakit': 'Siloam Hospitals Lippo Village',
        'Kota / Kabupaten': 'Tangerang',
        'Provinsi': 'Banten',
        'Pulau / Wilayah': 'Jawa',
        'Tipe RS': 'Rumah Sakit Umum Tipe B',
        'Kapasitas Tempat Tidur': 280,
        'Status Aktif': 'Aktif',
      },
      {
        'Kode Unit': 'MRCCC',
        'Nama Rumah Sakit': 'MRCCC Siloam Semanggi Jakarta',
        'Kota / Kabupaten': 'Jakarta Selatan',
        'Provinsi': 'DKI Jakarta',
        'Pulau / Wilayah': 'Jawa',
        'Tipe RS': 'Comprehensive Cancer Center Tipe A',
        'Kapasitas Tempat Tidur': 320,
        'Status Aktif': 'Aktif',
      },
      {
        'Kode Unit': 'SHDP',
        'Nama Rumah Sakit': 'Siloam Hospitals Denpasar Bali',
        'Kota / Kabupaten': 'Badung / Denpasar',
        'Provinsi': 'Bali',
        'Pulau / Wilayah': 'Bali & Nusa Tenggara',
        'Tipe RS': 'Rumah Sakit Umum Tipe B',
        'Kapasitas Tempat Tidur': 190,
        'Status Aktif': 'Aktif',
      },
      {
        'Kode Unit': 'SHMD',
        'Nama Rumah Sakit': 'Siloam Hospitals Medan Dhirga Surya',
        'Kota / Kabupaten': 'Medan',
        'Provinsi': 'Sumatera Utara',
        'Pulau / Wilayah': 'Sumatera',
        'Tipe RS': 'Rumah Sakit Umum Tipe B',
        'Kapasitas Tempat Tidur': 180,
        'Status Aktif': 'Aktif',
      },
      {
        'Kode Unit': 'SHBP',
        'Nama Rumah Sakit': 'Siloam Hospitals Balikpapan',
        'Kota / Kabupaten': 'Balikpapan',
        'Provinsi': 'Kalimantan Timur',
        'Pulau / Wilayah': 'Kalimantan',
        'Tipe RS': 'Rumah Sakit Umum Tipe B',
        'Kapasitas Tempat Tidur': 165,
        'Status Aktif': 'Aktif',
      },
      {
        'Kode Unit': 'SHMK',
        'Nama Rumah Sakit': 'Siloam Hospitals Makassar',
        'Kota / Kabupaten': 'Makassar',
        'Provinsi': 'Sulawesi Selatan',
        'Pulau / Wilayah': 'Sulawesi',
        'Tipe RS': 'Rumah Sakit Umum Tipe B',
        'Kapasitas Tempat Tidur': 195,
        'Status Aktif': 'Aktif',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 12 }, // Kode Unit
      { wch: 38 }, // Nama RS
      { wch: 22 }, // Kota
      { wch: 18 }, // Provinsi
      { wch: 24 }, // Pulau
      { wch: 32 }, // Tipe RS
      { wch: 24 }, // Kapasitas
      { wch: 14 }, // Status Aktif
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master_Rumah_Sakit');

    XLSX.writeFile(workbook, 'Template_Master_Rumah_Sakit_Siloam.xlsx');
  }

  /**
   * Export all or filtered hospitals to Excel
   */
  exportHospitalsToExcel(hospitals: HospitalUnit[], filename = 'Master_Data_Rumah_Sakit_Siloam.xlsx'): void {
    const data = hospitals.map((h, index) => ({
      No: index + 1,
      'Kode Unit': h.code,
      'Nama Rumah Sakit': h.name,
      'Kota / Kabupaten': h.city,
      'Provinsi': h.province || '-',
      'Pulau / Wilayah': h.island,
      'Tipe / Kelas RS': h.type || 'Rumah Sakit Umum',
      'Kapasitas Tempat Tidur': h.bedCapacity || '-',
      'Status Unit': h.isActive ? 'Aktif' : 'Non-Aktif',
      'Terakhir Diupdate': h.updatedAt ? new Date(h.updatedAt).toLocaleDateString('id-ID') : '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 6 },  // No
      { wch: 12 }, // Kode
      { wch: 40 }, // Nama RS
      { wch: 22 }, // Kota
      { wch: 20 }, // Provinsi
      { wch: 24 }, // Pulau
      { wch: 32 }, // Tipe
      { wch: 22 }, // Kapasitas
      { wch: 14 }, // Status
      { wch: 18 }, // Updated
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar_RS_Siloam');
    XLSX.writeFile(workbook, filename);
  }
}

export const hospitalService = new HospitalService();
