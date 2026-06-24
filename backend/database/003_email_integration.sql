CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction varchar(20) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message_id text,
  mailbox varchar(120),
  sender text,
  recipients text[] NOT NULL DEFAULT '{}',
  cc text[] NOT NULL DEFAULT '{}',
  subject varchar(255) NOT NULL,
  text_body text,
  html_body text,
  attachment_metadata jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_module varchar(80),
  related_id uuid,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz,
  sent_at timestamptz,
  synced_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (direction, message_id)
);

CREATE INDEX IF NOT EXISTS idx_email_messages_direction_created ON email_messages(direction, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_related ON email_messages(related_module, related_id);
