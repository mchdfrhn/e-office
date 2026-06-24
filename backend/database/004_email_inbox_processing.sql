ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS process_status varchar(30) NOT NULL DEFAULT 'belum_diproses',
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processing_error text;

ALTER TABLE email_messages
  DROP CONSTRAINT IF EXISTS email_messages_process_status_check;

ALTER TABLE email_messages
  ADD CONSTRAINT email_messages_process_status_check
  CHECK (process_status IN ('belum_diproses', 'sudah_diproses'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_messages_incoming_related_once
  ON email_messages(related_id)
  WHERE direction = 'incoming' AND related_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_messages_incoming_process
  ON email_messages(direction, process_status, received_at DESC);
