# PRD.md — Product Requirements Document

## 1. Informasi Produk

**Nama Produk:** Aplikasi E-Office Berbasis Website untuk Pengelolaan Surat Masuk dan Surat Keluar  
**Metode Pengembangan:** Rapid Application Development (RAD)  
**Target Pengguna:** PT X / Instansi / Organisasi  
**Platform:** Web Application  
**Jenis Sistem:** Sistem Informasi Administrasi Persuratan dan Disposisi Digital  
**Versi Dokumen:** 1.0  

---

## 2. Ringkasan Produk

Aplikasi E-Office adalah sistem berbasis website yang digunakan untuk mengelola proses administrasi surat masuk, surat keluar, pengajuan surat, disposisi, tindak lanjut disposisi, arsip digital, notifikasi, laporan, dashboard, serta manajemen pengguna.

Sistem ini dirancang untuk menggantikan proses pengelolaan surat secara manual agar menjadi lebih cepat, terdokumentasi, mudah dilacak, aman, dan terintegrasi antar pengguna sesuai role masing-masing.

Aplikasi harus mendukung beberapa aktor utama, yaitu:

1. User
2. Operator
3. Pimpinan
4. Administrator
5. Pegawai

---

## 3. Tujuan Produk

Tujuan utama pengembangan aplikasi ini adalah:

1. Mempermudah proses pencatatan surat masuk dan surat keluar.
2. Mempermudah user dalam mengajukan surat secara digital.
3. Mempercepat proses disposisi surat dari pimpinan kepada user/staf/bawahan.
4. Mempermudah monitoring status pengajuan surat.
5. Menyediakan arsip digital surat yang mudah dicari dan diunduh.
6. Menyediakan laporan surat masuk, surat keluar, pengajuan surat, dan disposisi.
7. Menyediakan dashboard ringkasan aktivitas persuratan berdasarkan role pengguna.
8. Meningkatkan keamanan data melalui autentikasi, otorisasi, dan audit trail.

---

## 4. Ruang Lingkup Produk

### 4.1 Termasuk dalam Ruang Lingkup

Sistem mencakup fitur berikut:

1. Login dan logout pengguna.
2. Manajemen role dan hak akses.
3. Pengajuan surat oleh user.
4. Upload dokumen surat.
5. Preview konsep naskah.
6. Pengiriman konsep surat.
7. Registrasi surat masuk eksternal oleh operator.
8. Input surat masuk dan surat keluar.
9. Penerusan surat ke pimpinan.
10. Penerimaan dan pembacaan surat oleh pimpinan.
11. Disposisi surat oleh pimpinan.
12. Penentuan tujuan disposisi.
13. Penerimaan disposisi oleh user/staf.
14. Tindak lanjut disposisi.
15. Pemeriksaan naskah oleh operator.
16. Pengiriman naskah oleh operator.
17. Approval atau penolakan surat.
18. Catatan alasan penolakan.
19. Arsip digital.
20. Pencarian dan download dokumen.
21. Notifikasi sistem.
22. Dashboard sesuai role.
23. Laporan surat masuk, surat keluar, ajuan, dan disposisi.
24. Audit trail aktivitas pengguna.
25. Backup data oleh administrator.

### 4.2 Tidak Termasuk dalam Ruang Lingkup Versi Awal

Fitur berikut tidak wajib pada versi awal, kecuali diminta kemudian:

1. Tanda tangan digital tersertifikasi Kominfo/BSrE.
2. Integrasi WhatsApp gateway.
3. Integrasi email SMTP otomatis.
4. Mobile app Android/iOS native.
5. OCR otomatis untuk membaca isi surat hasil scan.
6. Multi-instansi atau multi-tenant kompleks.
7. Sistem kepegawaian lengkap.

---

## 5. Aktor dan Hak Akses

### 5.1 User

User memiliki akses untuk:

1. Login ke sistem.
2. Mengajukan surat.
3. Mengisi form ajuan surat.
4. Upload dokumen surat.
5. Mengirim konsep surat.
6. Preview konsep naskah.
7. Melihat status pengajuan surat.
8. Melihat riwayat pengajuan surat.
9. Menerima disposisi.
10. Menindaklanjuti disposisi.
11. Mengirim hasil tindak lanjut.
12. Melihat notifikasi terkait ajuan dan disposisi.

### 5.2 Operator

Operator memiliki akses untuk:

1. Login ke sistem.
2. Registrasi surat masuk eksternal.
3. Input surat masuk.
4. Input surat keluar.
5. Meneruskan surat ke pimpinan.
6. Menerima dan meneruskan disposisi.
7. Memeriksa naskah.
8. Mengirim naskah yang sudah diproses atau ditandatangani.
9. Melihat daftar surat masuk dan surat keluar.
10. Melihat laporan operasional surat.

### 5.3 Pimpinan

Pimpinan memiliki akses untuk:

1. Login ke sistem.
2. Menerima surat dari operator.
3. Membaca isi surat.
4. Memberikan disposisi surat.
5. Menentukan tujuan disposisi.
6. Menyetujui atau menolak pengajuan surat.
7. Memberikan catatan alasan penolakan.
8. Memantau tindak lanjut disposisi.
9. Melihat dashboard dan laporan disposisi.

### 5.4 Administrator

Administrator memiliki akses untuk:

1. Login ke sistem.
2. Mengelola data pengguna.
3. Menambah, mengubah, dan menghapus pengguna.
4. Mengatur role dan hak akses.
5. Melakukan konfigurasi sistem.
6. Melihat audit trail.
7. Melakukan backup data.
8. Mengelola data master sistem.

### 5.5 Pegawai

Pegawai memiliki akses untuk:

1. Login ke sistem jika diberikan akun.
2. Menerima jenis surat tertentu seperti undangan dan pengumuman.
3. Melihat detail surat yang diterima.
4. Mengunduh dokumen surat jika diizinkan.

---

## 6. Modul dan Fitur Utama

## 6.1 Modul Autentikasi

### Deskripsi

Modul ini digunakan untuk proses login, logout, validasi akun, serta pembatasan akses berdasarkan role pengguna.

### Fitur

1. Login menggunakan username/email dan password.
2. Logout sistem.
3. Password terenkripsi.
4. Role-based access control.
5. Validasi akun aktif atau nonaktif.
6. Redirect dashboard sesuai role.

### Acceptance Criteria

1. Pengguna dengan kredensial benar dapat login.
2. Pengguna dengan kredensial salah tidak dapat login.
3. Pengguna diarahkan ke dashboard sesuai role.
4. Pengguna tidak dapat mengakses halaman di luar hak aksesnya.
5. Password tidak disimpan dalam bentuk plain text.

---

## 6.2 Modul Dashboard

### Deskripsi

Dashboard menampilkan ringkasan informasi sesuai role pengguna.

### Fitur

1. Ringkasan jumlah surat masuk.
2. Ringkasan jumlah surat keluar.
3. Ringkasan jumlah ajuan surat.
4. Ringkasan jumlah disposisi.
5. Statistik status surat: diproses, disetujui, ditolak, selesai.
6. Informasi notifikasi terbaru.
7. Shortcut ke fitur utama.

### Dashboard Berdasarkan Role

#### User

1. Total ajuan surat.
2. Ajuan diproses.
3. Ajuan disetujui.
4. Ajuan ditolak.
5. Disposisi masuk.
6. Tindak lanjut pending.

#### Operator

1. Total surat masuk.
2. Total surat keluar.
3. Surat belum diteruskan.
4. Naskah perlu diperiksa.
5. Naskah siap dikirim.

#### Pimpinan

1. Surat masuk dari operator.
2. Surat belum dibaca.
3. Disposisi yang telah dibuat.
4. Tindak lanjut disposisi.
5. Ajuan menunggu persetujuan.

#### Administrator

1. Total pengguna.
2. Total role.
3. Aktivitas terbaru.
4. Status backup.
5. Statistik sistem.

### Acceptance Criteria

1. Dashboard menampilkan data sesuai role pengguna.
2. Data dashboard ter-update berdasarkan aktivitas terbaru.
3. Pengguna hanya melihat informasi yang sesuai dengan hak aksesnya.

---

## 6.3 Modul Ajuan Surat

### Deskripsi

Modul ini digunakan oleh user untuk mengajukan surat secara digital.

### Fitur

1. Form tambah ajuan surat.
2. Input nomor ajuan otomatis atau manual sesuai konfigurasi.
3. Input jenis surat.
4. Input perihal surat.
5. Input tujuan surat.
6. Input isi/keterangan ajuan.
7. Upload dokumen pendukung.
8. Preview konsep naskah.
9. Kirim konsep surat.
10. Lihat status ajuan.
11. Riwayat pengajuan.

### Field Form Ajuan Surat

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| nomor_ajuan | string | Ya | Nomor otomatis/manual |
| tanggal_ajuan | date | Ya | Tanggal dibuat |
| jenis_surat | select | Ya | Jenis surat |
| perihal | string | Ya | Perihal surat |
| tujuan_surat | string | Ya | Tujuan surat |
| isi_ajuan | text | Ya | Keterangan/isi ajuan |
| file_dokumen | file | Opsional | PDF/DOC/DOCX/JPG/PNG |
| status | enum | Ya | draft/diproses/disetujui/ditolak/selesai |

### Status Ajuan Surat

1. Draft
2. Dikirim
3. Diproses Operator
4. Menunggu Persetujuan Pimpinan
5. Disetujui
6. Ditolak
7. Selesai

### Acceptance Criteria

1. User dapat membuat ajuan surat.
2. User dapat mengupload dokumen pendukung.
3. User dapat melakukan preview konsep naskah.
4. User dapat mengirim konsep surat.
5. Sistem mengubah status ajuan setelah dikirim.
6. User dapat melihat status dan riwayat ajuan.
7. User tidak dapat mengubah ajuan yang sudah diproses kecuali dikembalikan.

---

## 6.4 Modul Pengelolaan Surat Masuk

### Deskripsi

Modul ini digunakan operator untuk mencatat dan meregistrasi surat masuk, khususnya surat eksternal dari luar instansi.

### Fitur

1. Tambah surat masuk eksternal.
2. Input data surat masuk.
3. Upload file surat masuk.
4. Nomor agenda otomatis.
5. Klasifikasi jenis surat.
6. Penerusan surat ke pimpinan.
7. Status proses surat masuk.
8. Pencarian surat masuk.
9. Detail surat masuk.

### Field Surat Masuk

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| nomor_agenda | string | Ya | Nomor agenda sistem |
| nomor_surat | string | Ya | Nomor surat dari pengirim |
| tanggal_surat | date | Ya | Tanggal pada surat |
| tanggal_terima | date | Ya | Tanggal diterima |
| pengirim | string | Ya | Asal/pengirim surat |
| perihal | string | Ya | Perihal surat |
| jenis_surat | select | Ya | Jenis/kategori surat |
| sifat_surat | select | Ya | Biasa/penting/segera/rahasia |
| file_surat | file | Ya | Dokumen surat |
| status | enum | Ya | Diregistrasi/diteruskan/didisposisi/selesai |

### Acceptance Criteria

1. Operator dapat meregistrasi surat masuk eksternal.
2. Sistem membuat nomor agenda otomatis.
3. Operator dapat mengupload file surat.
4. Operator dapat meneruskan surat ke pimpinan.
5. Status surat berubah setelah diteruskan.
6. Surat masuk tersimpan dalam arsip digital.

---

## 6.5 Modul Pengelolaan Surat Keluar

### Deskripsi

Modul ini digunakan untuk mencatat, memproses, dan mengirim surat keluar.

### Fitur

1. Tambah surat keluar.
2. Input data surat keluar.
3. Upload atau generate dokumen surat.
4. Pemeriksaan naskah oleh operator.
5. Approval pimpinan.
6. Pengiriman naskah final.
7. Arsip surat keluar.
8. Status surat keluar.

### Field Surat Keluar

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| nomor_surat | string | Ya | Nomor surat keluar |
| tanggal_surat | date | Ya | Tanggal surat |
| tujuan_surat | string | Ya | Tujuan penerima |
| perihal | string | Ya | Perihal surat |
| isi_ringkas | text | Opsional | Ringkasan isi |
| file_naskah | file | Ya | Naskah surat |
| status | enum | Ya | draft/diperiksa/disetujui/ditolak/dikirim |

### Acceptance Criteria

1. Operator dapat mencatat surat keluar.
2. Operator dapat memeriksa naskah.
3. Pimpinan dapat menyetujui atau menolak surat keluar.
4. Operator dapat mengirim naskah yang telah disetujui.
5. Surat keluar tersimpan di arsip digital.

---

## 6.6 Modul Disposisi Surat

### Deskripsi

Modul ini digunakan pimpinan untuk memberikan instruksi atau arahan terhadap surat yang diterima.

### Fitur

1. Daftar surat masuk yang diterima pimpinan.
2. Baca detail surat.
3. Buat disposisi.
4. Tentukan tujuan disposisi.
5. Tambahkan instruksi disposisi.
6. Tentukan batas waktu tindak lanjut.
7. Kirim disposisi kepada user/staf/bawahan.
8. Monitoring tindak lanjut disposisi.

### Field Disposisi

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| id_surat | relation | Ya | Surat yang didisposisikan |
| pemberi_disposisi | relation | Ya | Pimpinan |
| tujuan_disposisi | relation | Ya | User/staf/bawahan |
| instruksi | text | Ya | Isi instruksi |
| batas_waktu | date | Opsional | Deadline tindak lanjut |
| prioritas | enum | Ya | biasa/penting/segera |
| status | enum | Ya | dikirim/diterima/ditindaklanjuti/selesai |

### Acceptance Criteria

1. Pimpinan dapat membaca surat sebelum membuat disposisi.
2. Pimpinan dapat menentukan tujuan disposisi.
3. Pimpinan dapat menambahkan instruksi disposisi.
4. User/staf tujuan menerima notifikasi disposisi.
5. Status disposisi berubah sesuai proses tindak lanjut.
6. Pimpinan dapat melihat tindak lanjut disposisi.

---

## 6.7 Modul Tindak Lanjut Disposisi

### Deskripsi

Modul ini digunakan user/staf untuk menerima dan menindaklanjuti instruksi dari pimpinan.

### Fitur

1. Daftar disposisi masuk.
2. Detail disposisi.
3. Tandai disposisi diterima.
4. Isi tindak lanjut.
5. Upload dokumen hasil tindak lanjut.
6. Kirim hasil tindak lanjut.
7. Status tindak lanjut.

### Field Tindak Lanjut

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| id_disposisi | relation | Ya | Disposisi terkait |
| catatan_tindak_lanjut | text | Ya | Hasil/respon tindak lanjut |
| file_lampiran | file | Opsional | Bukti/hasil tindak lanjut |
| tanggal_tindak_lanjut | datetime | Ya | Waktu tindak lanjut |
| status | enum | Ya | proses/selesai |

### Acceptance Criteria

1. User/staf dapat menerima disposisi.
2. User/staf dapat mengisi tindak lanjut.
3. User/staf dapat mengupload hasil tindak lanjut.
4. Pimpinan dapat melihat hasil tindak lanjut.
5. Status disposisi berubah menjadi selesai setelah tindak lanjut selesai.

---

## 6.8 Modul Approval

### Deskripsi

Modul ini digunakan untuk proses persetujuan atau penolakan surat.

### Fitur

1. Daftar surat menunggu approval.
2. Detail surat.
3. Approve surat.
4. Reject surat.
5. Catatan alasan penolakan.
6. Update status otomatis.
7. Notifikasi ke pengaju/operator.

### Acceptance Criteria

1. Pimpinan dapat menyetujui surat.
2. Pimpinan dapat menolak surat dengan catatan alasan.
3. Sistem memperbarui status secara otomatis.
4. User/operator menerima notifikasi approval/reject.
5. Riwayat approval tersimpan di audit trail.

---

## 6.9 Modul Arsip Digital

### Deskripsi

Modul ini menyimpan seluruh surat dan dokumen secara digital.

### Fitur

1. Arsip surat masuk.
2. Arsip surat keluar.
3. Arsip ajuan surat.
4. Arsip disposisi.
5. Pencarian berdasarkan kata kunci.
6. Filter berdasarkan tanggal.
7. Filter berdasarkan jenis surat.
8. Filter berdasarkan status.
9. Download dokumen.
10. Preview dokumen.

### Acceptance Criteria

1. Semua surat yang diproses tersimpan otomatis di arsip.
2. Pengguna dapat mencari arsip berdasarkan hak akses.
3. Pengguna dapat mengunduh dokumen jika memiliki izin.
4. Arsip tidak dapat dihapus sembarang pengguna.

---

## 6.10 Modul Notifikasi

### Deskripsi

Modul ini memberikan pemberitahuan kepada pengguna terkait aktivitas penting dalam sistem.

### Jenis Notifikasi

1. Notifikasi ajuan surat baru.
2. Notifikasi surat diteruskan ke pimpinan.
3. Notifikasi disposisi baru.
4. Notifikasi tindak lanjut disposisi.
5. Notifikasi approval surat.
6. Notifikasi surat ditolak.
7. Notifikasi status ajuan berubah.

### Acceptance Criteria

1. Notifikasi muncul pada dashboard pengguna.
2. Notifikasi hanya diterima oleh pengguna terkait.
3. Pengguna dapat menandai notifikasi sebagai dibaca.
4. Jumlah notifikasi belum dibaca ditampilkan di header/dashboard.

---

## 6.11 Modul Laporan

### Deskripsi

Modul ini digunakan untuk menghasilkan laporan administrasi persuratan.

### Jenis Laporan

1. Laporan surat masuk.
2. Laporan surat keluar.
3. Laporan ajuan surat.
4. Laporan disposisi.
5. Laporan tindak lanjut disposisi.
6. Laporan berdasarkan periode tanggal.
7. Laporan berdasarkan jenis surat.
8. Laporan berdasarkan status.

### Fitur

1. Filter periode tanggal.
2. Filter jenis surat.
3. Filter status.
4. Export PDF.
5. Export Excel.
6. Print laporan.

### Acceptance Criteria

1. Pengguna berwenang dapat melihat laporan.
2. Laporan dapat difilter berdasarkan periode.
3. Laporan dapat diekspor ke PDF dan Excel.
4. Data laporan sesuai dengan data pada sistem.

---

## 6.12 Modul Manajemen Pengguna

### Deskripsi

Modul ini digunakan administrator untuk mengelola akun pengguna dan hak akses.

### Fitur

1. Tambah pengguna.
2. Ubah data pengguna.
3. Hapus/nonaktifkan pengguna.
4. Reset password.
5. Atur role pengguna.
6. Atur status aktif/nonaktif.
7. Kelola data jabatan/unit kerja.

### Field Pengguna

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| nama | string | Ya | Nama lengkap |
| username | string | Ya | Username unik |
| email | email | Opsional | Email pengguna |
| password | password | Ya | Password terenkripsi |
| role | enum | Ya | user/operator/pimpinan/admin/pegawai |
| jabatan | string | Opsional | Jabatan pengguna |
| unit_kerja | string | Opsional | Unit kerja |
| status | enum | Ya | aktif/nonaktif |

### Acceptance Criteria

1. Administrator dapat menambah pengguna.
2. Administrator dapat mengubah data pengguna.
3. Administrator dapat menonaktifkan pengguna.
4. Administrator dapat mengatur role.
5. Pengguna nonaktif tidak dapat login.

---

## 6.13 Modul Audit Trail

### Deskripsi

Modul ini mencatat seluruh aktivitas penting pengguna di dalam sistem.

### Aktivitas yang Dicatat

1. Login.
2. Logout.
3. Tambah data.
4. Ubah data.
5. Hapus data.
6. Upload dokumen.
7. Kirim ajuan.
8. Approval/reject.
9. Disposisi.
10. Tindak lanjut disposisi.
11. Download dokumen.
12. Backup data.

### Field Audit Trail

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| user_id | relation | Ya | Pengguna yang melakukan aktivitas |
| aktivitas | string | Ya | Jenis aktivitas |
| modul | string | Ya | Modul terkait |
| data_id | string | Opsional | ID data terkait |
| ip_address | string | Opsional | IP pengguna |
| user_agent | string | Opsional | Browser/device |
| created_at | datetime | Ya | Waktu aktivitas |

### Acceptance Criteria

1. Sistem mencatat aktivitas penting secara otomatis.
2. Administrator dapat melihat audit trail.
3. Audit trail tidak dapat diubah oleh pengguna biasa.
4. Audit trail dapat difilter berdasarkan tanggal, user, dan modul.

---

## 7. Alur Proses Bisnis

## 7.1 Alur Surat Masuk Eksternal

1. Operator login.
2. Operator memilih menu Surat Masuk.
3. Operator mengisi data surat masuk eksternal.
4. Operator mengupload file surat.
5. Sistem membuat nomor agenda.
6. Operator menyimpan registrasi surat.
7. Operator meneruskan surat kepada pimpinan.
8. Pimpinan menerima notifikasi surat masuk.
9. Pimpinan membaca surat.
10. Pimpinan membuat disposisi.
11. Pimpinan menentukan tujuan disposisi.
12. User/staf menerima disposisi.
13. User/staf melakukan tindak lanjut.
14. Pimpinan memantau tindak lanjut.
15. Surat masuk masuk ke arsip digital.

## 7.2 Alur Ajuan Surat oleh User

1. User login.
2. User memilih menu Ajuan Surat.
3. User mengisi form ajuan surat.
4. User mengupload dokumen pendukung jika ada.
5. User melakukan preview konsep naskah.
6. User mengirim konsep surat.
7. Operator menerima ajuan.
8. Operator memeriksa naskah.
9. Operator meneruskan kepada pimpinan untuk approval.
10. Pimpinan menyetujui atau menolak surat.
11. Jika disetujui, operator mengirim naskah final.
12. Jika ditolak, sistem mengirim catatan alasan penolakan kepada user.
13. User melihat status ajuan.
14. Surat tersimpan di arsip digital.

## 7.3 Alur Surat Keluar

1. Operator/user membuat atau menginput naskah surat keluar.
2. Operator memeriksa naskah.
3. Operator meneruskan naskah kepada pimpinan.
4. Pimpinan membaca naskah.
5. Pimpinan menyetujui atau menolak naskah.
6. Jika disetujui, operator mengirim surat keluar.
7. Sistem memperbarui status menjadi dikirim.
8. Surat keluar tersimpan di arsip digital.

## 7.4 Alur Disposisi

1. Pimpinan menerima surat dari operator.
2. Pimpinan membaca detail surat.
3. Pimpinan memilih menu Disposisi.
4. Pimpinan memilih tujuan disposisi.
5. Pimpinan mengisi instruksi disposisi.
6. Pimpinan menentukan prioritas dan batas waktu.
7. Sistem mengirim notifikasi kepada tujuan disposisi.
8. User/staf menerima disposisi.
9. User/staf mengisi tindak lanjut.
10. Sistem memperbarui status disposisi.
11. Pimpinan memantau hasil tindak lanjut.

---

## 8. Role-Based Access Control

| Modul/Fitur | User | Operator | Pimpinan | Administrator | Pegawai |
|---|---:|---:|---:|---:|---:|
| Login | Ya | Ya | Ya | Ya | Ya |
| Dashboard | Ya | Ya | Ya | Ya | Ya |
| Ajuan Surat | Ya | Lihat/Proses | Approval | Tidak | Tidak |
| Kirim Konsep Surat | Ya | Proses | Approval | Tidak | Tidak |
| Preview Konsep Naskah | Ya | Ya | Ya | Tidak | Tidak |
| Registrasi Surat Masuk | Tidak | Ya | Lihat | Tidak | Tidak |
| Surat Keluar | Terbatas | Ya | Approval | Tidak | Tidak |
| Disposisi Surat | Terima | Teruskan | Ya | Tidak | Terima tertentu |
| Tindak Lanjut Disposisi | Ya | Ya | Monitoring | Tidak | Terbatas |
| Arsip Digital | Sesuai akses | Ya | Ya | Ya | Terbatas |
| Notifikasi | Ya | Ya | Ya | Ya | Ya |
| Laporan | Terbatas | Ya | Ya | Ya | Tidak |
| Manajemen Pengguna | Tidak | Tidak | Tidak | Ya | Tidak |
| Audit Trail | Tidak | Tidak | Lihat terbatas | Ya | Tidak |
| Backup Data | Tidak | Tidak | Tidak | Ya | Tidak |

---

## 9. Kebutuhan Data Master

Sistem membutuhkan data master berikut:

1. Data pengguna.
2. Data role.
3. Data hak akses.
4. Data jabatan.
5. Data unit kerja.
6. Data jenis surat.
7. Data sifat surat.
8. Data klasifikasi surat.
9. Data status surat.
10. Data tujuan disposisi.

---

## 10. Struktur Database Rekomendasi

## 10.1 Tabel users

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| name | varchar | Nama lengkap |
| username | varchar | Username unik |
| email | varchar | Email |
| password | varchar | Password hash |
| role_id | bigint | Relasi ke roles |
| position | varchar | Jabatan |
| department | varchar | Unit kerja |
| status | enum | active/inactive |
| created_at | timestamp | Waktu dibuat |
| updated_at | timestamp | Waktu diubah |

## 10.2 Tabel roles

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| name | varchar | Nama role |
| description | text | Deskripsi role |
| created_at | timestamp | Waktu dibuat |
| updated_at | timestamp | Waktu diubah |

## 10.3 Tabel permissions

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| name | varchar | Nama permission |
| module | varchar | Nama modul |
| action | varchar | create/read/update/delete/approve/export |

## 10.4 Tabel role_permissions

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| role_id | bigint | Relasi roles |
| permission_id | bigint | Relasi permissions |

## 10.5 Tabel incoming_letters

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| agenda_number | varchar | Nomor agenda |
| letter_number | varchar | Nomor surat |
| letter_date | date | Tanggal surat |
| received_date | date | Tanggal diterima |
| sender | varchar | Pengirim |
| subject | varchar | Perihal |
| letter_type_id | bigint | Jenis surat |
| priority | enum | biasa/penting/segera/rahasia |
| file_path | varchar | Lokasi file |
| status | enum | registered/forwarded/disposed/completed |
| created_by | bigint | User pembuat |
| forwarded_to | bigint | Pimpinan tujuan |
| created_at | timestamp | Waktu dibuat |
| updated_at | timestamp | Waktu diubah |

## 10.6 Tabel outgoing_letters

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| letter_number | varchar | Nomor surat |
| letter_date | date | Tanggal surat |
| recipient | varchar | Tujuan surat |
| subject | varchar | Perihal |
| summary | text | Ringkasan |
| file_path | varchar | File naskah |
| status | enum | draft/reviewed/approved/rejected/sent |
| created_by | bigint | Pembuat |
| approved_by | bigint | Pimpinan approval |
| rejection_note | text | Alasan penolakan |
| created_at | timestamp | Waktu dibuat |
| updated_at | timestamp | Waktu diubah |

## 10.7 Tabel letter_requests

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| request_number | varchar | Nomor ajuan |
| user_id | bigint | Pengaju |
| request_date | date | Tanggal ajuan |
| letter_type_id | bigint | Jenis surat |
| subject | varchar | Perihal |
| recipient | varchar | Tujuan surat |
| content | text | Isi/keterangan ajuan |
| attachment_path | varchar | Lampiran |
| status | enum | draft/submitted/processed/waiting_approval/approved/rejected/completed |
| rejection_note | text | Alasan penolakan |
| created_at | timestamp | Waktu dibuat |
| updated_at | timestamp | Waktu diubah |

## 10.8 Tabel dispositions

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| incoming_letter_id | bigint | Surat masuk terkait |
| from_user_id | bigint | Pemberi disposisi |
| to_user_id | bigint | Tujuan disposisi |
| instruction | text | Instruksi |
| priority | enum | biasa/penting/segera |
| due_date | date | Batas waktu |
| status | enum | sent/received/followed_up/completed |
| created_at | timestamp | Waktu dibuat |
| updated_at | timestamp | Waktu diubah |

## 10.9 Tabel disposition_followups

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| disposition_id | bigint | Relasi disposisi |
| user_id | bigint | User yang menindaklanjuti |
| note | text | Catatan tindak lanjut |
| file_path | varchar | Lampiran hasil |
| status | enum | process/completed |
| created_at | timestamp | Waktu dibuat |
| updated_at | timestamp | Waktu diubah |

## 10.10 Tabel notifications

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| user_id | bigint | Penerima notifikasi |
| title | varchar | Judul notifikasi |
| message | text | Isi notifikasi |
| type | varchar | Jenis notifikasi |
| reference_id | bigint | ID data terkait |
| reference_type | varchar | Modul terkait |
| is_read | boolean | Status dibaca |
| created_at | timestamp | Waktu dibuat |

## 10.11 Tabel audit_logs

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| user_id | bigint | User pelaku |
| activity | varchar | Aktivitas |
| module | varchar | Modul |
| data_id | bigint | ID data |
| ip_address | varchar | IP address |
| user_agent | text | Browser/device |
| created_at | timestamp | Waktu aktivitas |

## 10.12 Tabel letter_types

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| name | varchar | Nama jenis surat |
| description | text | Deskripsi |
| created_at | timestamp | Waktu dibuat |
| updated_at | timestamp | Waktu diubah |

## 10.13 Tabel system_backups

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | bigint | Primary key |
| file_path | varchar | Lokasi file backup |
| backup_by | bigint | Admin pelaksana backup |
| backup_date | timestamp | Tanggal backup |
| status | enum | success/failed |
| note | text | Catatan |

---

## 11. Kebutuhan Antarmuka Pengguna

## 11.1 Layout Umum

Setiap halaman utama harus memiliki:

1. Sidebar menu sesuai role.
2. Header dengan nama pengguna dan notifikasi.
3. Breadcrumb lokasi halaman.
4. Area konten utama.
5. Tombol aksi utama yang jelas.
6. Tabel data dengan fitur search, filter, pagination.
7. Modal konfirmasi untuk aksi penting.

## 11.2 Halaman Login

Komponen:

1. Logo aplikasi/instansi.
2. Input username/email.
3. Input password.
4. Tombol login.
5. Pesan error login.

## 11.3 Halaman Dashboard

Komponen:

1. Card statistik.
2. Grafik sederhana surat/ajuan/disposisi.
3. Daftar notifikasi terbaru.
4. Shortcut menu.

## 11.4 Halaman Daftar Data

Setiap daftar data harus memiliki:

1. Search box.
2. Filter tanggal.
3. Filter status.
4. Filter jenis surat.
5. Tombol tambah data jika diizinkan.
6. Tombol detail.
7. Tombol edit jika diizinkan.
8. Tombol hapus jika diizinkan.
9. Pagination.

## 11.5 Halaman Detail Surat

Komponen:

1. Informasi surat.
2. Preview dokumen.
3. Status proses.
4. Riwayat aktivitas.
5. Tombol disposisi/approval/tindak lanjut sesuai role.

---

## 12. Kebutuhan Non-Fungsional

## 12.1 Keamanan

1. Password harus di-hash menggunakan bcrypt/argon2.
2. Sistem menggunakan session/token authentication.
3. Akses halaman dibatasi berdasarkan role dan permission.
4. Upload file harus divalidasi berdasarkan ekstensi dan ukuran.
5. File sensitif tidak boleh dapat diakses langsung tanpa otorisasi.
6. Sistem harus memiliki proteksi CSRF jika menggunakan session-based auth.
7. Input harus divalidasi untuk mencegah SQL injection dan XSS.
8. Audit trail wajib aktif untuk aktivitas penting.

## 12.2 Performa

1. Halaman dashboard harus terbuka maksimal 3 detik pada data normal.
2. Tabel data menggunakan pagination.
3. Pencarian arsip harus mendukung filter agar tidak lambat.
4. Upload dokumen maksimal 10 MB per file pada versi awal.

## 12.3 Ketersediaan

1. Sistem dapat digunakan melalui browser modern.
2. Sistem harus tetap dapat menyimpan data dengan konsisten.
3. Backup database harus tersedia untuk administrator.

## 12.4 Usability

1. Tampilan sederhana dan mudah dipahami.
2. Menu disesuaikan dengan role.
3. Pesan error harus jelas.
4. Status surat harus mudah dilihat.
5. Tombol aksi penting harus memiliki konfirmasi.

## 12.5 Kompatibilitas

Sistem minimal mendukung:

1. Google Chrome versi terbaru.
2. Microsoft Edge versi terbaru.
3. Mozilla Firefox versi terbaru.
4. Tampilan responsive untuk desktop dan tablet.

---

## 13. Spesifikasi Upload File

### Format File yang Diizinkan

1. PDF
2. DOC
3. DOCX
4. JPG
5. JPEG
6. PNG

### Batasan File

1. Maksimal ukuran file: 10 MB.
2. Nama file disimpan dengan format unik.
3. File harus tersimpan di storage aplikasi atau object storage.
4. Path file disimpan di database.
5. File dapat dipreview jika format PDF atau gambar.

---

## 14. Status dan State Machine

## 14.1 Status Ajuan Surat

```text
Draft -> Dikirim -> Diproses Operator -> Menunggu Approval -> Disetujui -> Selesai
                                          -> Ditolak
```

## 14.2 Status Surat Masuk

```text
Diregistrasi -> Diteruskan ke Pimpinan -> Didisposisikan -> Ditindaklanjuti -> Selesai
```

## 14.3 Status Surat Keluar

```text
Draft -> Diperiksa -> Menunggu Approval -> Disetujui -> Dikirim
                                      -> Ditolak
```

## 14.4 Status Disposisi

```text
Dikirim -> Diterima -> Ditindaklanjuti -> Selesai
```

---

## 15. API Endpoint Rekomendasi

> Catatan: Endpoint dapat disesuaikan dengan framework yang digunakan.

## 15.1 Auth

| Method | Endpoint | Deskripsi | Role |
|---|---|---|---|
| POST | /api/auth/login | Login pengguna | Public |
| POST | /api/auth/logout | Logout pengguna | Semua role |
| GET | /api/auth/me | Data user login | Semua role |

## 15.2 Users

| Method | Endpoint | Deskripsi | Role |
|---|---|---|---|
| GET | /api/users | Daftar user | Administrator |
| POST | /api/users | Tambah user | Administrator |
| GET | /api/users/{id} | Detail user | Administrator |
| PUT | /api/users/{id} | Ubah user | Administrator |
| DELETE | /api/users/{id} | Hapus/nonaktif user | Administrator |
| PUT | /api/users/{id}/reset-password | Reset password | Administrator |

## 15.3 Letter Requests

| Method | Endpoint | Deskripsi | Role |
|---|---|---|---|
| GET | /api/letter-requests | Daftar ajuan surat | User/Operator/Pimpinan |
| POST | /api/letter-requests | Buat ajuan surat | User |
| GET | /api/letter-requests/{id} | Detail ajuan | User/Operator/Pimpinan |
| PUT | /api/letter-requests/{id} | Ubah ajuan draft | User |
| POST | /api/letter-requests/{id}/submit | Kirim ajuan | User |
| POST | /api/letter-requests/{id}/approve | Setujui ajuan | Pimpinan |
| POST | /api/letter-requests/{id}/reject | Tolak ajuan | Pimpinan |

## 15.4 Incoming Letters

| Method | Endpoint | Deskripsi | Role |
|---|---|---|---|
| GET | /api/incoming-letters | Daftar surat masuk | Operator/Pimpinan/Admin |
| POST | /api/incoming-letters | Registrasi surat masuk | Operator |
| GET | /api/incoming-letters/{id} | Detail surat masuk | Operator/Pimpinan |
| PUT | /api/incoming-letters/{id} | Ubah surat masuk | Operator |
| POST | /api/incoming-letters/{id}/forward | Teruskan ke pimpinan | Operator |

## 15.5 Outgoing Letters

| Method | Endpoint | Deskripsi | Role |
|---|---|---|---|
| GET | /api/outgoing-letters | Daftar surat keluar | Operator/Pimpinan/Admin |
| POST | /api/outgoing-letters | Tambah surat keluar | Operator |
| GET | /api/outgoing-letters/{id} | Detail surat keluar | Operator/Pimpinan |
| PUT | /api/outgoing-letters/{id} | Ubah surat keluar | Operator |
| POST | /api/outgoing-letters/{id}/approve | Approve surat keluar | Pimpinan |
| POST | /api/outgoing-letters/{id}/reject | Reject surat keluar | Pimpinan |
| POST | /api/outgoing-letters/{id}/send | Kirim surat keluar | Operator |

## 15.6 Dispositions

| Method | Endpoint | Deskripsi | Role |
|---|---|---|---|
| GET | /api/dispositions | Daftar disposisi | Pimpinan/User/Operator |
| POST | /api/dispositions | Buat disposisi | Pimpinan |
| GET | /api/dispositions/{id} | Detail disposisi | Pimpinan/User |
| POST | /api/dispositions/{id}/receive | Tandai diterima | User |
| POST | /api/dispositions/{id}/follow-up | Kirim tindak lanjut | User |
| POST | /api/dispositions/{id}/complete | Selesaikan disposisi | Pimpinan |

## 15.7 Archives

| Method | Endpoint | Deskripsi | Role |
|---|---|---|---|
| GET | /api/archives | Daftar arsip | Sesuai role |
| GET | /api/archives/{id} | Detail arsip | Sesuai role |
| GET | /api/archives/{id}/download | Download dokumen | Sesuai role |

## 15.8 Notifications

| Method | Endpoint | Deskripsi | Role |
|---|---|---|---|
| GET | /api/notifications | Daftar notifikasi | Semua role |
| POST | /api/notifications/{id}/read | Tandai dibaca | Semua role |
| POST | /api/notifications/read-all | Tandai semua dibaca | Semua role |

## 15.9 Reports

| Method | Endpoint | Deskripsi | Role |
|---|---|---|---|
| GET | /api/reports/incoming-letters | Laporan surat masuk | Operator/Pimpinan/Admin |
| GET | /api/reports/outgoing-letters | Laporan surat keluar | Operator/Pimpinan/Admin |
| GET | /api/reports/letter-requests | Laporan ajuan surat | Operator/Pimpinan/Admin |
| GET | /api/reports/dispositions | Laporan disposisi | Pimpinan/Admin |
| GET | /api/reports/export/pdf | Export PDF | Sesuai role |
| GET | /api/reports/export/excel | Export Excel | Sesuai role |

## 15.10 Audit Logs

| Method | Endpoint | Deskripsi | Role |
|---|---|---|---|
| GET | /api/audit-logs | Daftar audit trail | Administrator |

---

## 16. Validasi Form

## 16.1 Validasi Login

1. Username/email wajib diisi.
2. Password wajib diisi.
3. Jika akun tidak ditemukan, tampilkan pesan error.
4. Jika password salah, tampilkan pesan error.
5. Jika akun nonaktif, tampilkan pesan akun tidak aktif.

## 16.2 Validasi Ajuan Surat

1. Jenis surat wajib dipilih.
2. Perihal wajib diisi.
3. Tujuan surat wajib diisi.
4. Isi ajuan wajib diisi.
5. File lampiran hanya boleh menggunakan format yang diizinkan.
6. Ukuran file tidak boleh melebihi batas maksimal.

## 16.3 Validasi Surat Masuk

1. Nomor surat wajib diisi.
2. Tanggal surat wajib diisi.
3. Tanggal terima wajib diisi.
4. Pengirim wajib diisi.
5. Perihal wajib diisi.
6. Jenis surat wajib dipilih.
7. File surat wajib diupload.

## 16.4 Validasi Disposisi

1. Tujuan disposisi wajib dipilih.
2. Instruksi wajib diisi.
3. Prioritas wajib dipilih.
4. Batas waktu tidak boleh lebih kecil dari tanggal hari ini jika diisi.

---

## 17. Notifikasi dan Trigger

| Trigger | Penerima | Isi Notifikasi |
|---|---|---|
| User mengirim ajuan surat | Operator | Ajuan surat baru masuk |
| Operator meneruskan surat ke pimpinan | Pimpinan | Surat masuk perlu dibaca |
| Pimpinan membuat disposisi | User/Staf tujuan | Disposisi baru diterima |
| User mengirim tindak lanjut | Pimpinan | Tindak lanjut disposisi diterima |
| Pimpinan approve ajuan | User/Operator | Ajuan surat disetujui |
| Pimpinan reject ajuan | User/Operator | Ajuan surat ditolak |
| Operator mengirim surat keluar | Pimpinan/User terkait | Surat telah dikirim |

---

## 18. Laporan dan Format Output

## 18.1 Laporan Surat Masuk

Kolom laporan:

1. Nomor agenda.
2. Nomor surat.
3. Tanggal surat.
4. Tanggal terima.
5. Pengirim.
6. Perihal.
7. Jenis surat.
8. Sifat surat.
9. Status.

## 18.2 Laporan Surat Keluar

Kolom laporan:

1. Nomor surat.
2. Tanggal surat.
3. Tujuan surat.
4. Perihal.
5. Status.
6. Dibuat oleh.
7. Disetujui oleh.

## 18.3 Laporan Ajuan Surat

Kolom laporan:

1. Nomor ajuan.
2. Tanggal ajuan.
3. Nama pengaju.
4. Jenis surat.
5. Perihal.
6. Status.
7. Catatan penolakan jika ada.

## 18.4 Laporan Disposisi

Kolom laporan:

1. Nomor surat.
2. Pemberi disposisi.
3. Tujuan disposisi.
4. Instruksi.
5. Prioritas.
6. Batas waktu.
7. Status tindak lanjut.

---

## 19. Kriteria Selesai / Definition of Done

Sebuah fitur dianggap selesai jika:

1. UI sudah tersedia dan dapat digunakan.
2. Backend endpoint sudah tersedia.
3. Database sudah menyimpan data dengan benar.
4. Validasi form berjalan.
5. Hak akses sesuai role berjalan.
6. Notifikasi terkait berjalan jika dibutuhkan.
7. Audit trail tercatat untuk aktivitas penting.
8. Error handling tersedia.
9. Fitur lulus pengujian black box.
10. Tidak ada bug kritis pada alur utama.

---

## 20. Skenario Pengujian Black Box

## 20.1 Login

| No | Skenario | Input | Hasil yang Diharapkan |
|---|---|---|---|
| 1 | Login berhasil | Username dan password benar | Masuk dashboard sesuai role |
| 2 | Login gagal | Password salah | Muncul pesan error |
| 3 | Login akun nonaktif | Akun status nonaktif | Login ditolak |
| 4 | Field kosong | Username/password kosong | Validasi wajib isi muncul |

## 20.2 Ajuan Surat

| No | Skenario | Input | Hasil yang Diharapkan |
|---|---|---|---|
| 1 | Buat ajuan valid | Semua field wajib diisi | Ajuan tersimpan |
| 2 | Kirim ajuan | Klik kirim | Status menjadi dikirim |
| 3 | Upload file valid | PDF/DOCX < 10 MB | File berhasil diupload |
| 4 | Upload file tidak valid | File EXE | File ditolak |
| 5 | Lihat status | Buka menu status | Status tampil sesuai proses |

## 20.3 Surat Masuk

| No | Skenario | Input | Hasil yang Diharapkan |
|---|---|---|---|
| 1 | Registrasi surat masuk | Data valid | Surat masuk tersimpan |
| 2 | Field wajib kosong | Nomor surat kosong | Muncul validasi |
| 3 | Teruskan ke pimpinan | Pilih pimpinan | Status menjadi diteruskan |
| 4 | Upload dokumen surat | File PDF | File tersimpan |

## 20.4 Disposisi

| No | Skenario | Input | Hasil yang Diharapkan |
|---|---|---|---|
| 1 | Buat disposisi | Tujuan dan instruksi valid | Disposisi terkirim |
| 2 | Tujuan kosong | Tidak memilih user | Muncul validasi |
| 3 | User menerima disposisi | Buka disposisi masuk | Detail disposisi tampil |
| 4 | Kirim tindak lanjut | Isi catatan tindak lanjut | Status berubah ditindaklanjuti |

## 20.5 Approval

| No | Skenario | Input | Hasil yang Diharapkan |
|---|---|---|---|
| 1 | Approve surat | Klik approve | Status disetujui |
| 2 | Reject surat | Isi alasan dan klik reject | Status ditolak dan catatan tersimpan |
| 3 | Reject tanpa alasan | Alasan kosong | Validasi muncul |

## 20.6 Arsip

| No | Skenario | Input | Hasil yang Diharapkan |
|---|---|---|---|
| 1 | Cari arsip | Keyword valid | Data sesuai muncul |
| 2 | Filter tanggal | Periode tanggal | Data sesuai periode muncul |
| 3 | Download dokumen | Klik download | File berhasil diunduh |

## 20.7 Manajemen Pengguna

| No | Skenario | Input | Hasil yang Diharapkan |
|---|---|---|---|
| 1 | Tambah user | Data valid | User tersimpan |
| 2 | Username duplikat | Username sudah ada | Validasi muncul |
| 3 | Ubah role | Pilih role baru | Role berubah |
| 4 | Nonaktifkan user | Klik nonaktif | User tidak dapat login |

---

## 21. Prioritas Pengembangan

## 21.1 Prioritas Tinggi / MVP

1. Login dan role access.
2. Dashboard sederhana.
3. Manajemen pengguna.
4. Ajuan surat.
5. Registrasi surat masuk.
6. Penerusan surat ke pimpinan.
7. Disposisi surat.
8. Tindak lanjut disposisi.
9. Status surat.
10. Arsip digital dasar.
11. Notifikasi internal.
12. Audit trail dasar.

## 21.2 Prioritas Sedang

1. Laporan surat masuk dan keluar.
2. Export PDF dan Excel.
3. Preview dokumen.
4. Filter dan pencarian lanjutan.
5. Approval lengkap dengan catatan penolakan.

## 21.3 Prioritas Rendah

1. Grafik statistik lanjutan.
2. Backup otomatis terjadwal.
3. Template surat.
4. Integrasi email.
5. Integrasi tanda tangan digital.

---

## 22. Rekomendasi Teknologi

AI Agent boleh memilih stack sesuai kebutuhan, tetapi rekomendasi stack adalah:

### Frontend

1. React.js / Next.js
2. Tailwind CSS
3. Axios/Fetch API
4. React Hook Form
5. Data table component

### Backend

1. Laravel / Node.js Express / NestJS
2. REST API
3. JWT atau session authentication
4. Role-based access control

### Database

1. MySQL atau PostgreSQL

### Storage

1. Local storage untuk development.
2. Object storage untuk production jika diperlukan.

### Export File

1. PDF generator.
2. Excel generator.

---

## 23. Instruksi Eksekusi untuk AI Agent

AI Agent harus menjalankan pengembangan dengan urutan berikut:

1. Buat struktur project frontend dan backend.
2. Buat konfigurasi environment.
3. Buat skema database dan migration.
4. Buat seed data role: User, Operator, Pimpinan, Administrator, Pegawai.
5. Buat seed permission dasar untuk setiap role.
6. Implementasi autentikasi login/logout.
7. Implementasi middleware role dan permission.
8. Implementasi dashboard sesuai role.
9. Implementasi CRUD pengguna untuk administrator.
10. Implementasi modul ajuan surat.
11. Implementasi upload dokumen.
12. Implementasi modul registrasi surat masuk.
13. Implementasi fitur teruskan surat ke pimpinan.
14. Implementasi modul disposisi.
15. Implementasi modul tindak lanjut disposisi.
16. Implementasi modul surat keluar.
17. Implementasi approval/reject.
18. Implementasi arsip digital.
19. Implementasi notifikasi internal.
20. Implementasi laporan dan export.
21. Implementasi audit trail.
22. Implementasi validasi form lengkap.
23. Implementasi pengujian black box untuk alur utama.
24. Buat dokumentasi instalasi dan penggunaan.

---

## 24. Struktur Folder Rekomendasi

Jika menggunakan pendekatan frontend-backend terpisah:

```text
e-office/
├── backend/
│   ├── app/
│   ├── config/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   ├── routes/
│   ├── storage/
│   ├── tests/
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── assets/
│   └── README.md
│
├── docs/
│   ├── PRD.md
│   ├── API.md
│   ├── DATABASE.md
│   └── TESTING.md
│
└── README.md
```

---

## 25. Environment Variable Rekomendasi

```env
APP_NAME=E-Office
APP_ENV=local
APP_URL=http://localhost:3000
API_URL=http://localhost:8000/api
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=eoffice_db
DB_USERNAME=root
DB_PASSWORD=
JWT_SECRET=change_this_secret
MAX_UPLOAD_SIZE=10240
STORAGE_DRIVER=local
```

---

## 26. Data Seed Awal

## 26.1 Role

1. Administrator
2. Operator
3. Pimpinan
4. User
5. Pegawai

## 26.2 User Default

| Nama | Username | Password | Role |
|---|---|---|---|
| Super Admin | admin | admin123 | Administrator |
| Operator | operator | operator123 | Operator |
| Pimpinan | pimpinan | pimpinan123 | Pimpinan |
| User Demo | user | user123 | User |
| Pegawai Demo | pegawai | pegawai123 | Pegawai |

> Password default wajib diganti setelah sistem production.

## 26.3 Jenis Surat

1. Surat Undangan
2. Surat Pengumuman
3. Surat Permohonan
4. Surat Keputusan
5. Surat Tugas
6. Surat Edaran
7. Surat Keterangan
8. Surat Lainnya

## 26.4 Sifat Surat

1. Biasa
2. Penting
3. Segera
4. Rahasia

---

## 27. Pesan Error Standar

| Kondisi | Pesan |
|---|---|
| Login gagal | Username atau password salah. |
| Akun nonaktif | Akun Anda tidak aktif. Hubungi administrator. |
| Akses ditolak | Anda tidak memiliki akses ke halaman ini. |
| Field wajib kosong | Field ini wajib diisi. |
| Upload gagal | File gagal diupload. Periksa format dan ukuran file. |
| File tidak valid | Format file tidak diizinkan. |
| Data tidak ditemukan | Data tidak ditemukan. |
| Server error | Terjadi kesalahan pada server. Silakan coba lagi. |

---

## 28. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Role/hak akses tidak tepat | Data bisa diakses pihak tidak berwenang | Implementasi RBAC dan testing akses |
| File upload berbahaya | Risiko keamanan server | Validasi ekstensi, MIME type, ukuran file |
| Data surat hilang | Gangguan administrasi | Backup data dan audit trail |
| User bingung menggunakan sistem | Adopsi rendah | UI sederhana dan panduan penggunaan |
| Proses disposisi tidak selesai | Surat tidak ditindaklanjuti | Notifikasi dan status monitoring |

---

## 29. Deliverables

AI Agent harus menghasilkan:

1. Source code frontend.
2. Source code backend.
3. Database migration.
4. Database seeder.
5. API endpoint sesuai kebutuhan.
6. UI halaman utama seluruh role.
7. Fitur upload dan preview dokumen.
8. Fitur notifikasi internal.
9. Fitur laporan dan export.
10. Audit trail.
11. Dokumentasi instalasi.
12. Dokumentasi penggunaan.
13. Dokumentasi API.
14. Skenario pengujian black box.

---

## 30. Kriteria Keberhasilan Produk

Produk dinyatakan berhasil jika:

1. User dapat mengajukan surat secara digital.
2. Operator dapat mencatat dan meneruskan surat masuk.
3. Pimpinan dapat membaca dan mendisposisikan surat.
4. User/staf dapat menerima dan menindaklanjuti disposisi.
5. Surat keluar dapat diproses dan dikirim melalui sistem.
6. Status setiap proses surat dapat dilacak.
7. Arsip digital dapat dicari dan diunduh.
8. Laporan dapat dibuat berdasarkan periode tertentu.
9. Hak akses setiap role berjalan sesuai kebutuhan.
10. Sistem lulus pengujian black box pada alur utama.

---

## 31. Catatan Implementasi Tambahan

1. Gunakan soft delete untuk data penting seperti surat dan pengguna.
2. Nomor agenda dan nomor ajuan sebaiknya dibuat otomatis.
3. Semua aksi penting wajib masuk audit trail.
4. Jangan menghapus file surat secara permanen tanpa otorisasi administrator.
5. Gunakan pagination untuk seluruh tabel besar.
6. Gunakan filter tanggal pada seluruh laporan.
7. Pastikan UI tetap mudah digunakan oleh pengguna non-teknis.
8. Buat validasi di frontend dan backend.
9. Gunakan timezone Asia/Jakarta.
10. Siapkan README untuk cara instalasi lokal.

---

## 32. Penutup

Dokumen PRD ini menjadi acuan utama bagi AI Agent dalam membangun aplikasi E-Office berbasis website untuk pengelolaan surat masuk, surat keluar, pengajuan surat, disposisi, arsip digital, laporan, notifikasi, dashboard, dan manajemen pengguna.

Semua implementasi harus mengikuti kebutuhan role, alur proses, validasi, dan acceptance criteria yang telah dijelaskan dalam dokumen ini.

1. Code berubah ke-1
2. Code berubah ke-2