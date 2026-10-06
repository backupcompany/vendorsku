-- Seed hashes from 003_sessions.sql (vendor123 / admin123 / other demo staff) must never work.
-- Match by exact bcrypt string so real rotated passwords (e.g. SiloamTim1) stay untouched.
-- NULL = account cannot sign in until a staff sets a new password.
UPDATE vendors
SET password_hash = NULL, password_created_at = NULL
WHERE password_hash = '$2a$10$XqaJZe0I5za6HUg29LHBouOKee2OYF/VyR1Cx2qjSt0XEJxqU2dha';

UPDATE admin_users
SET password_hash = NULL
WHERE password_hash IN (
  '$2a$10$XxEkgliD/WTFfyyehRmEnes9YGp4r0mMHgB2RGissFffIb6FiXfvW',
  '$2a$10$g8IS5tupnN9jWVZJLopm4Ox.tlSv5s6wfVSWIYZ0TzsN4efLAgF0u',
  '$2a$10$cghsBgMJDl0NTTV1q8JcHO/lF07a.radU3b2zzCiG7qH1C/lEtbk6',
  '$2a$10$dTDtTfw/JyoYBf37jDCLCOof79nT39OWZjHcwnIUlJOZaWUt2qR0K'
);
