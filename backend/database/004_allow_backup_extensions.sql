-- Drop old check constraints
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_allowed_extension;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_allowed_mime;

-- Add updated check constraints to support backups (.dump and .sql)
ALTER TABLE documents ADD CONSTRAINT documents_allowed_extension CHECK (
  lower(file_extension) IN ('pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'dump', 'sql')
);

ALTER TABLE documents ADD CONSTRAINT documents_allowed_mime CHECK (
  mime_type IN (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'application/octet-stream'
  )
);
