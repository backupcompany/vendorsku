CREATE TABLE sessions (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('vendor', 'staff')),
  actor_id text NOT NULL,
  expires_at timestamptz NOT NULL
);

-- Accounts live here. The sign-in screen does not list them.
INSERT INTO vendors (
  id, erp_vendor_code, company_name, npwp, address, verified, status,
  is_existing_supplier, source, registration_date, category, notes,
  password_hash, password_created_at, pic, business_scope
) VALUES
(
  'vnd-001', 'VND-ERP-10023', 'PT Medika Farma Pratama', '01.234.567.8-012.000',
  'Kawasan Industri Pulogadung Blok B No. 12, Jakarta Timur',
  true, 'verified', true, 'erp_upload', '2025-03-10T09:00:00Z',
  'DIAGNOSTIC AND MEDICAL DEVICES',
  'Rekanan utama Siloam untuk BMHP & diagnostik terdaftar di SAP ERP.',
  '$2a$10$XqaJZe0I5za6HUg29LHBouOKee2OYF/VyR1Cx2qjSt0XEJxqU2dha',
  '2026-09-01T08:00:00Z',
  '{"name":"Hendra Gunawan (Direktur Penjualan)","email":"tender@medikafarma.co.id","phone":"+62 21 5567 8900"}',
  '{"level1":"DIAGNOSTIC AND MEDICAL DEVICES","level2List":["SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS","CARDIOLOGY & VASCULAR DEVICES","ICU & CRITICAL CARE SYSTEMS"]}'
),
(
  'vnd-002', 'VND-ERP-10045', 'PT Global Alkesindo Mandiri', '02.987.654.3-045.000',
  'Ruko Gading Boulevard Kav 7, Kelapa Gading, Jakarta Utara',
  true, 'verified', true, 'erp_upload', '2025-05-18T10:30:00Z',
  'DIAGNOSTIC AND MEDICAL DEVICES',
  'Distributor resmi alat bedah dan hospital furniture di SIM-RS.',
  '$2a$10$XqaJZe0I5za6HUg29LHBouOKee2OYF/VyR1Cx2qjSt0XEJxqU2dha',
  '2026-09-01T08:00:00Z',
  '{"name":"Siti Rahmawati (Head of Tender)","email":"sales@globalalkesindo.com","phone":"+62 21 8890 1234"}',
  '{"level1":"DIAGNOSTIC AND MEDICAL DEVICES","level2List":["SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS","SURGICAL","HOSPITAL FURNITURE & WARD EQUIPMENT"]}'
),
(
  'vnd-003', 'VND-ERP-10088', 'PT Anugrah Argon Medisindo', '03.456.789.0-078.000',
  'Titan Center Lt. 8, Bintaro Jaya Sektor 7, Tangerang Selatan',
  true, 'verified', true, 'erp_upload', '2025-08-22T14:15:00Z',
  'GENERAL SUPPLIES',
  'Rekanan konsumabel & linen rumah sakit nasional.',
  '$2a$10$XqaJZe0I5za6HUg29LHBouOKee2OYF/VyR1Cx2qjSt0XEJxqU2dha',
  '2026-09-01T08:00:00Z',
  '{"name":"Budi Santoso (Account Lead RS)","email":"hospital.team@argonmedis.com","phone":"+62 21 7765 4321"}',
  '{"level1":"GENERAL SUPPLIES","level2List":["CONSUMABLES & DISPOSABLES","LINEN & UNIFORM","CLEANING & SANITATION"]}'
),
(
  'vnd-new-001', NULL, 'PT Surya Medika Nusantara', '04.112.334.5-091.000',
  'Cyber 2 Tower Lt. 15, Jl. HR Rasuna Said Blok X-5, Jakarta Selatan',
  false, 'prospect', false, 'self_registered', '2026-09-18T11:20:00Z',
  'DIAGNOSTIC AND MEDICAL DEVICES',
  'Vendor baru mendaftar mandiri via Portal Rekanan Siloam.',
  '$2a$10$XqaJZe0I5za6HUg29LHBouOKee2OYF/VyR1Cx2qjSt0XEJxqU2dha',
  '2026-09-18T11:20:00Z',
  '{"name":"dr. Anton Wijaya (Business Development)","email":"tender@suryamedika.co.id","phone":"+62 21 8245 7712"}',
  '{"level1":"DIAGNOSTIC AND MEDICAL DEVICES","level2List":["SURGICAL & DIAGNOSTIC INTERVENTION SYSTEMS","ICU & CRITICAL CARE SYSTEMS"]}'
),
(
  'vnd-new-002', NULL, 'CV Bio Medika Utama', '05.667.889.0-604.000',
  'Kompleks Pergudangan Margomulyo Indah Blok H-9, Surabaya',
  false, 'identified', false, 'self_registered', '2026-09-25T15:40:00Z',
  'GENERAL SUPPLIES',
  'Calon vendor baru mengajukan suplai disinfektan dan sanitizer.',
  '$2a$10$XqaJZe0I5za6HUg29LHBouOKee2OYF/VyR1Cx2qjSt0XEJxqU2dha',
  '2026-09-25T15:40:00Z',
  '{"name":"Rina Kusuma (Manajer Operasional)","email":"info@biomedikautama.com","phone":"+62 31 5432 9988"}',
  '{"level1":"GENERAL SUPPLIES","level2List":["CLEANING & SANITATION","CONSUMABLES & DISPOSABLES"]}'
);

INSERT INTO admin_users (
  id, username, email, name, role, role_title, department, hospital_unit, password_hash
) VALUES
(
  'adm-001', 'admin', 'heldra.parningotan@siloamhospitals.com', 'dr. Hendra Parningotan',
  'super_admin', 'Head of Procurement & Medical Sourcing', 'Corporate Supply Chain Siloam',
  'Head Office Siloam Hospitals',
  '$2a$10$XxEkgliD/WTFfyyehRmEnes9YGp4r0mMHgB2RGissFffIb6FiXfvW'
),
(
  'adm-002', 'evaluator', 'evaluator@siloamhospitals.com', 'dr. Anita Wijaya, Sp.An',
  'evaluator', 'Clinical & Medical Equipment Specialist', 'Clinical Governance & Medical Committee',
  'MRCCC Siloam Semanggi Jakarta',
  '$2a$10$g8IS5tupnN9jWVZJLopm4Ox.tlSv5s6wfVSWIYZ0TzsN4efLAgF0u'
),
(
  'adm-003', 'procurement', 'procurement@siloamhospitals.com', 'Rian Suryadi, S.Farm',
  'procurement_officer', 'Procurement Sourcing Specialist', 'Medical Device & Consumable Buyer',
  'Siloam Hospitals Lippo Village',
  '$2a$10$cghsBgMJDl0NTTV1q8JcHO/lF07a.radU3b2zzCiG7qH1C/lEtbk6'
),
(
  'adm-004', 'auditor', 'auditor@siloamhospitals.com', 'Maya Kartika, SE, Ak',
  'auditor', 'Internal Audit & Compliance Lead', 'Corporate Internal Audit',
  'Head Office Siloam Hospitals',
  '$2a$10$dTDtTfw/JyoYBf37jDCLCOof79nT39OWZjHcwnIUlJOZaWUt2qR0K'
);
