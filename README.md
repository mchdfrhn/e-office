# E-Office

Frontend Next.js, API Express, dan PostgreSQL tetap dipisahkan sebagai modul agar batas UI, API, dan data tetap jelas. Untuk penggunaan lokal, semuanya dikelola dari root proyek dengan satu perintah.

## Menjalankan aplikasi

Pasang seluruh dependency sekali:

```powershell
npm run install:all
```

Jalankan seluruh aplikasi:

```powershell
npm run dev
```

Perintah tersebut akan menjalankan atau memakai layanan yang sudah aktif, dengan urutan PostgreSQL, backend, lalu frontend.

- Aplikasi: http://localhost:3000
- API: http://127.0.0.1:8000/api
- Pemeriksaan API: http://127.0.0.1:8000/api/health

Tekan `Ctrl+C` untuk menghentikan layanan yang dibuat oleh perintah tersebut.
