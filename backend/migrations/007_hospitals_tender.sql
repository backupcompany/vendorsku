-- Same hospital and tender rows the screens already show.
INSERT INTO hospitals (
  id, code, name, city, province, island, type, bed_capacity, is_active, created_at, updated_at
) VALUES
  ('hosp-shlv', 'SHLV', 'Siloam Hospitals Lippo Village', 'Tangerang', 'Banten', 'Jawa', 'Rumah Sakit Umum Tipe B', 280, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-mrccc', 'MRCCC', 'MRCCC Siloam Semanggi Jakarta', 'Jakarta Selatan', 'DKI Jakarta', 'Jawa', 'Comprehensive Cancer Center Tipe A', 320, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shkj', 'SHKJ', 'Siloam Hospitals Kebon Jeruk', 'Jakarta Barat', 'DKI Jakarta', 'Jawa', 'Rumah Sakit Umum Tipe B', 210, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shtb', 'SHTB', 'Siloam Hospitals TB Simatupang', 'Jakarta Selatan', 'DKI Jakarta', 'Jawa', 'Rumah Sakit Umum Tipe B', 160, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shas', 'SHAS', 'Siloam Hospitals Asri Mampang', 'Jakarta Selatan', 'DKI Jakarta', 'Jawa', 'Specialist Urology & General Tipe B', 120, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shag', 'SHAG', 'Siloam Hospitals Agora Cempaka Putih', 'Jakarta Pusat', 'DKI Jakarta', 'Jawa', 'Rumah Sakit Umum Tipe C', 140, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shdg', 'SHDG', 'RS Jantung Diagram Siloam Cinere', 'Depok', 'Jawa Barat', 'Jawa', 'Rumah Sakit Khusus Jantung Tipe B', 100, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shkd', 'SHKD', 'RS Umum Siloam Kelapa Dua', 'Tangerang', 'Banten', 'Jawa', 'Rumah Sakit Umum Tipe C', 110, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shst', 'SHST', 'Siloam Hospitals Sentosa Bekasi', 'Bekasi', 'Jawa Barat', 'Jawa', 'Rumah Sakit Umum Tipe C', 95, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shbg', 'SHBG', 'Siloam Hospitals Bogor', 'Bogor', 'Jawa Barat', 'Jawa', 'Rumah Sakit Umum Tipe B', 150, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shpw', 'SHPW', 'Siloam Hospitals Purwakarta', 'Purwakarta', 'Jawa Barat', 'Jawa', 'Rumah Sakit Umum Tipe B', 130, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shcr', 'SHCR', 'Siloam Hospitals Cirebon Putera Bahagia', 'Cirebon', 'Jawa Barat', 'Jawa', 'Rumah Sakit Umum Tipe C', 105, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shsb', 'SHSB', 'Siloam Hospitals Surabaya', 'Surabaya', 'Jawa Timur', 'Jawa', 'Rumah Sakit Umum Tipe B', 220, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shyg', 'SHYG', 'Siloam Hospitals Yogyakarta', 'Yogyakarta', 'D.I. Yogyakarta', 'Jawa', 'Rumah Sakit Umum Tipe B', 140, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shsm', 'SHSM', 'Siloam Hospitals Semarang', 'Semarang', 'Jawa Tengah', 'Jawa', 'Rumah Sakit Umum Tipe C', 110, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shjb', 'SHJB', 'Siloam Hospitals Jember', 'Jember', 'Jawa Timur', 'Jawa', 'Rumah Sakit Umum Tipe C', 115, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shdp', 'SHDP', 'Siloam Hospitals Denpasar Bali', 'Badung / Denpasar', 'Bali', 'Bali & Nusa Tenggara', 'Rumah Sakit Umum Tipe B', 190, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shmt', 'SHMT', 'Siloam Hospitals Mataram Lombok', 'Mataram', 'Nusa Tenggara Barat', 'Bali & Nusa Tenggara', 'Rumah Sakit Umum Tipe B', 120, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shkp', 'SHKP', 'Siloam Hospitals Kupang', 'Kupang', 'Nusa Tenggara Timur', 'Bali & Nusa Tenggara', 'Rumah Sakit Umum Tipe B', 140, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shlb', 'SHLB', 'Siloam Hospitals Labuan Bajo', 'Manggarai Barat', 'Nusa Tenggara Timur', 'Bali & Nusa Tenggara', 'Rumah Sakit Umum Tipe C', 85, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shmd', 'SHMD', 'Siloam Hospitals Medan Dhirga Surya', 'Medan', 'Sumatera Utara', 'Sumatera', 'Rumah Sakit Umum Tipe B', 180, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shpl', 'SHPL', 'Siloam Hospitals Palembang Sriwijaya', 'Palembang', 'Sumatera Selatan', 'Sumatera', 'Rumah Sakit Umum Tipe B', 175, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shbp', 'SHBP', 'Siloam Hospitals Balikpapan', 'Balikpapan', 'Kalimantan Timur', 'Kalimantan', 'Rumah Sakit Umum Tipe B', 165, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shbj', 'SHBJ', 'Siloam Hospitals Banjarmasin', 'Banjarmasin', 'Kalimantan Selatan', 'Kalimantan', 'Rumah Sakit Umum Tipe B', 130, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shmk', 'SHMK', 'Siloam Hospitals Makassar', 'Makassar', 'Sulawesi Selatan', 'Sulawesi', 'Rumah Sakit Umum Tipe B', 195, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shmn', 'SHMN', 'Siloam Hospitals Manado', 'Manado', 'Sulawesi Utara', 'Sulawesi', 'Rumah Sakit Umum Tipe B', 160, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shpd', 'SHPD', 'Siloam Hospitals Paal Dua Manado', 'Manado', 'Sulawesi Utara', 'Sulawesi', 'Rumah Sakit Umum Tipe C', 100, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shbt', 'SHBT', 'Siloam Hospitals Buton Baubau', 'Baubau', 'Sulawesi Tenggara', 'Sulawesi', 'Rumah Sakit Umum Tipe C', 90, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-sham', 'SHAM', 'Siloam Hospitals Ambon', 'Ambon', 'Maluku', 'Maluku & Papua', 'Rumah Sakit Umum Tipe C', 95, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('hosp-shcl', 'SHCL', 'Siloam Clinic & Dialysis Centers', 'Multi-Kota', 'DKI Jakarta', 'Jawa', 'Klinik Utama & Dialisis', 40, true, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenders (
  id, tender_number, title, description, submission_deadline, status, target_units, total_skus, created_at
) VALUES (
  'TDR-2026-Q4-01', 'SIL-TDR/MED-BMHP/2026/04', 'Tender Pengadaan Peralatan Medis & BMHP Siloam Hospitals Group 2026', 'Penyediaan peralatan kardiologi, dental, dialysis, ICU, laboratorium, dan BMHP untuk seluruh unit RS Siloam nasional.', '2026-10-31', 'open', ARRAY['Siloam Lippo Village', 'MRCCC Siloam Semanggi', 'Siloam Kebon Jeruk', 'All 41 Hospitals'], 6, '2026-09-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;
