-- Tambah kolom pemeriksaan log audit oleh administrator
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS review_status varchar(40) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS review_notes text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz DEFAULT NULL;

-- Index baru untuk pencarian log berdasarkan status review
CREATE INDEX IF NOT EXISTS idx_audit_logs_review_status ON audit_logs(review_status) WHERE review_status IS NOT NULL;
