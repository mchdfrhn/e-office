-- Seed letter requests, incoming letters, outgoing letters, dispositions
-- 1. Letter Requests
INSERT INTO letter_requests (request_number, request_date, letter_type_id, subject, destination, body, applicant_id, status, submitted_at, approved_at, completed_at)
SELECT 
  'AJ-2026-0007', '2026-05-01', lt.id, 'Pendampingan audit internal', 'Unit Internal', 'Detail permohonan audit...', u.id, 'menunggu_approval', now(), NULL, NULL
FROM users u, letter_types lt
WHERE u.username = 'user' AND lt.name = 'Surat Tugas'
ON CONFLICT (request_number) DO NOTHING;

INSERT INTO letter_requests (request_number, request_date, letter_type_id, subject, destination, body, applicant_id, status, submitted_at, approved_at, completed_at)
SELECT 
  'AJ-2026-0006', '2026-05-02', lt.id, 'Keterangan aktif pegawai', 'Kepegawaian', 'Detail keterangan...', u.id, 'diproses_operator', now(), NULL, NULL
FROM users u, letter_types lt
WHERE u.username = 'user' AND lt.name = 'Surat Keterangan'
ON CONFLICT (request_number) DO NOTHING;

INSERT INTO letter_requests (request_number, request_date, letter_type_id, subject, destination, body, applicant_id, status, submitted_at, approved_at, completed_at)
SELECT 
  'AJ-2026-0005', '2026-05-03', lt.id, 'Undangan rapat koordinasi', 'Mitra Kerja', 'Detail undangan...', u.id, 'disetujui', now(), now(), now()
FROM users u, letter_types lt
WHERE u.username = 'user' AND lt.name = 'Surat Undangan'
ON CONFLICT (request_number) DO NOTHING;

-- 2. Incoming Letters
INSERT INTO incoming_letters (agenda_number, letter_number, letter_date, received_date, sender, subject, letter_type_id, letter_nature_id, status, registered_by, completed_at)
SELECT 
  'AG-2026-041', 'SM/109/V/2026', '2026-05-01', '2026-05-02', 'Dinas Kominfo', 'Permintaan data layanan', lt.id, ln.id, 'diteruskan', u.id, NULL
FROM users u, letter_types lt, letter_natures ln
WHERE u.username = 'operator' AND lt.name = 'Surat Permohonan' AND ln.code = 'biasa'
ON CONFLICT (agenda_number) DO NOTHING;

INSERT INTO incoming_letters (agenda_number, letter_number, letter_date, received_date, sender, subject, letter_type_id, letter_nature_id, status, registered_by, completed_at)
SELECT 
  'AG-2026-040', 'SM/108/V/2026', '2026-05-01', '2026-05-02', 'Bappeda', 'Koordinasi program', lt.id, ln.id, 'diregistrasi', u.id, NULL
FROM users u, letter_types lt, letter_natures ln
WHERE u.username = 'operator' AND lt.name = 'Surat Tugas' AND ln.code = 'penting'
ON CONFLICT (agenda_number) DO NOTHING;

INSERT INTO incoming_letters (agenda_number, letter_number, letter_date, received_date, sender, subject, letter_type_id, letter_nature_id, status, registered_by, completed_at)
SELECT 
  'AG-2026-039', 'SM/107/V/2026', '2026-05-01', '2026-05-02', 'Inspektorat', 'Jadwal audit', lt.id, ln.id, 'didisposisikan', u.id, NULL
FROM users u, letter_types lt, letter_natures ln
WHERE u.username = 'operator' AND lt.name = 'Surat Permohonan' AND ln.code = 'segera'
ON CONFLICT (agenda_number) DO NOTHING;

INSERT INTO incoming_letters (agenda_number, letter_number, letter_date, received_date, sender, subject, letter_type_id, letter_nature_id, status, registered_by, completed_at)
SELECT 
  'AG-2026-038', 'SM/103/V/2026', '2026-05-01', '2026-05-02', 'Sekretariat Negara', 'Undangan Rapat', lt.id, ln.id, 'selesai', u.id, now()
FROM users u, letter_types lt, letter_natures ln
WHERE u.username = 'operator' AND lt.name = 'Surat Undangan' AND ln.code = 'biasa'
ON CONFLICT (agenda_number) DO NOTHING;

-- 3. Outgoing Letters
INSERT INTO outgoing_letters (letter_number, letter_date, letter_type_id, destination, subject, status, created_by, approved_at, sent_at)
SELECT 
  'SK-2026-018', '2026-05-01', lt.id, 'Unit Internal', 'Pembaruan SOP arsip', 'menunggu_approval', u.id, NULL, NULL
FROM users u, letter_types lt
WHERE u.username = 'operator' AND lt.name = 'Surat Edaran'
ON CONFLICT (letter_number) DO NOTHING;

INSERT INTO outgoing_letters (letter_number, letter_date, letter_type_id, destination, subject, status, created_by, approved_at, sent_at)
SELECT 
  'SK-2026-017', '2026-05-02', lt.id, 'Mitra Kerja', 'Rapat evaluasi triwulan', 'disetujui', u.id, now(), NULL
FROM users u, letter_types lt
WHERE u.username = 'operator' AND lt.name = 'Surat Undangan'
ON CONFLICT (letter_number) DO NOTHING;

INSERT INTO outgoing_letters (letter_number, letter_date, letter_type_id, destination, subject, status, created_by, approved_at, sent_at)
SELECT 
  'SK-2026-016', '2026-05-03', lt.id, 'Pegawai', 'Kegiatan lapangan', 'dikirim', u.id, now(), now()
FROM users u, letter_types lt
WHERE u.username = 'operator' AND lt.name = 'Surat Tugas'
ON CONFLICT (letter_number) DO NOTHING;

-- 4. Dispositions
INSERT INTO dispositions (disposition_number, incoming_letter_id, giver_id, target_user_id, instruction, due_date, priority, status, sent_at)
SELECT 
  'DSP-2026-021', il.id, u_giver.id, u_target.id, 'Segera tindak lanjuti', '2026-05-10', 'segera'::priority_level, 'dikirim', now()
FROM incoming_letters il, users u_giver, users u_target
WHERE il.letter_number = 'SM/109/V/2026' AND u_giver.username = 'pimpinan' AND u_target.username = 'user'
ON CONFLICT (disposition_number) DO NOTHING;

INSERT INTO dispositions (disposition_number, incoming_letter_id, giver_id, target_user_id, instruction, due_date, priority, status, sent_at)
SELECT 
  'DSP-2026-020', il.id, u_giver.id, u_target.id, 'Telaah dan laporkan', '2026-05-11', 'biasa'::priority_level, 'ditindaklanjuti', now()
FROM incoming_letters il, users u_giver, users u_target
WHERE il.letter_number = 'SM/107/V/2026' AND u_giver.username = 'pimpinan' AND u_target.username = 'user'
ON CONFLICT (disposition_number) DO NOTHING;

INSERT INTO dispositions (disposition_number, incoming_letter_id, giver_id, target_user_id, instruction, due_date, priority, status, sent_at, completed_at)
SELECT 
  'DSP-2026-019', il.id, u_giver.id, u_target.id, 'Arsipkan setelah selesai', '2026-05-12', 'biasa'::priority_level, 'selesai', now(), now()
FROM incoming_letters il, users u_giver, users u_target
WHERE il.letter_number = 'SM/103/V/2026' AND u_giver.username = 'pimpinan' AND u_target.username = 'user'
ON CONFLICT (disposition_number) DO NOTHING;
