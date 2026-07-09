-- Ubah constraint UNIQUE menjadi Partial Unique Index
-- Ini memungkinkan akun yang sudah dihapus (soft delete) untuk didaftarkan kembali

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

DROP INDEX IF EXISTS users_username_key;
DROP INDEX IF EXISTS users_email_key;

CREATE UNIQUE INDEX users_username_key ON users (username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_email_key ON users (email) WHERE deleted_at IS NULL;
