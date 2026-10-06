CREATE TABLE ref_options (
  list text NOT NULL,
  value text NOT NULL,
  label text NOT NULL,
  sort int NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (list, value)
);

INSERT INTO ref_options (list, value, label, sort, meta) VALUES
  ('island', 'Jawa', 'Jawa', 1, '{}'),
  ('island', 'Sumatera', 'Sumatera', 2, '{}'),
  ('island', 'Bali & Nusa Tenggara', 'Bali & Nusa Tenggara', 3, '{}'),
  ('island', 'Kalimantan', 'Kalimantan', 4, '{}'),
  ('island', 'Sulawesi', 'Sulawesi', 5, '{}'),
  ('island', 'Maluku & Papua', 'Maluku & Papua', 6, '{}'),

  ('country_of_origin', 'Indonesia', 'Indonesia (Produk Domestik / TKDN)', 1, '{}'),
  ('country_of_origin', 'Jepang', 'Jepang', 2, '{}'),
  ('country_of_origin', 'Jerman', 'Jerman', 3, '{}'),
  ('country_of_origin', 'USA', 'Amerika Serikat (USA)', 4, '{}'),
  ('country_of_origin', 'Malaysia', 'Malaysia', 5, '{}'),
  ('country_of_origin', 'Korea Selatan', 'Korea Selatan', 6, '{}'),
  ('country_of_origin', 'Lainnya', 'Negara Lainnya', 7, '{}'),

  ('tax_condition', 'exclude_vat_11', 'Harga Tayang Belum Termasuk PPN (Exclude PPN 11%) - Standar Siloam', 1, '{}'),
  ('tax_condition', 'include_vat_11', 'Harga Tayang Sudah Termasuk PPN (Include PPN 11%)', 2, '{}'),

  ('product_category', 'cat-med-devices', 'Alat Medis & Bedah / Diagnostik', 1, '{
    "subtitle": "Surgical instruments, ICU, monitor tanda vital, cardiology & alkes spesialis",
    "badge": "Alkes & Diagnostik",
    "level1": "DIAGNOSTIC AND MEDICAL DEVICES",
    "level2List": ["SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS", "CARDIOLOGY & VASCULAR DEVICES", "ICU & CRITICAL CARE SYSTEMS", "SURGICAL"],
    "examples": ["Instrumen TUR", "Stetoskop", "Defibrillator", "Monitor Bedside", "Surgical Forceps"],
    "keywords": []
  }'),
  ('product_category', 'cat-bmhp-consumables', 'BMHP & Bahan Medis Habis Pakai', 2, '{
    "subtitle": "Jarum suntik, kassa steril, selang infus, sarung tangan, kateter, disposables",
    "badge": "Habis Pakai (BMHP)",
    "level1": "GENERAL SUPPLIES",
    "level2List": ["CONSUMABLES & DISPOSABLES", "SURGICAL"],
    "examples": ["Jarum Suntik", "Kassa Steril", "Infus Set", "Handscoon Latex", "Urine Bag"],
    "keywords": ["suntik", "kassa", "infus", "sarung"]
  }'),
  ('product_category', 'cat-lab-reagents', 'Laboratorium & Reagen Darah', 3, '{
    "subtitle": "Tabung darah vacutainer, reagen biokimia darah, rapid test kit, mikroskop",
    "badge": "Lab & Reagen",
    "level1": "DIAGNOSTIC AND MEDICAL DEVICES",
    "level2List": ["SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS"],
    "examples": ["Tabung EDTA", "Rapid Test", "Reagen Kimia Darah", "Pipet Mikro"],
    "keywords": ["lab", "reagen", "darah", "tabung"]
  }'),
  ('product_category', 'cat-hospital-furniture', 'Fasilitas & Kamar Perawatan Pasien', 4, '{
    "subtitle": "Bed pasien elektrik/manual, kasur anti dekubitus, kursi roda, tiang infus",
    "badge": "Furnitur RS",
    "level1": "DIAGNOSTIC AND MEDICAL DEVICES",
    "level2List": ["HOSPITAL FURNITURE & WARD EQUIPMENT", "SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS"],
    "examples": ["Bed Pasien 3 Crank", "Kursi Roda Standar", "Tiang Infus Stainless", "Meja Mayo"],
    "keywords": ["bed", "kursi", "kasur", "meja"]
  }'),
  ('product_category', 'cat-general-it', 'Umum, IT, Linen & Kebutuhan Kantor', 5, '{
    "subtitle": "Linen rumah sakit, seragam perawat, hardware IT, ATK & sanitasi rumah sakit",
    "badge": "Operasional & IT",
    "level1": "GENERAL SUPPLIES",
    "level2List": ["LINEN & UNIFORM", "CLEANING & SANITATION", "CONSUMABLES & DISPOSABLES"],
    "examples": ["Sprei Linen Rumah Sakit", "Kertas Resep", "Printer Label Barcode", "Cairan Desinfektan"],
    "keywords": ["linen", "kertas", "it", "sapu"]
  }'),

  ('hospital_region', 'jabodetabek-banten', 'Jabodetabek & Banten', 1, '{"units": [
    "Siloam Hospitals Lippo Village", "MRCCC Siloam Semanggi Jakarta", "Siloam Hospitals Kebon Jeruk",
    "Siloam Hospitals TB Simatupang", "Siloam Hospitals Asri Mampang", "Siloam Hospitals Agora Cempaka Putih",
    "RS Jantung Diagram Siloam Cinere", "Siloam Hospitals Sentosa Bekasi", "RS Umum Siloam Kelapa Dua",
    "Siloam Hospitals Bogor"]}'),
  ('hospital_region', 'jabar-jateng', 'Jawa Barat & Jawa Tengah', 2, '{"units": [
    "Siloam Hospitals Purwakarta", "Siloam Hospitals Cirebon Putera Bahagia", "Siloam Hospitals Semarang",
    "Siloam Hospitals Yogyakarta"]}'),
  ('hospital_region', 'jatim-bali', 'Jawa Timur & Bali', 3, '{"units": [
    "Siloam Hospitals Surabaya", "Siloam Hospitals Jember", "Siloam Hospitals Denpasar Bali",
    "Siloam Hospitals Mataram Lombok"]}'),
  ('hospital_region', 'sumatera', 'Sumatera', 4, '{"units": [
    "Siloam Hospitals Medan Dhirga Surya", "Siloam Hospitals Palembang Sriwijaya"]}'),
  ('hospital_region', 'kalimantan-sulawesi', 'Kalimantan & Sulawesi', 5, '{"units": [
    "Siloam Hospitals Balikpapan", "Siloam Hospitals Banjarmasin", "Siloam Hospitals Makassar",
    "Siloam Hospitals Manado", "Siloam Hospitals Paal Dua Manado", "Siloam Hospitals Buton Baubau"]}'),
  ('hospital_region', 'nusa-tenggara-maluku', 'Nusa Tenggara & Maluku', 6, '{"units": [
    "Siloam Hospitals Kupang", "Siloam Hospitals Labuan Bajo", "Siloam Hospitals Ambon",
    "Siloam Clinic & Dialysis Centers"]}');
