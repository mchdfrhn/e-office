"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");
const AUTH_TOKEN_KEY = "eoffice_auth_token";
const DUMMY_USER_KEY = "eoffice_dummy_user";
const LOCAL_AJUAN_KEY = "eoffice_local_ajuan_requests";
const LOCAL_INCOMING_KEY = "eoffice_local_incoming_letters";
const LOCAL_OUTGOING_KEY = "eoffice_local_outgoing_letters";
const LOCAL_USERS_KEY = "eoffice_local_users";
const ATTACHMENT_DB_NAME = "eoffice_attachment_store";
const ATTACHMENT_DB_VERSION = 1;
const ATTACHMENT_STORE_NAME = "attachments";
const API_TIMEOUT_MS = 3500;

const backendRoleToUiRole = {
  administrator: "Administrator",
  operator: "Operator",
  pimpinan: "Pimpinan",
  user: "User"
};

const dummyLoginUsers = [
  {
    username: "admin",
    password: "admin123",
    user: { id: "dummy-admin", full_name: "Super Admin", username: "admin", email: "admin@e-office.local", role_code: "administrator", role_name: "Administrator", status: "aktif" }
  },
  {
    username: "administrator",
    password: "admin123",
    user: { id: "dummy-admin", full_name: "Super Admin", username: "administrator", email: "admin@e-office.local", role_code: "administrator", role_name: "Administrator", status: "aktif" }
  },
  {
    username: "operator",
    password: "operator123",
    user: { id: "dummy-operator", full_name: "Rina Operator", username: "operator", email: "operator@e-office.local", role_code: "operator", role_name: "Operator", status: "aktif" }
  },
  {
    username: "pimpinan",
    password: "pimpinan123",
    user: { id: "dummy-pimpinan", full_name: "Dewi Pimpinan", username: "pimpinan", email: "pimpinan@e-office.local", role_code: "pimpinan", role_name: "Pimpinan", status: "aktif" }
  },
  {
    username: "user",
    password: "user123",
    user: { id: "dummy-user", full_name: "Budi Santoso", username: "user", email: "user@e-office.local", role_code: "user", role_name: "User", status: "aktif" }
  }
];

function findDummyLogin(username, password) {
  const loginUsername = String(username || "").trim().toLowerCase();
  return dummyLoginUsers.find((account) => account.username === loginUsername && account.password === password);
}

function getStoredToken() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(AUTH_TOKEN_KEY) || "";
}

function getStoredSessionUser() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem(DUMMY_USER_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(token, user = null) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  if (user) window.sessionStorage.setItem(DUMMY_USER_KEY, JSON.stringify(user));
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(DUMMY_USER_KEY);
}

function clearSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
  window.sessionStorage.removeItem(DUMMY_USER_KEY);
}

function readLocalJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    if (key === LOCAL_AJUAN_KEY) {
      window.localStorage.setItem(key, JSON.stringify(stripAjuanAttachmentPayloads(value)));
    }
  }
}

function openAttachmentDb() {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(ATTACHMENT_DB_NAME, ATTACHMENT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTACHMENT_STORE_NAME)) db.createObjectStore(ATTACHMENT_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function saveAttachmentPayload(key, dataUrl) {
  const db = await openAttachmentDb();
  if (!db || !key || !dataUrl) return;
  await new Promise((resolve) => {
    const transaction = db.transaction(ATTACHMENT_STORE_NAME, "readwrite");
    transaction.objectStore(ATTACHMENT_STORE_NAME).put(dataUrl, key);
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
  });
  db.close();
}

async function getAttachmentPayload(key) {
  const db = await openAttachmentDb();
  if (!db || !key) return "";
  const value = await new Promise((resolve) => {
    const transaction = db.transaction(ATTACHMENT_STORE_NAME, "readonly");
    const request = transaction.objectStore(ATTACHMENT_STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || "");
    request.onerror = () => resolve("");
  });
  db.close();
  return value;
}

function makeAttachmentKey(prefix, nomor, file) {
  return `${prefix}:${nomor || "tanpa-nomor"}:${file.name}:${file.size}:${file.lastModified || Date.now()}`;
}

function generateAjuanNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const sequence = String(Date.now()).slice(-5);
  return `AJ/${year}/${month}/${sequence}`;
}

function generateOutgoingDraftNumber() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta"
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `DRAFT/SK/${byType.year}${byType.month}${byType.day}/${String(Date.now()).slice(-5)}`;
}

function stripAjuanAttachmentPayloads(requests) {
  return requests.map((request) => ({
    ...request,
    dokumenApprovalPimpinan: stripAttachmentPayload(request.dokumenApprovalPimpinan),
    lampiranApproval: (request.lampiranApproval || []).map(stripAttachmentPayload),
    suratFinalOperator: stripAttachmentPayload(request.suratFinalOperator),
    lampiranFinal: (request.lampiranFinal || []).map(stripAttachmentPayload),
    lampiran: (request.lampiran || []).map((attachment) => {
      return stripAttachmentPayload(attachment);
    })
  }));
}

async function hydrateAjuanAttachmentPayloads(requests) {
  const hydratedRequests = await Promise.all(requests.map(async (request) => ({
    ...request,
    dokumenApprovalPimpinan: await hydrateAttachmentPayload(request.dokumenApprovalPimpinan),
    lampiranApproval: await Promise.all((request.lampiranApproval || []).map(hydrateAttachmentPayload)),
    suratFinalOperator: await hydrateAttachmentPayload(request.suratFinalOperator),
    lampiranFinal: await Promise.all((request.lampiranFinal || []).map(hydrateAttachmentPayload)),
    lampiran: await Promise.all((request.lampiran || []).map(async (attachment) => {
      return hydrateAttachmentPayload(attachment);
    }))
  })));
  return hydratedRequests;
}

function stripOutgoingAttachmentPayloads(letters) {
  return letters.map((letter) => ({
    ...letter,
    dokumenApprovalPimpinan: stripAttachmentPayload(letter.dokumenApprovalPimpinan),
    lampiranApproval: (letter.lampiranApproval || []).map(stripAttachmentPayload),
    dokumenPendukungRevisi: stripAttachmentPayload(letter.dokumenPendukungRevisi),
    lampiranRevisiDraft: (letter.lampiranRevisiDraft || []).map(stripAttachmentPayload),
    suratFinalOperator: stripAttachmentPayload(letter.suratFinalOperator),
    lampiranFinal: (letter.lampiranFinal || []).map(stripAttachmentPayload),
    lampiran: (letter.lampiran || []).map(stripAttachmentPayload)
  }));
}

async function hydrateOutgoingAttachmentPayloads(letters) {
  return Promise.all(letters.map(async (letter) => ({
    ...letter,
    dokumenApprovalPimpinan: await hydrateAttachmentPayload(letter.dokumenApprovalPimpinan),
    lampiranApproval: await Promise.all((letter.lampiranApproval || []).map(hydrateAttachmentPayload)),
    dokumenPendukungRevisi: await hydrateAttachmentPayload(letter.dokumenPendukungRevisi),
    lampiranRevisiDraft: await Promise.all((letter.lampiranRevisiDraft || []).map(hydrateAttachmentPayload)),
    suratFinalOperator: await hydrateAttachmentPayload(letter.suratFinalOperator),
    lampiranFinal: await Promise.all((letter.lampiranFinal || []).map(hydrateAttachmentPayload)),
    lampiran: await Promise.all((letter.lampiran || []).map(hydrateAttachmentPayload))
  })));
}

function stripAttachmentPayload(attachment) {
  if (!attachment) return attachment;
  const [name, size, meta, dataUrl, mime, storageKey] = attachment;
  return dataUrl ? [name, size, meta, "", mime, storageKey] : attachment;
}

async function hydrateAttachmentPayload(attachment) {
  if (!attachment) return attachment;
  const [name, size, meta, dataUrl, mime, storageKey] = attachment;
  if (dataUrl || !storageKey) return attachment;
  const storedDataUrl = await getAttachmentPayload(storageKey);
  return [name, size, meta, storedDataUrl, mime, storageKey];
}

function normalizeAjuanWorkflowStatus(requests) {
  const normalizedRequests = requests.filter((request) => !isRemovedAjuanRequest(request)).map((request) => {
    if (request.status === "Ajuan Baru" && hasUploadedAjuanDocument(request)) {
      return { ...request, status: "Menunggu Approval", diteruskanKe: request.diteruskanKe || "Dewi Pimpinan" };
    }
    if (request.status === "Diproses" && request.hasilPemeriksaan === "Data lengkap dan valid") {
      return { ...request, status: "Menunggu Approval", diteruskanKe: request.diteruskanKe || "Dewi Pimpinan" };
    }
    return request;
  });
  return getLatestAjuanRequests(normalizedRequests);
}

function isRemovedAjuanRequest(request) {
  const nomor = String(request?.nomor || "").trim().toLowerCase();
  const jenis = String(request?.jenis || "").trim().toLowerCase();
  const judul = String(request?.judul || request?.keterangan || "").trim().toLowerCase();
  const tanggal = String(request?.tanggal || "").trim().toLowerCase();
  return (
    nomor === "003/05/2026" ||
    (
      jenis === "surat undangan" &&
      judul === "undangan bukber" &&
      tanggal === "25 mei 2026"
    ) ||
    (
      jenis === "surat undangan" &&
      judul === "surat undangan" &&
      tanggal === "22 mei 2026"
    ) ||
    (
      jenis === "surat edaran/surat pengumuman" &&
      judul.includes("pengumuman libur idul adha") &&
      tanggal === "1 juni 2026"
    )
  );
}

function getAjuanIdentityKey(request) {
  return [
    request?.pemohon || "",
    request?.jenis || "",
    request?.judul || request?.keterangan || "",
    request?.tujuan || ""
  ].map((value) => String(value).trim().toLowerCase()).join("|");
}

function isDummyToken(token = getStoredToken()) {
  return token.startsWith("dummy:");
}

async function apiFetch(path, options = {}) {
  const token = getStoredToken();
  if (!token || isDummyToken(token)) {
    throw new Error("API backend belum aktif untuk sesi ini.");
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Request backend gagal.");
  }
  return payload;
}

async function loginBackendSession(username, password) {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Login backend gagal.");
  }
  saveSession(payload.token, payload.user);
  return payload.user;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Backend lokal tidak merespons. Silakan coba lagi atau gunakan akun dummy.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function toTitleCase(value) {
  return String(value || "-").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta"
  }).format(new Date(value));
}

function formatDateOnly(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta"
  }).format(new Date(value));
}

function getJakartaDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta"
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function formatJakartaInputDate(value) {
  return value ? formatDateOnly(`${value}T00:00:00+07:00`) : "-";
}

function mapApiUserToRow(user) {
  return [
    String(user.id || "").slice(0, 8).toUpperCase(),
    user.full_name || "-",
    user.role || user.role_name || "-",
    user.unit || "-",
    toTitleCase(user.status)
  ];
}

function mapApiAuditToRow(log) {
  return [
    formatDateTime(log.created_at),
    log.user_name || "Sistem",
    log.module || "-",
    log.activity || "-",
    log
  ];
}

const roleConfig = {
  User: {
    name: "Budi Santoso",
    nav: ["Dashboard", "Ajuan Surat", "Disposisi Masuk"],
    stats: [["Total Ajuan", "18"], ["Diproses", "6"], ["Disetujui", "9"], ["Disposisi", "4"]]
  },
  Operator: {
    name: "Rina Operator",
    nav: ["Dashboard", "Ajuan Masuk", "Surat Masuk", "Surat Keluar", "Arsip", "Laporan"],
    stats: [["Ajuan Masuk", "27"], ["Surat Masuk", "124"], ["Surat Keluar", "76"], ["Perlu Verifikasi", "11"]]
  },
  Pimpinan: {
    name: "Dewi Pimpinan",
    nav: ["Dashboard", "Surat Masuk", "Approval", "Disposisi", "Arsip"],
    stats: [["Review Masuk", "17"], ["Approval", "9"], ["Disposisi Aktif", "13"], ["Selesai", "41"]]
  },
  Administrator: {
    name: "Admin Sistem",
    nav: ["Dashboard", "Pengguna", "Arsip", "Laporan", "Audit Trail", "Backup"],
    stats: [["Pengguna", "48"], ["Role", "5"], ["Audit Hari Ini", "129"], ["Backup", "03:00"]]
  },
  Pegawai: {
    name: "Sari Pegawai",
    nav: ["Dashboard", "Disposisi", "Arsip", "Notifikasi"],
    stats: [["Surat Diterima", "14"], ["Undangan", "8"], ["Pengumuman", "5"], ["Download", "11"]]
  }
};

const profileDirectory = {
  "Budi Santoso": {
    name: "Budi Santoso",
    role: "User",
    unit: "Kepegawaian",
    email: "budi.santoso@stt-pu.ac.id",
    phone: "0812-3456-7890",
    nim: "202101891",
    nik: "3309190107020006",
    address: "Jl. D.I. Panjaitan Kav. 24, Jakarta Timur"
  },
  "Rina Operator": {
    name: "Rina Operator",
    role: "Operator",
    unit: "Tata Usaha",
    email: "rina.operator@stt-pu.ac.id",
    phone: "0812-3456-7890",
    address: "Jl. D.I. Panjaitan Kav. 24, Jakarta Timur"
  },
  "Dewi Pimpinan": {
    name: "Dewi Pimpinan",
    role: "Pimpinan",
    unit: "Pimpinan",
    email: "dewi.pimpinan@stt-pu.ac.id",
    phone: "0812-3456-7890",
    address: "Jl. D.I. Panjaitan Kav. 24, Jakarta Timur"
  },
  "Admin Sistem": {
    name: "Admin Sistem",
    role: "Administrator",
    unit: "Sistem Informasi",
    email: "admin.sistem@stt-pu.ac.id",
    phone: "0812-3456-7890",
    address: "Jl. D.I. Panjaitan Kav. 24, Jakarta Timur"
  }
};

function getProfileFor(name, role) {
  return profileDirectory[name] || {
    name,
    role,
    unit: role === "User" ? "Kepegawaian" : role === "Operator" ? "Tata Usaha" : role === "Administrator" ? "Sistem Informasi" : role || "-",
    email: `${String(name || "user").toLowerCase().replaceAll(" ", ".")}@stt-pu.ac.id`,
    phone: "0812-3456-7890",
    address: "Jl. D.I. Panjaitan Kav. 24, Jakarta Timur"
  };
}

const rows = {
  "Ajuan Surat": [
    ["AJ-2026-0007", "Surat Tugas", "Pendampingan audit internal", "Budi Santoso", "Menunggu Approval"],
    ["AJ-2026-0006", "Surat Keterangan", "Keterangan aktif pegawai", "Nadia Putri", "Diproses"],
    ["AJ-2026-0005", "Surat Undangan", "Undangan rapat koordinasi", "Andi Wijaya", "Disetujui"]
  ],
  "Surat Masuk": [
    ["AG-2026-041", "SM/109/V/2026", "Dinas Kominfo", "Permintaan data layanan", "Diteruskan"],
    ["AG-2026-040", "SM/108/V/2026", "Bappeda", "Koordinasi program", "Diregistrasi"],
    ["AG-2026-039", "SM/107/V/2026", "Inspektorat", "Jadwal audit", "Didisposisikan"]
  ],
  "Surat Keluar": [
    ["SK/PU/V/2026/018", "Surat Edaran", "Unit Internal", "Pembaruan SOP Arsip", "Menunggu Approval"],
    ["SK/PU/V/2026/017", "Surat Undangan", "Mitra Kerja", "Rapat Evaluasi Triwulan", "Disetujui"],
    ["SK/PU/V/2026/016", "Surat Tugas", "Pegawai", "Kegiatan Lapangan", "Dikirim"],
    ["SK/PU/V/2026/015", "Surat Permohonan", "Instansi Pemerintah", "Permohonan Data", "Draft"],
    ["SK/PU/V/2026/014", "Surat Pemberitahuan", "Perusahaan", "Jadwal Kunjungan", "Dikirim"]
  ],
  Disposisi: [
    ["DSP-2026-021", "SM/109/V/2026", "Bagian Umum", "Segera tindak lanjuti", "Dikirim"],
    ["DSP-2026-020", "SM/106/V/2026", "Keuangan", "Telaah dan laporkan", "Ditindaklanjuti"],
    ["DSP-2026-019", "SM/103/V/2026", "Sekretariat", "Arsipkan setelah selesai", "Selesai"]
  ],
  Arsip: [
    ["ARS-1124", "Surat Masuk", "Permintaan data layanan", "PDF", "Selesai"],
    ["ARS-1123", "Ajuan Surat", "Pendampingan audit internal", "PDF", "Disetujui"],
    ["ARS-1122", "Disposisi", "Telaah dan laporkan", "PDF", "Selesai"]
  ],
  "Arsip Digital": [
    ["ARS-1124", "Surat Masuk", "Permintaan data layanan", "PDF", "Selesai"],
    ["ARS-1123", "Ajuan Surat", "Pendampingan audit internal", "PDF", "Disetujui"],
    ["ARS-1122", "Disposisi", "Telaah dan laporkan", "PDF", "Selesai"]
  ],
  "Konsep Surat": [
    ["AJ-2026-0004", "Surat Izin Penelitian", "Menunggu kelengkapan lampiran", "Budi Santoso", "Draft"],
    ["AJ-2026-0003", "Surat Tugas", "Konsep kegiatan lapangan", "Budi Santoso", "Draft"],
    ["AJ-2026-0002", "Surat Permohonan", "Permohonan data riset", "Budi Santoso", "Draft"]
  ],
  "Status Ajuan": [
    ["AJ-2026-0007", "Surat Tugas", "Pendampingan audit internal", "Budi Santoso", "Diproses"],
    ["AJ-2026-0006", "Surat Keterangan", "Keterangan aktif pegawai", "Nadia Putri", "Disetujui"],
    ["AJ-2026-0005", "Surat Undangan", "Undangan rapat koordinasi", "Andi Wijaya", "Ditolak"]
  ],
  Pengguna: [
    ["USR-001", "Rina Operator", "Operator", "Tata Usaha", "Aktif"],
    ["USR-002", "Dewi Pimpinan", "Pimpinan", "Kepala Bagian", "Aktif"],
    ["USR-003", "Budi Santoso", "User", "Kepegawaian", "Aktif"]
  ],
  "Audit Trail": [
    ["10:42 WIB", "Rina Operator", "Surat Masuk", "Teruskan surat AG-2026-041"],
    ["10:21 WIB", "Budi Santoso", "Ajuan Surat", "Kirim ajuan AJ-2026-0007"],
    ["09:55 WIB", "Admin Sistem", "Users", "Ubah status pengguna"]
  ]
};

const notifications = [
  ["Ajuan surat baru masuk", "Operator perlu memeriksa AJ-2026-0007.", true],
  ["Surat diteruskan ke pimpinan", "AG-2026-041 menunggu disposisi.", true],
  ["Disposisi baru diterima", "Bagian Umum menerima instruksi segera.", true],
  ["Ajuan surat disetujui", "AJ-2026-0005 siap dikirim final.", false]
];

const tableHeads = {
  "Ajuan Surat": ["Nomor", "Jenis", "Perihal", "Pengaju", "Status"],
  "Ajuan Masuk": ["Nomor", "Jenis", "Perihal", "Pengaju", "Status"],
  "Surat Masuk": ["Agenda", "Nomor Surat", "Pengirim", "Perihal", "Status"],
  "Surat Keluar": ["Nomor", "Jenis", "Tujuan", "Perihal", "Status"],
  Disposisi: ["ID", "Nomor Surat", "Tujuan", "Instruksi", "Status"],
  Arsip: ["Kode", "Tipe", "Perihal", "Format", "Status"],
  "Arsip Digital": ["Kode", "Tipe", "Perihal", "Format", "Status"],
  "Konsep Surat": ["Nomor", "Jenis", "Perihal", "Pengaju", "Status"],
  "Status Ajuan": ["Nomor", "Jenis", "Perihal", "Pengaju", "Status"],
  Pengguna: ["ID", "Nama", "Role", "Unit Kerja", "Status"],
  "Audit Trail": ["Waktu", "User", "Modul", "Aktivitas"]
};

function outgoingLetterToRow(letter) {
  return [letter.nomor, letter.jenis, letter.tujuan, letter.perihal, letter.status];
}

const outgoingDisplayDates = {
  "SK/PU/V/2026/018": "21 Juni 2026",
  "SK/PU/V/2026/017": "21 Juni 2026",
  "SK/PU/V/2026/016": "20 Juni 2026",
  "SK/PU/V/2026/015": "19 Juni 2026",
  "SK/PU/V/2026/014": "18 Juni 2026",
  "SK-2026-018": "15 Mei 2026",
  "SK-2026-017": "14 Mei 2026",
  "SK-2026-016": "13 Mei 2026"
};

function getOutgoingDisplayDate(letter) {
  return letter?.tanggal || outgoingDisplayDates[letter?.nomor] || "21 Juni 2026";
}

function normalizeOutgoingWorkflowStatus(letters) {
  return letters.map((letter) => ({
    ...letter,
    status: letter.status === "Diperiksa" ? "Menunggu Approval" : letter.status
  }));
}

const initialOutgoingLetters = rows["Surat Keluar"].map(([nomor, jenis, tujuan, perihal, status]) => ({
  nomor,
  jenis,
  tujuan,
  perihal,
  status,
  tanggal: outgoingDisplayDates[nomor]
}));

const initialAjuanRequests = [
  {
    nomor: "AJ/2025/05/00131",
    jenis: "Surat Izin Penelitian",
    pemohon: "Nadia Putri",
    unit: "Akademik",
    tanggal: "20 Mei 2025",
    status: "Menunggu Approval",
    tujuan: "Dinas Pekerjaan Umum Provinsi DKI Jakarta",
    judul: "Izin penelitian manajemen proyek pada pekerjaan konstruksi jalan",
    keterangan: "Dengan hormat, saya mengajukan permohonan pembuatan surat izin penelitian untuk keperluan pengumpulan data tugas akhir. Penelitian akan dilakukan pada instansi terkait dengan topik manajemen proyek pekerjaan konstruksi jalan. Mohon bantuan Bapak/Ibu untuk memproses surat ini sesuai prosedur yang berlaku.",
    nim: "202101891",
    nik: "3309190107020006",
    email: "nadia.putri@student.ac.id",
    phone: "0812-3456-7890",
    lampiran: [
      ["Proposal_Penelitian.pdf", "512 KB", "Diunggah 20 Mei 2025, 16:05 WIB"],
      ["Surat_Pengantar_Prodi.pdf", "428 KB", "Diunggah 20 Mei 2025, 16:05 WIB"],
      ["Kartu_Mahasiswa.pdf", "256 KB", "Diunggah 20 Mei 2025, 16:05 WIB"]
    ]
  },
  { nomor: "AJ/2025/05/00129", jenis: "Surat Permohonan", pemohon: "Sari Pegawai", unit: "Keuangan", tanggal: "19 Mei 2025", status: "Disetujui" },
  { nomor: "AJ/2025/05/00128", jenis: "Surat Keterangan", pemohon: "Andi Wijaya", unit: "Akademik", tanggal: "19 Mei 2025", status: "Menunggu Approval" },
  { nomor: "AJ/2025/05/00127", jenis: "Surat Undangan", pemohon: "Rina Lestari", unit: "Kemahasiswaan", tanggal: "19 Mei 2025", status: "Menunggu Approval" },
  { nomor: "AJ/2025/05/00126", jenis: "Surat Izin Penelitian", pemohon: "Fajar Ramadhan", unit: "Akademik", tanggal: "18 Mei 2025", status: "Disetujui" },
  { nomor: "AJ/2025/05/00125", jenis: "Surat Tugas", pemohon: "Luthfi Hakim", unit: "Umum", tanggal: "18 Mei 2025", status: "Ditolak" },
  { nomor: "AJ/2025/05/00124", jenis: "Surat Permohonan", pemohon: "Dewi Kartika", unit: "Keuangan", tanggal: "17 Mei 2025", status: "Menunggu Approval" }
];

const initialUsers = [
  ["USR-001", "Rina Operator", "Operator", "Tata Usaha", "Aktif"],
  ["USR-002", "Dewi Pimpinan", "Pimpinan", "Kepala Bagian", "Aktif"],
  ["USR-003", "Budi Santoso", "User", "Kepegawaian", "Aktif"]
];

const demoPortalAccounts = {
  Operator: "operator",
  User: "user",
  Pimpinan: "pimpinan",
  Administrator: "administrator"
};

const ajuanLetterTypeOptions = [
  "Surat Undangan",
  "Surat Edaran/Surat Pengumuman",
  "Surat Permohonan",
  "Surat Keputusan",
  "Surat Tugas",
  "Surat Keterangan",
  "Surat Izin Penelitian",
  "Surat Lainnya"
];

export default function Home({ initialRole = "User", startLoggedIn = false }) {
  const initialDemoRole = roleConfig[initialRole] ? initialRole : "User";
  const [loggedIn, setLoggedIn] = useState(startLoggedIn);
  const [username, setUsername] = useState(startLoggedIn ? demoPortalAccounts[initialDemoRole] || "user" : "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [role, setRole] = useState(initialDemoRole);
  const [sessionUser, setSessionUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(!startLoggedIn);
  const [loginLoading, setLoginLoading] = useState(false);
  const [view, setView] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [ajuanRequests, setAjuanRequests] = useState(initialAjuanRequests);
  const [outgoingLetters, setOutgoingLetters] = useState(initialOutgoingLetters);
  const [userRows, setUserRows] = useState(initialUsers);
  const [auditRows, setAuditRows] = useState(rows["Audit Trail"]);
  const [apiNotice, setApiNotice] = useState("");
  const [localDataReady, setLocalDataReady] = useState(false);

  const loadUsers = useCallback(async () => {
    const usersPayload = await apiFetch("/users?perPage=100");
    setUserRows((usersPayload.data || []).map(mapApiUserToRow));
  }, []);

  const loadAuditLogs = useCallback(async () => {
    const auditPayload = await apiFetch("/audit-logs?perPage=100");
    setAuditRows((auditPayload.data || []).map(mapApiAuditToRow));
  }, []);

  const config = { ...roleConfig[role], name: sessionUser?.full_name || roleConfig[role].name };
  const currentProfile = getProfileFor(config.name, role);
  const utilityViews = ["Notifikasi", "Pengaturan Profil"];
  const currentView = config.nav.includes(view) || utilityViews.includes(view) ? view : "Dashboard";
  const sidebarNavItems = config.nav;
  const activeNavIndex = Math.max(sidebarNavItems.indexOf(currentView), 0);
  const unreadCount = notifications.filter((item) => item[2]).length;

  useEffect(() => {
    let cancelled = false;

    async function loadLocalData() {
      const storedAjuan = readLocalJson(LOCAL_AJUAN_KEY, initialAjuanRequests);
      const storedOutgoing = readLocalJson(LOCAL_OUTGOING_KEY, initialOutgoingLetters);
      const hydratedAjuan = await hydrateAjuanAttachmentPayloads(storedAjuan);
      const hydratedOutgoing = await hydrateOutgoingAttachmentPayloads(storedOutgoing);
      if (cancelled) return;
      setAjuanRequests(normalizeAjuanWorkflowStatus(hydratedAjuan));
      setOutgoingLetters(normalizeOutgoingWorkflowStatus(hydratedOutgoing));
      setUserRows(readLocalJson(LOCAL_USERS_KEY, initialUsers));
      setLocalDataReady(true);
    }

    loadLocalData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function syncAjuanFromStorage(event) {
      try {
        if (event.key === LOCAL_AJUAN_KEY && event.newValue) {
          const storedAjuan = JSON.parse(event.newValue);
          hydrateAjuanAttachmentPayloads(storedAjuan).then((hydratedAjuan) => {
            setAjuanRequests(normalizeAjuanWorkflowStatus(hydratedAjuan));
          });
        }
        if (event.key === LOCAL_OUTGOING_KEY && event.newValue) {
          const storedOutgoing = JSON.parse(event.newValue);
          hydrateOutgoingAttachmentPayloads(storedOutgoing).then((hydratedOutgoing) => {
            setOutgoingLetters(normalizeOutgoingWorkflowStatus(hydratedOutgoing));
          });
        }
      } catch {
        if (event.key === LOCAL_AJUAN_KEY) setAjuanRequests(initialAjuanRequests);
        if (event.key === LOCAL_OUTGOING_KEY) setOutgoingLetters(initialOutgoingLetters);
      }
    }

    window.addEventListener("storage", syncAjuanFromStorage);
    return () => window.removeEventListener("storage", syncAjuanFromStorage);
  }, []);

  useEffect(() => {
    if (!localDataReady) return;
    writeLocalJson(LOCAL_AJUAN_KEY, stripAjuanAttachmentPayloads(normalizeAjuanWorkflowStatus(ajuanRequests)));
  }, [ajuanRequests, localDataReady]);

  useEffect(() => {
    if (!localDataReady) return;
    writeLocalJson(LOCAL_OUTGOING_KEY, stripOutgoingAttachmentPayloads(normalizeOutgoingWorkflowStatus(outgoingLetters)));
  }, [outgoingLetters, localDataReady]);

  useEffect(() => {
    if (!localDataReady || (!isDummyToken() && getStoredToken())) return;
    writeLocalJson(LOCAL_USERS_KEY, userRows);
  }, [userRows, localDataReady]);

  useEffect(() => {
    let ignore = false;

    async function loadAdminData() {
      if (!loggedIn || role !== "Administrator" || isDummyToken()) return;

      try {
        const [usersPayload, auditPayload] = await Promise.all([
          apiFetch("/users?perPage=50"),
          apiFetch("/audit-logs?perPage=20")
        ]);
        if (ignore) return;
        setUserRows((usersPayload.data || []).map(mapApiUserToRow));
        setAuditRows((auditPayload.data || []).map(mapApiAuditToRow));
        setApiNotice("");
      } catch (error) {
        if (!ignore) setApiNotice(error.message);
      }
    }

    loadAdminData();
    return () => {
      ignore = true;
    };
  }, [loggedIn, role]);

  useEffect(() => {
    let ignore = false;

    async function restoreSession() {
      const token = getStoredToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }

      if (token.startsWith("dummy:")) {
        const dummyUser = getStoredSessionUser();
        if (dummyUser && !ignore) applyAuthenticatedUser(dummyUser);
        setAuthLoading(false);
        return;
      }

      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Session expired");
        const payload = await response.json();
        if (!ignore) applyAuthenticatedUser(payload.user);
      } catch {
        clearSession();
        if (!ignore) setLoggedIn(false);
      } finally {
        if (!ignore) setAuthLoading(false);
      }
    }

    restoreSession();
    return () => {
      ignore = true;
    };
  }, []);

  function applyAuthenticatedUser(user) {
    const nextRole = backendRoleToUiRole[user?.role_code] || "User";
    setSessionUser(user);
    setUsername(user?.username || "");
    setRole(nextRole);
    setView("Dashboard");
    setLoggedIn(true);
  }

  function applyDummyLogin(account) {
    saveSession(`dummy:${account.user.id}`, account.user);
    applyAuthenticatedUser(account.user);
  }

  async function login(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const loginUsername = String(form.get("username") || "").trim();
    const loginPassword = String(form.get("password") || "");
    const nextErrors = {};

    if (!loginUsername) nextErrors.username = "Username/email wajib diisi.";
    if (!loginPassword) nextErrors.password = "Password wajib diisi.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoginLoading(true);
    setErrors({});

    const dummyAccount = findDummyLogin(loginUsername, loginPassword);

    try {
      const user = await loginBackendSession(loginUsername, loginPassword);
      applyAuthenticatedUser(user);
      setPassword("");
    } catch (error) {
      if (dummyAccount && !error.message.includes("Username atau password salah")) {
        applyDummyLogin(dummyAccount);
        setPassword("");
        return;
      }
      setErrors({ form: error.message || "Backend belum bisa dihubungi. Untuk mode dummy gunakan admin/admin123, operator/operator123, pimpinan/pimpinan123, atau user/user123." });
    } finally {
      setLoginLoading(false);
    }
  }

  function submitForgotPassword(event) {
    event.preventDefault();
    const identifier = resetIdentifier.trim();
    if (!identifier) {
      setErrors({ reset: "Username atau email wajib diisi." });
      return;
    }

    const account = dummyLoginUsers.find((item) => {
      const value = identifier.toLowerCase();
      return item.username === value || item.user.email?.toLowerCase() === value;
    });

    setErrors({});
    setResetSent(true);
    setConfirm({
      title: "Permintaan reset password dikirim",
      body: account
        ? `Instruksi reset password untuk ${account.user.full_name} sudah dibuat. Pada implementasi produksi, tautan reset dikirim ke ${account.user.email}.`
        : "Jika akun terdaftar, instruksi reset password akan dikirim ke email yang sesuai."
    });
  }

  function openForgotPassword() {
    setForgotMode(true);
    setResetIdentifier(username);
    setResetSent(false);
    setErrors({});
  }

  function backToLogin() {
    setForgotMode(false);
    setResetIdentifier("");
    setResetSent(false);
    setErrors({});
  }

  async function logout() {
    const token = getStoredToken();
    setProfileOpen(false);
    if (token && !isDummyToken(token)) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => null);
    }
    clearSession();
    setSessionUser(null);
    setPassword("");
    setLoggedIn(false);
    setView("Dashboard");
  }

  function submitModule(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    const nextErrors = {};
    if (!form.get("jenis")) nextErrors.jenis = "Field ini wajib dipilih.";
    if (!String(form.get("perihal") || "").trim()) nextErrors.perihal = "Field ini wajib diisi.";
    if (file && file.name) {
      const fileError = validateUploadFile(file);
      if (fileError) nextErrors.file = fileError;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) setConfirm({ title: "Simpan data?", body: "Data akan disimpan dan aktivitasnya masuk audit trail." });
  }

  function createAjuanRequest(request) {
    if (isRemovedAjuanRequest(request)) return;
    const requestKey = getAjuanIdentityKey(request);
    setAjuanRequests((current) => [
      request,
      ...current.filter((item) => (
        item.nomor !== request.nomor &&
        getAjuanIdentityKey(item) !== requestKey
      ))
    ]);
    if (request.revisiDariStatus) {
      setConfirm({ title: "Revisi terkirim", body: `${request.nomor} sudah dikirim kembali ke portal pimpinan untuk approval ulang.` });
      return;
    }
    if (request.dikirimDariDraft) {
      setConfirm({ title: "Draft dikirim", body: `${request.nomor} sudah diperbarui dari draft menjadi Menunggu Approval.` });
      return;
    }
    setConfirm({ title: "Ajuan terkirim", body: `${request.nomor} sudah masuk ke portal pimpinan untuk proses approval. Operator dapat memantau aktivitas ajuan.` });
  }

  function updateAjuanRequest(nomor, updates) {
    if (isRemovedAjuanRequest({ nomor, ...updates })) return;
    setAjuanRequests((current) => {
      const exists = current.some((item) => item.nomor === nomor);
      if (exists) {
        return current.map((item) => (
          item.nomor === nomor ? { ...item, ...updates } : item
        ));
      }
      return [{ nomor, ...updates }, ...current];
    });
  }

  function createOutgoingLetter(letter) {
    setOutgoingLetters((current) => {
      const nextLetters = current.filter((item) => item.nomor !== letter.nomor);
      return [letter, ...nextLetters];
    });
    setConfirm({
      title: "Surat keluar terkirim ke proses",
      body: `${letter.nomor} sudah masuk daftar surat keluar dengan status Menunggu Approval untuk keputusan pimpinan.`
    });
  }

  function updateOutgoingLetter(nomor, updates) {
    setOutgoingLetters((current) => current.map((letter) => (
      letter.nomor === nomor
        ? {
            ...letter,
            ...updates,
            riwayat: [
              ...(letter.riwayat || []),
              ...(updates.riwayat || [])
            ]
          }
        : letter
    )));
  }

  async function createUser(user) {
    if (!isDummyToken()) {
      try {
        const payload = await apiFetch("/users", {
          method: "POST",
          body: JSON.stringify({
            fullName: user.name,
            username: user.username,
            email: user.email,
            password: user.password,
            role: user.role,
            unit: user.unit,
            position: user.jabatan,
            status: user.status
          })
        });
        setUserRows((current) => [mapApiUserToRow(payload.data), ...current]);
        setConfirm({ title: "User tersimpan", body: `${user.name} sudah disimpan ke database dan audit trail dicatat.` });
        return true;
      } catch (error) {
        setConfirm({ title: "Gagal simpan ke backend", body: error.message });
        return false;
      }
    }

    setUserRows((current) => {
      const nextNumber = current.length + 1;
      const id = `USR-${String(nextNumber).padStart(3, "0")}`;
      return [[id, user.name, user.role, user.unit || user.jabatan || "-", user.status], ...current];
    });
    setConfirm({ title: "User dummy tersimpan", body: `${user.name} sudah ditambahkan ke daftar pengguna lokal.` });
    return true;
  }

  if (authLoading) {
    return (
      <main className="loginShell">
        <section className="loginPanel">
          <div className="loginCard">
            <h2>Memeriksa sesi</h2>
            <p className="muted">Mohon tunggu sebentar.</p>
          </div>
        </section>
      </main>
    );
  }

  const handleDeleteUser = async (id, name) => {
    if (isDummyToken()) {
      setUserRows((current) => current.map((row) => (
        row[0] === id ? [row[0], row[1], row[2], row[3], "Nonaktif"] : row
      )));
      setConfirm({ title: "User dummy dinonaktifkan", body: `${name} telah dinonaktifkan di daftar lokal.` });
      return;
    }

    try {
      await apiFetch(`/users/${id}`, { method: "DELETE" });
      await loadUsers();
      setConfirm({ title: "User terhapus", body: `${name} telah berhasil dinonaktifkan.` });
    } catch (error) {
      setConfirm({ title: "Gagal menghapus", body: error.message });
    }
  };

  const handleResetPassword = async (id, name) => {
    if (isDummyToken()) {
      setConfirm({ title: "Password dummy direset", body: `Password untuk ${name} disetel ke Reset123! pada mode lokal.` });
      return;
    }

    try {
      await apiFetch(`/users/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: "Reset123!" })
      });
      setConfirm({ title: "Password direset", body: `Password untuk ${name} telah berhasil direset ke 'Reset123!'.` });
    } catch (error) {
      setConfirm({ title: "Gagal mereset", body: error.message });
    }
  };

  if (!loggedIn) {
    return (
      <main className="loginShell">
        <section className="loginHero">
          <div className="loginBrand">
            <img src="/stt-pu-logo.png" alt="Logo STT Pekerjaan Umum Jakarta" />
            <div>
              <strong>E-Office</strong>
              <span>STT Pekerjaan Umum Jakarta</span>
            </div>
          </div>
          <div className="showcaseScene" aria-label="Ilustrasi surat e-office">
            <span className="softCloud cloudLeft" />
            <span className="softCloud cloudRight" />
            <span className="paperPlane" />
            <span className="dashedFlight" />
            <div className="contactCard">
              <i />
              <div>
                <span />
                <span />
              </div>
            </div>
            <div className="mailScene" aria-hidden="true">
              <div className="mailShadow" />
              <div className="mailEnvelope">
                <span className="mailFlap" />
                <span className="mailWing left" />
                <span className="mailWing right" />
                <div className="mailPaper">
                  <span className="paperIcon">E</span>
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
            <div className="floatingDoc">
              <i />
              <i />
              <i />
              <b />
            </div>
            <div className="chatBubble">@</div>
            <div className="stampBase" />
            <div className="sliderDots"><span /><span /><span /></div>
          </div>
        </section>
        <section className="loginPanel">
          <div className="loginCard">
            <div className="loginIcon" aria-hidden="true"><LineIcon name="bank" /></div>
            <h2>{forgotMode ? "Reset Password" : "Login E-Office"}</h2>
            <p className="muted">{forgotMode ? "Masukkan username atau email akun untuk menerima instruksi pemulihan." : "Silakan masuk untuk melanjutkan"}</p>
            {forgotMode ? (
              <form onSubmit={submitForgotPassword} noValidate>
                <LoginField label="Email / Username" error={errors.reset} icon="user">
                  <input name="resetIdentifier" value={resetIdentifier} onChange={(event) => setResetIdentifier(event.target.value)} placeholder="Masukkan email atau username" />
                </LoginField>
                {resetSent && <small className="loginSuccessText">Permintaan reset password sudah dicatat.</small>}
                <button className="primaryBtn">Kirim Instruksi Reset</button>
                <button type="button" className="linkBtn loginBackLink" onClick={backToLogin}>Kembali ke login</button>
              </form>
            ) : (
              <form onSubmit={login} noValidate>
                <LoginField label="Email / Username" error={errors.username} icon="user">
                  <input name="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Masukkan email atau username" />
                </LoginField>
                <LoginField
                  label="Password"
                  error={errors.password}
                  icon="lock"
                  action="eye"
                  actionLabel={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  actionPressed={showPassword}
                  onAction={() => setShowPassword((current) => !current)}
                >
                  <input name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" />
                </LoginField>
                {errors.form && <small className="fieldError loginFormError">{errors.form}</small>}
                <div className="loginOptions">
                  <label className="rememberCheck"><input type="checkbox" defaultChecked /> Ingat saya</label>
                  <button type="button" className="linkBtn" onClick={openForgotPassword}>Lupa password?</button>
                </div>
                <button className="primaryBtn" disabled={loginLoading}>{loginLoading ? "Memproses..." : "Login"}</button>
              </form>
            )}
            <div className="loginDivider" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="appShell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="sidebarBrand">
          <img src="/stt-pu-logo.png" alt="Logo STT Pekerjaan Umum Jakarta" />
          <div><strong>E-Office</strong><small>STT Pekerjaan Umum Jakarta</small></div>
        </div>
        <nav className="navList" style={{ "--active-nav-index": activeNavIndex }}>
          {sidebarNavItems.map((item, index) => (
            <button className={currentView === item ? "navItem sidebar-menu-item sidebar-menu-active active" : "navItem sidebar-menu-item"} key={item} style={{ "--nav-delay": `${index * 0.045}s` }} onClick={() => { setView(item); setMenuOpen(false); }}>
              <span>{navIcon(item)}</span>{item}
            </button>
          ))}
        </nav>
        <button type="button" className="sidebar-n-button" aria-label="Navigation shortcut">N</button>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <button className="iconBtn menuBtn" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
          {currentView === "Ajuan Surat" && (
            <label className="topSearch">
              <LineIcon name="search" />
              <input placeholder="Cari surat, ajuan, atau disposisi..." />
              <span>⌘ K</span>
            </label>
          )}
          <div className="topbarActions">
            <button className="bellBtn" onClick={() => setView("Notifikasi")} aria-label="Buka notifikasi"><LineIcon name="bell" /><b>{unreadCount}</b></button>
            <button className={profileOpen ? "profilePill open" : "profilePill"} onClick={() => setProfileOpen((current) => !current)} aria-expanded={profileOpen} aria-haspopup="menu">
              <span className="avatarFace" />
              <span><strong>{config.name}</strong><small>{role}</small></span>
              <i>⌄</i>
            </button>
            {profileOpen && (
              <div className="profileDropdown" role="menu">
                <div className="profileDropdownHead">
                  <strong>{config.name}</strong>
                  <small>{role}</small>
                </div>
                <button type="button" className="profileDropdownItem active" role="menuitem" onClick={() => { setView("Pengaturan Profil"); setProfileOpen(false); }}>
                  <LineIcon name="settings" />
                  Pengaturan Profil
                </button>
                <button type="button" className="profileDropdownItem logout" role="menuitem" onClick={logout}>
                  <LineIcon name="logout" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </header>
        <section className="content">
          {currentView === "Dashboard" && (role === "Operator" ? <OperatorDashboard setView={setView} /> : role === "Pimpinan" ? <PimpinanDashboard setView={setView} ajuanRequests={ajuanRequests} /> : role === "Administrator" ? <AdminDashboard setView={setView} userRows={userRows} auditRows={auditRows} apiNotice={apiNotice} /> : <Dashboard config={config} role={role} setView={setView} />)}
          {currentView === "Pengaturan Profil" && <ProfileSettings config={config} profile={currentProfile} role={role} setConfirm={setConfirm} />}
          {currentView === "Notifikasi" && <Notifications />}
          {currentView === "Laporan" && <Reports setConfirm={setConfirm} />}
          {currentView === "Approval" && <Approval setConfirm={setConfirm} ajuanRequests={ajuanRequests} outgoingLetters={outgoingLetters} onUpdateAjuan={updateAjuanRequest} onUpdateOutgoing={updateOutgoingLetter} />}
          {currentView === "Ajuan Surat" && <AjuanSuratHome setConfirm={setConfirm} onCreateAjuan={createAjuanRequest} currentUserName={config.name} currentUserProfile={currentProfile} ajuanRequests={ajuanRequests} />}
          {currentView === "Ajuan Masuk" && <OperatorAjuanMasuk setConfirm={setConfirm} ajuanRequests={ajuanRequests} onUpdateAjuan={updateAjuanRequest} />}
          {currentView === "Surat Masuk" && <IncomingLetterForm role={role} setConfirm={setConfirm} />}
          {currentView === "Disposisi Masuk" && <DisposisiMasukHome setConfirm={setConfirm} />}
          {currentView === "Arsip" && <ArchiveHome ajuanRequests={ajuanRequests} />}
          {currentView === "Backup" && <AdminBackup setConfirm={setConfirm} />}
          {["Konsep Surat", "Status Ajuan", "Surat Keluar", "Disposisi", "Arsip Digital", "Pengguna", "Audit Trail"].includes(currentView) && (
            <ModuleView
              view={currentView}
              query={query}
              setQuery={setQuery}
              onSubmit={submitModule}
              errors={errors}
              setConfirm={setConfirm}
              userRows={userRows}
              auditRows={auditRows}
              apiNotice={apiNotice}
              outgoingLetters={outgoingLetters}
              onCreateOutgoing={createOutgoingLetter}
              onUpdateOutgoing={updateOutgoingLetter}
              onCreateUser={createUser}
              onUserDelete={handleDeleteUser}
              onUserResetPassword={handleResetPassword}
              onAuditReviewSuccess={loadAuditLogs}
            />
          )}
        </section>
      </section>
      {confirm && <ConfirmModal confirm={confirm} setConfirm={setConfirm} />}
    </main>
  );
}

function resolveDemoRole(username) {
  const value = String(username || "").trim().toLowerCase();
  if (["operator", "portal operator", "rina", "tu"].includes(value) || value.includes("operator")) return "Operator";
  if (["pimpinan", "portal pimpinan", "dewi"].includes(value) || value.includes("pimpinan")) return "Pimpinan";
  if (["admin", "administrator", "portal administrator"].includes(value) || value.includes("administrator")) return "Administrator";
  if (value.includes("pegawai")) return "Pegawai";
  if (["user", "portal user", "budi"].includes(value) || value.includes("user")) return "User";
  return null;
}

function Dashboard({ config, role, setView }) {
  return (
    <section className="dashboardPage">
      <div className="dashboardTitle">
        <h1>Dashboard {role}</h1>
        <p>Ringkasan aktivitas surat dan disposisi.</p>
      </div>
      <section className="dashboardStats">
        {[
          ["Total Ajuan", "128", "Semua waktu", "doc", "blue"],
          ["Diproses", "34", "Sedang berjalan", "clock", "purple"],
          ["Disetujui", "86", "Semua waktu", "check", "green"],
          ["Disposisi Baru", "7", "Perlu ditindaklanjuti", "mail", "orange"]
        ].map(([label, value, meta, icon, tone]) => (
          <article className={`dashStat ${tone}`} key={label}>
            <span className="dashIcon">{iconSymbol(icon)}</span>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{meta}</small>
            </div>
            <Sparkline tone={tone} />
          </article>
        ))}
      </section>
      <section className="dashboardGrid">
        <article className="dashPanel requestsPanel">
          <PanelHeader title="Ajuan Surat Terbaru" action="Lihat semua" onClick={() => setView("Ajuan Surat")} />
          <table className="dashboardTable">
            <thead><tr><th>Nomor Ajuan</th><th>Jenis Surat</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {[
                ["AJ/2025/05/00128", "Surat Izin Penelitian", "16 Mei 2025", "Disetujui"],
                ["AJ/2025/05/00127", "Surat Tugas", "15 Mei 2025", "Diproses"],
                ["AJ/2025/05/00126", "Surat Permohonan", "15 Mei 2025", "Diproses"],
                ["AJ/2025/05/00125", "Surat Undangan", "14 Mei 2025", "Disetujui"],
                ["AJ/2025/05/00124", "Surat Keterangan", "14 Mei 2025", "Ditolak"]
              ].map((row) => (
                <tr key={row[0]}>
                  <td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td><Status text={row[3]} /></td><td><button className="viewBtn" aria-label={`Lihat detail ${row[0]}`}><LineIcon name="eye" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="dashPanel notificationsPanel">
          <PanelHeader title="Notifikasi Terbaru" action="Lihat semua" onClick={() => setView("Notifikasi")} />
          <div className="dashNoticeList">
            {[
              ["mail", "Disposisi baru dari Kepala Bagian", "Surat Permohonan - AJ/2025/05/00127", "10 menit lalu", "orange"],
              ["check", "Ajuan surat disetujui", "Surat Izin Penelitian - AJ/2025/05/00128", "1 jam lalu", "green"],
              ["doc", "Ajuan surat sedang diproses", "Surat Tugas - AJ/2025/05/00127", "2 jam lalu", "purple"]
            ].map(([icon, title, body, time, tone]) => (
              <div className="dashNotice" key={title}>
                <span className={`noticeIcon ${tone}`}>{iconSymbol(icon)}</span>
                <div><strong>{title}</strong><small>{body}</small></div>
                <time>{time}</time><b />
              </div>
            ))}
          </div>
        </article>
        <article className="dashPanel trendPanel">
          <PanelHeader title="Tren Ajuan Surat (Bulanan)" action="12 Bulan Terakhir" />
          <div className="chartLegend"><span className="blueDot" />Jumlah Ajuan <span className="purpleDot" />Disetujui</div>
          <div className="lineChart">
            <svg viewBox="0 0 720 230" role="img" aria-label="Tren ajuan surat bulanan">
              <defs>
                <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2d73ff" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2d73ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[30, 70, 110, 150, 190].map((y) => <line x1="36" x2="700" y1={y} y2={y} key={y} />)}
              <path className="area" d="M42 194 L94 160 L150 112 L206 108 L262 92 L318 120 L374 132 L430 120 L486 98 L542 120 L598 112 L654 46 L700 104 L700 206 L42 206 Z" />
              <polyline className="line blue" points="42,194 94,160 150,112 206,108 262,92 318,120 374,132 430,120 486,98 542,120 598,112 654,46 700,104" />
              <polyline className="line purple" points="42,204 94,178 150,142 206,138 262,128 318,146 374,164 430,158 486,140 542,158 598,148 654,106 700,134" />
              {["Jun '24", "Jul '24", "Agu '24", "Sep '24", "Okt '24", "Nov '24", "Des '24", "Jan '25", "Feb '25", "Mar '25", "Apr '25", "Mei '25"].map((label, index) => <text x={42 + index * 58} y="224" key={label}>{label}</text>)}
            </svg>
          </div>
        </article>
        <article className="dashPanel summaryPanel">
          <h3>Ringkasan Status Ajuan</h3>
          <div className="summaryBody">
            <div className="donut"><span><strong>128</strong><small>Total</small></span></div>
            <div className="summaryRows">
              {[
                ["Disetujui", "86 (67,2%)", "blue"],
                ["Diproses", "34 (26,6%)", "purple"],
                ["Ditolak", "6 (4,7%)", "orange"],
                ["Dibatalkan", "2 (1,5%)", "gray"]
              ].map(([label, value, tone]) => <p key={label}><i className={tone} />{label}<strong>{value}</strong></p>)}
              <button className="detailLink">Lihat detail →</button>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}

function OperatorDashboard({ setView }) {
  const cards = [
    ["Ajuan Masuk", "27", "Monitoring ajuan", "inbox", "blue", "Ajuan Masuk"],
    ["Surat Masuk", "124", "Email dan manual", "mail", "purple", "Surat Masuk"],
    ["Surat Keluar", "76", "9 menunggu approval", "send", "green", "Surat Keluar"],
    ["Perlu Penomoran", "11", "Menunggu nomor surat", "clock", "orange", "Ajuan Masuk"]
  ];
  const verificationRows = [
    ["AJ/2025/05/00131", "Surat Izin Penelitian", "Nadia Putri", "Menunggu keputusan pimpinan", "Menunggu Approval"],
    ["AJ/2025/05/00130", "Surat Tugas", "Budi Santoso", "Surat ditandatangani pimpinan", "Disetujui"],
    ["AJ/2025/05/00129", "Surat Permohonan", "Andi Wijaya", "Menunggu input nomor surat", "Disetujui"],
    ["AJ/2025/05/00128", "Surat Keterangan", "Sari Pegawai", "Nomor surat sudah tersinkron", "Selesai"]
  ];
  const notices = [
    ["inbox", "Ajuan menunggu approval pimpinan", "AJ/2025/05/00131 - Surat Izin Penelitian", "8 menit lalu", "orange"],
    ["mail", "Email institusi belum diproses", "sekretariat@sttpu.ac.id memiliki 5 email surat masuk", "22 menit lalu", "purple"],
    ["send", "Draft surat keluar siap dicek", "SK/2025/05/00076 perlu nomor surat", "1 jam lalu", "green"]
  ];

  return (
    <section className="dashboardPage">
      <div className="dashboardTitle">
        <h1>Dashboard Operator</h1>
        <p>Ringkasan monitoring ajuan, penomoran surat, surat masuk, dan surat keluar.</p>
      </div>

      <section className="dashboardStats">
        {cards.map(([label, value, meta, icon, tone, target]) => (
          <button type="button" className={`dashStat clickable ${tone}`} key={label} onClick={() => setView(target)} aria-label={`Buka ${target}`}>
            <span className="dashIcon">{iconSymbol(icon)}</span>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{meta}</small>
            </div>
            <Sparkline tone={tone} />
          </button>
        ))}
      </section>

      <section className="dashboardGrid">
        <article className="dashPanel">
          <PanelHeader title="Monitoring Ajuan Surat" action="Lihat semua" onClick={() => setView("Ajuan Masuk")} />
          <table className="dashboardTable operatorWorkTable">
            <thead><tr><th>Nomor</th><th>Jenis</th><th>Pengaju</th><th>Catatan</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {verificationRows.map((row) => (
                <tr key={row[0]}>
                  <td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td><Status text={row[4]} /></td><td><button className="viewBtn" aria-label={`Lihat detail ${row[0]}`}><LineIcon name="eye" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="dashPanel notificationsPanel">
          <PanelHeader title="Notifikasi Operator" action="Lihat semua" onClick={() => setView("Arsip")} />
          <div className="dashNoticeList">
            {notices.map(([icon, title, body, time, tone]) => (
              <div className="dashNotice" key={title}>
                <span className={`noticeIcon ${tone}`}>{iconSymbol(icon)}</span>
                <div><strong>{title}</strong><small>{body}</small></div>
                <time>{time}</time><b />
              </div>
            ))}
          </div>
        </article>

        <article className="dashPanel trendPanel">
          <PanelHeader title="Tren Proses Surat (Bulanan)" action="12 Bulan Terakhir" />
          <div className="chartLegend"><span className="blueDot" />Ajuan Masuk <span className="purpleDot" />Surat Selesai</div>
          <div className="lineChart">
            <svg viewBox="0 0 720 230" role="img" aria-label="Tren proses surat bulanan operator">
              <defs>
                <linearGradient id="operatorChartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2d73ff" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2d73ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[30, 70, 110, 150, 190].map((y) => <line x1="36" x2="700" y1={y} y2={y} key={y} />)}
              <path className="area operatorArea" d="M42 176 L94 152 L150 126 L206 116 L262 98 L318 130 L374 112 L430 104 L486 82 L542 112 L598 92 L654 60 L700 84 L700 206 L42 206 Z" />
              <polyline className="line blue" points="42,176 94,152 150,126 206,116 262,98 318,130 374,112 430,104 486,82 542,112 598,92 654,60 700,84" />
              <polyline className="line purple" points="42,198 94,174 150,150 206,136 262,120 318,148 374,138 430,124 486,106 542,130 598,116 654,88 700,102" />
              {["Jun '24", "Jul '24", "Agu '24", "Sep '24", "Okt '24", "Nov '24", "Des '24", "Jan '25", "Feb '25", "Mar '25", "Apr '25", "Mei '25"].map((label, index) => <text x={42 + index * 58} y="224" key={label}>{label}</text>)}
            </svg>
          </div>
        </article>

        <article className="dashPanel summaryPanel">
          <h3>Ringkasan Pekerjaan Operator</h3>
          <div className="summaryBody">
            <div className="donut operatorDonut"><span><strong>238</strong><small>Total</small></span></div>
            <div className="summaryRows">
              {[
                ["Ajuan Diverifikasi", "151 (63,4%)", "blue"],
                ["Surat Diteruskan", "54 (22,7%)", "purple"],
                ["Menunggu Approval", "22 (9,2%)", "orange"],
                ["Perlu Periksa", "11 (4,7%)", "gray"]
              ].map(([label, value, tone]) => <p key={label}><i className={tone} />{label}<strong>{value}</strong></p>)}
              <button className="detailLink" onClick={() => setView("Laporan")}>Lihat detail -&gt;</button>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}

function PimpinanDashboard({ setView, ajuanRequests = [] }) {
  const waitingAjuan = ajuanRequests.filter((item) => item.status === "Menunggu Approval");
  const cards = [
    ["Review Masuk", "17", "Surat perlu dibaca", "mail", "blue", "Surat Masuk"],
    ["Approval", String(waitingAjuan.length + 1), `${waitingAjuan.length} ajuan menunggu`, "check", "purple", "Approval"],
    ["Disposisi Aktif", "13", "Masih berjalan", "clipboard", "orange", "Disposisi"],
    ["Tindak Lanjut", "41", "Selesai bulan ini", "chart", "green", "Disposisi"]
  ];
  const reviewRows = [
    ["AG-2026-041", "SM/109/V/2026", "Dinas Kominfo", "Permintaan data layanan", "Perlu Review"],
    ["AG-2026-040", "SM/108/V/2026", "Bappeda", "Koordinasi program", "Perlu Review"],
    ["AG-2026-039", "SM/107/V/2026", "Inspektorat", "Jadwal audit", "Didisposisikan"],
    ["AG-2026-038", "SM/106/V/2026", "Dinas PUPR", "Permohonan narasumber", "Perlu Review"]
  ];
  const agenda = [
    ["Buat disposisi surat Kominfo", "Tentukan unit penerima arahan", "mail"],
    [waitingAjuan[0] ? `Approval ${waitingAjuan[0].nomor}` : "Approval surat edaran SOP", waitingAjuan[0] ? waitingAjuan[0].judul || waitingAjuan[0].jenis : "Cek final draft sebelum disetujui", "check"],
    ["Pantau tindak lanjut audit", "Bagian umum perlu unggah hasil", "clock"]
  ];

  return (
    <section className="dashboardPage">
      <div className="dashboardTitle">
        <h1>Dashboard Pimpinan</h1>
        <p>Ringkasan review surat, approval, disposisi, dan tindak lanjut unit kerja.</p>
      </div>

      <section className="dashboardStats">
        {cards.map(([label, value, meta, icon, tone, target]) => (
          <button type="button" className={`dashStat clickable ${tone}`} key={label} onClick={() => setView(target)} aria-label={`Buka ${target}`}>
            <span className="dashIcon">{iconSymbol(icon)}</span>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{meta}</small>
            </div>
            <Sparkline tone={tone} />
          </button>
        ))}
      </section>

      <section className="dashboardGrid">
        <article className="dashPanel">
          <PanelHeader title="Surat Masuk Perlu Review" action="Lihat semua" onClick={() => setView("Surat Masuk")} />
          <table className="dashboardTable pimpinanReviewTable">
            <thead><tr><th>Agenda</th><th>Nomor Surat</th><th>Pengirim</th><th>Perihal</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {reviewRows.map((row) => (
                <tr key={row[0]}>
                  <td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td><Status text={row[4]} /></td><td><button className="viewBtn" aria-label={`Review ${row[0]}`}><LineIcon name="eye" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="dashPanel notificationsPanel">
          <PanelHeader title="Agenda Pimpinan" action="Disposisi" onClick={() => setView("Disposisi")} />
          <div className="dashNoticeList">
            {agenda.map(([title, body, icon], index) => (
              <div className="dashNotice" key={title}>
                <span className={`noticeIcon ${index === 0 ? "orange" : index === 1 ? "green" : "purple"}`}>{iconSymbol(icon)}</span>
                <div><strong>{title}</strong><small>{body}</small></div>
                <time>Hari ini</time><b />
              </div>
            ))}
          </div>
        </article>

        <article className="dashPanel trendPanel">
          <PanelHeader title="Tren Keputusan Surat" action="12 Bulan Terakhir" />
          <div className="chartLegend"><span className="blueDot" />Review <span className="purpleDot" />Disposisi</div>
          <div className="lineChart">
            <svg viewBox="0 0 720 230" role="img" aria-label="Tren keputusan surat pimpinan">
              <defs>
                <linearGradient id="pimpinanChartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2d73ff" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2d73ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[30, 70, 110, 150, 190].map((y) => <line x1="36" x2="700" y1={y} y2={y} key={y} />)}
              <path className="area pimpinanArea" d="M42 170 L94 154 L150 132 L206 118 L262 106 L318 118 L374 92 L430 110 L486 86 L542 100 L598 78 L654 52 L700 76 L700 206 L42 206 Z" />
              <polyline className="line blue" points="42,170 94,154 150,132 206,118 262,106 318,118 374,92 430,110 486,86 542,100 598,78 654,52 700,76" />
              <polyline className="line purple" points="42,192 94,176 150,154 206,144 262,126 318,140 374,124 430,132 486,114 542,124 598,106 654,88 700,98" />
              {["Jun '24", "Jul '24", "Agu '24", "Sep '24", "Okt '24", "Nov '24", "Des '24", "Jan '25", "Feb '25", "Mar '25", "Apr '25", "Mei '25"].map((label, index) => <text x={42 + index * 58} y="224" key={label}>{label}</text>)}
            </svg>
          </div>
        </article>

        <article className="dashPanel summaryPanel">
          <h3>Ringkasan Status Disposisi</h3>
          <div className="summaryBody">
            <div className="donut pimpinanDonut"><span><strong>54</strong><small>Total</small></span></div>
            <div className="summaryRows">
              {[
                ["Dikirim", "17 (31,5%)", "blue"],
                ["Diterima", "13 (24,1%)", "purple"],
                ["Ditindaklanjuti", "15 (27,8%)", "orange"],
                ["Selesai", "9 (16,6%)", "gray"]
              ].map(([label, value, tone]) => <p key={label}><i className={tone} />{label}<strong>{value}</strong></p>)}
              <button className="detailLink" onClick={() => setView("Disposisi")}>Lihat detail -&gt;</button>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}

function AdminDashboard({ setView, userRows, auditRows, apiNotice }) {
  const cards = [
    ["Total Pengguna", String(userRows.length), `${userRows.filter((row) => String(row[4]).toLowerCase() === "aktif").length} akun aktif`, "user", "blue", "Pengguna"],
    ["Role Sistem", "5", "RBAC dasar aktif", "shield", "purple", "Pengguna"],
    ["Audit Terbaru", String(auditRows.length), "Aktivitas tercatat", "clock", "orange", "Audit Trail"],
    ["Backup", "03:00", "Terakhir berhasil", "upload", "green", "Backup"]
  ];
  const recentUsers = userRows.slice(0, 5);
  const recentAudits = auditRows.slice(0, 5);

  return (
    <section className="dashboardPage">
      <div className="dashboardTitle">
        <h1>Dashboard Administrator</h1>
        <p>Ringkasan pengguna, role, audit trail, backup, dan kesehatan sistem.</p>
        {apiNotice && <small className="fieldError">{apiNotice}</small>}
      </div>

      <section className="dashboardStats">
        {cards.map(([label, value, meta, icon, tone, target]) => (
          <button type="button" className={`dashStat clickable ${tone}`} key={label} onClick={() => setView(target)} aria-label={`Buka ${target}`}>
            <span className="dashIcon">{iconSymbol(icon)}</span>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{meta}</small>
            </div>
            <Sparkline tone={tone} />
          </button>
        ))}
      </section>

      <section className="dashboardGrid">
        <article className="dashPanel">
          <PanelHeader title="Pengguna Aktif" action="Kelola" onClick={() => setView("Pengguna")} />
          <table className="dashboardTable adminUserTable">
            <thead><tr><th>ID</th><th>Nama</th><th>Role</th><th>Unit Kerja</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {recentUsers.map(([id, name, roleName, unit, status]) => (
                <tr key={id}>
                  <td>{String(id).substring(0, 8)}</td>
                  <td>{name}</td>
                  <td>{roleName}</td>
                  <td>{unit || "-"}</td>
                  <td><Status text={status} /></td>
                  <td><button className="viewBtn" onClick={() => setView("Pengguna")} aria-label={`Detail ${name}`}><LineIcon name="eye" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="dashPanel notificationsPanel">
          <PanelHeader title="Audit Terbaru" action="Lihat semua" onClick={() => setView("Audit Trail")} />
          <div className="adminAuditList">
            {recentAudits.map(([time, actor, module, action]) => (
              <div className="adminAuditItem" key={`${time}-${action}`}>
                <span><LineIcon name="clock" /></span>
                <div><strong>{action}</strong><small>{time} - {actor} - {module}</small></div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashPanel trendPanel">
          <PanelHeader title="Aktivitas Sistem" action="7 Hari Terakhir" />
          <div className="chartLegend"><span className="blueDot" />Login <span className="purpleDot" />Perubahan Data</div>
          <div className="lineChart">
            <svg viewBox="0 0 720 230" role="img" aria-label="Tren aktivitas sistem administrator">
              <defs>
                <linearGradient id="adminChartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2d73ff" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2d73ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[30, 70, 110, 150, 190].map((y) => <line x1="36" x2="700" y1={y} y2={y} key={y} />)}
              <path className="area adminArea" d="M42 184 L120 136 L198 148 L276 94 L354 122 L432 84 L510 106 L588 62 L666 90 L700 72 L700 206 L42 206 Z" />
              <polyline className="line blue" points="42,184 120,136 198,148 276,94 354,122 432,84 510,106 588,62 666,90 700,72" />
              <polyline className="line purple" points="42,196 120,168 198,172 276,132 354,150 432,116 510,138 588,104 666,122 700,108" />
              {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((label, index) => <text x={42 + index * 105} y="224" key={label}>{label}</text>)}
            </svg>
          </div>
        </article>

        <article className="dashPanel summaryPanel">
          <h3>Status Sistem</h3>
          <div className="summaryBody">
            <div className="donut adminDonut"><span><strong>98%</strong><small>Sehat</small></span></div>
            <div className="summaryRows">
              {[
                ["Akun Aktif", "43 dari 48", "blue"],
                ["Role Terpasang", "5 role", "purple"],
                ["Backup Berhasil", "03:00 WIB", "orange"],
                ["Audit Aman", "129 log hari ini", "gray"]
              ].map(([label, value, tone]) => <p key={label}><i className={tone} />{label}<strong>{value}</strong></p>)}
              <button className="detailLink" onClick={() => setView("Backup")}>Buka backup -&gt;</button>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}

function OperatorAjuanMasuk({ setConfirm, ajuanRequests, onUpdateAjuan }) {
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedAjuan, setSelectedAjuan] = useState(null);
  const [ajuanSearch, setAjuanSearch] = useState("");
  const summary = [
    ["Menunggu Approval", String(ajuanRequests.filter((item) => getAjuanWorkflowStatus(item) === "Menunggu Approval").length), "Di portal pimpinan", "send", "purple"],
    ["Disetujui", String(ajuanRequests.filter((item) => getAjuanWorkflowStatus(item) === "Disetujui").length), "Perlu penomoran", "check", "green"],
    ["Selesai", String(ajuanRequests.filter((item) => getAjuanWorkflowStatus(item) === "Selesai").length), "Sudah bernomor", "archive", "blue"],
    ["Ditolak", String(ajuanRequests.filter((item) => getAjuanWorkflowStatus(item) === "Ditolak").length), "Ditolak pimpinan", "x", "red"]
  ];
  const rows = ajuanRequests.map((item) => [item.nomor, item.jenis, item.pemohon, item.unit, item.tanggal, getAjuanWorkflowStatus(item), item]);
  const filteredRows = rows.filter((row) => {
    const matchesStatus = statusFilter ? row[5] === statusFilter : true;
    const matchesSearch = row.join(" ").toLowerCase().includes(ajuanSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (selectedAjuan) {
    return <AjuanMasukDetail ajuan={selectedAjuan} detail={selectedAjuan[6]} onBack={() => setSelectedAjuan(null)} setConfirm={setConfirm} onUpdateAjuan={onUpdateAjuan} />;
  }

  return (
    <section className="operatorPage">
      <header className="ajuanHeader ajuanMasukHero">
        <div>
          <h1>Ajuan Masuk</h1>
          <p>Pantau aktivitas ajuan surat dan input nomor surat setelah pimpinan menyetujui serta mengunggah surat bertanda tangan.</p>
        </div>
      </header>

      <section className="ajuanStatusGrid operatorAjuanStatusGrid">
        {summary.map(([label, value, meta, icon, tone]) => (
          <button type="button" className={`ajuanStatusCard clickable ${tone}`} key={label} onClick={() => setStatusFilter(label)} aria-label={`Filter ajuan ${label}`}>
            <span className="icon3d">{iconSymbol(icon)}</span>
            <div><small>{label}</small><strong>{value}</strong><p>{meta}</p></div>
          </button>
        ))}
      </section>

      <article className="ajuanHistory">
        <div className="ajuanListHeader">
          <div>
            <h3>{statusFilter ? `Daftar Ajuan Masuk - ${statusFilter}` : "Daftar Ajuan Masuk"}</h3>
            <p>Pantau pengajuan berdasarkan status, pemohon, unit, atau jenis surat.</p>
          </div>
          <div className="ajuanListTools">
            <label className="ajuanSearchBox">
              <LineIcon name="search" />
              <input value={ajuanSearch} onChange={(event) => setAjuanSearch(event.target.value)} placeholder="Cari nama, unit, atau jenis surat..." />
            </label>
            <select value={statusFilter || ""} onChange={(event) => setStatusFilter(event.target.value || null)}>
              <option value="">Semua Status</option>
              {summary.map(([label]) => <option key={label} value={label}>{label}</option>)}
            </select>
          </div>
        </div>
        {filteredRows.length > 0 ? (
          <>
            <table className="dashboardTable ajuanHistoryTable operatorAjuanTable">
              <thead><tr><th>No</th><th>Nama Pemohon</th><th>Jenis Surat</th><th>Unit/Bagian</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={row[0]}>
                    <td>{index + 1}</td><td>{row[2]}</td><td>{row[1]}</td><td>{row[3]}</td><td>{row[4]}</td><td><Status text={row[5]} /></td>
                    <td>
                      <div className="operatorActions">
                        <button className="viewBtn edit" onClick={() => setSelectedAjuan(row)} aria-label={`Buka detail ${row[0]}`}><LineIcon name="edit" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ajuanListFooter">
              <span>Menampilkan {filteredRows.length} dari {rows.length} data</span>
              <div><button disabled>Sebelumnya</button><button className="active">1</button><button>Berikutnya</button></div>
            </div>
          </>
        ) : (
          <div className="emptyState">
            <LineIcon name="search" />
            <strong>Data ajuan tidak ditemukan</strong>
            <p>Coba ubah kata kunci pencarian atau pilih semua status.</p>
            <button className="softBtn" onClick={() => { setAjuanSearch(""); setStatusFilter(null); }}>Reset Filter</button>
          </div>
        )}
      </article>
    </section>
  );
}

function AjuanMasukDetail({ ajuan, detail, onBack, setConfirm, onUpdateAjuan }) {
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [nomor, jenis, pemohon, unit, tanggal, status] = ajuan;
  const applicantProfile = profileDirectory[pemohon] || {};
  const applicantUnit = applicantProfile.unit || unit || "-";
  const applicantName = pemohon.toUpperCase();
  const needsNumbering = status === "Disetujui" && getAjuanNomorSurat(detail) === "-";
  const hasFinalNumber = getAjuanNomorSurat(detail) !== "-";
  const requestDetail = detail || {
    nim: applicantProfile.nim || "202101891",
    nik: applicantProfile.nik || "3309190107020006",
    email: applicantProfile.email || `${pemohon.toLowerCase().replace(/\s+/g, ".")}@stt-pu.ac.id`,
    phone: applicantProfile.phone || "0812-3456-7890",
    tujuan: `Bagian ${applicantUnit} STT Pekerjaan Umum Jakarta`,
    judul: jenis,
    keterangan: `Pemohon mengajukan ${jenis.toLowerCase()} melalui portal user untuk diproses oleh operator sesuai alur administrasi e-office.`,
    lampiran: [["Dokumen_Pendukung.pdf", "320 KB", `Diunggah ${tanggal}, 16:05 WIB`]]
  };
  const displayedRequestDetail = {
    ...requestDetail,
    nim: requestDetail.nim || applicantProfile.nim || "-",
    nik: requestDetail.nik || applicantProfile.nik || "-",
    email: applicantProfile.email || requestDetail.email,
    phone: applicantProfile.phone || requestDetail.phone,
    unit: applicantUnit
  };
  const approvalAttachments = getAjuanApprovalAttachments(displayedRequestDetail);
  const finalAttachments = getAjuanFinalAttachments(displayedRequestDetail);

  return (
    <section className="requestDetailPage">
      <header className="requestDetailTop">
        <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Daftar Pengajuan</button>
        <h1>Detail Pengajuan</h1>
        <div className="requestMeta">
          <Status text={status} />
          <span />
          <div>
            <small>Tanggal Pengajuan</small>
            <strong>{tanggal} pukul 16.07</strong>
          </div>
          <b><LineIcon name="calendar" /></b>
        </div>
      </header>

      <section className="ajuanDetailGrid requestLayout">
        <div className="requestDetailMain">
          <article className="requestCard">
            <h2><LineIcon name="user" /> Informasi Pemohon</h2>
            <div className="requestInfoGrid applicantInfoGrid">
              <DetailItem icon="user" label="Nama Pemohon" value={applicantName} />
              <DetailItem icon="briefcase" label="Unit Kerja" value={displayedRequestDetail.unit} />
              <DetailItem icon="phone" label="Nomor Telepon" value={displayedRequestDetail.phone} />
            </div>
          </article>

          <article className="requestCard">
            <h2><span className="titleIconBox"><LineIcon name="clipboard" /></span> Detail Pengajuan</h2>
            <div className="requestRows requestSubmissionGrid">
              <DetailItem icon="info" label="Nomor Ajuan" value={nomor} />
              <DetailItem icon="doc" label="Nomor Surat" value={getAjuanNomorSurat(displayedRequestDetail)} />
              <DetailItem icon="info" label="Jenis Surat" value={jenis} />
              <DetailItem icon="bank" label="Tujuan" value={displayedRequestDetail.tujuan} />
              <DetailItem icon="edit" label="Judul Surat" value={displayedRequestDetail.judul} />
              <div className="detailItem wide description">
                <LineIcon name="clipboard" />
                <span>Keterangan Pemohon</span>
                <strong>{displayedRequestDetail.keterangan}</strong>
              </div>
            </div>
          </article>

          {requestDetail.catatanPimpinan && status === "Ditolak" && (
            <article className="requestCard rejectedDecisionCard">
              <h2><LineIcon name="x" /> Catatan Penolakan Pimpinan</h2>
              <div className="requestMessage">
                <LineIcon name="info" />
                <div>
                  <h3>{requestDetail.diputuskanOleh || "Pimpinan"} menolak pengajuan ini</h3>
                  <p>{requestDetail.catatanPimpinan}</p>
                  {requestDetail.diputuskanPada && <small>Diputuskan pada {requestDetail.diputuskanPada}</small>}
                </div>
              </div>
            </article>
          )}

          {approvalAttachments.length > 0 && (
            <article className="requestCard">
              <h2><LineIcon name="check" /> Dokumen Approval Pimpinan</h2>
              {requestDetail.catatanPimpinan && (
                <div className="requestMessage">
                  <LineIcon name="info" />
                  <div>
                    <h3>Catatan Approval</h3>
                    <p>{requestDetail.catatanPimpinan}</p>
                    {requestDetail.diputuskanPada && <small>Disetujui pada {requestDetail.diputuskanPada}</small>}
                  </div>
                </div>
              )}
              <div className="attachmentList">
                {approvalAttachments.map((attachment) => {
                  const [name, size, meta] = attachment;
                  return (
                    <div className="requestAttachment" key={name}>
                      <span><LineIcon name="doc" /></span>
                      <div>
                        <strong>{name}</strong>
                        <small>{size} - {meta}</small>
                      </div>
                      <div className="requestAttachmentActions">
                        <button type="button" className="softBtn" onClick={() => setPreviewAttachment(attachment)}><LineIcon name="eye" /> Pratinjau</button>
                        <button type="button" className="primaryBtn" onClick={() => downloadAttachment(attachment, requestDetail)}><LineIcon name="upload" /> Unduh</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          )}

          <article className="requestCard">
            <h2><LineIcon name="upload" /> Lampiran Dokumen</h2>
            <div className="attachmentList">
              {requestDetail.lampiran.map((attachment) => {
                const [name, size, meta] = attachment;
                return (
                <div className="requestAttachment" key={name}>
                  <span><LineIcon name="doc" /></span>
                  <div>
                    <strong>{name}</strong>
                    <small>{size} - {meta}</small>
                  </div>
                  <div className="requestAttachmentActions">
                    <button type="button" className="softBtn" onClick={() => setPreviewAttachment(attachment)}><LineIcon name="eye" /> Pratinjau</button>
                    <button type="button" className="primaryBtn" onClick={() => downloadAttachment(attachment, requestDetail)}><LineIcon name="upload" /> Unduh</button>
                  </div>
                </div>
                );
              })}
            </div>
          </article>

          {finalAttachments.length > 0 && (
            <article className="requestCard">
              <h2><LineIcon name="check" /> Dokumen Final Operator</h2>
              <div className="attachmentList">
                {finalAttachments.map((attachment) => {
                  const [name, size, meta] = attachment;
                  return (
                    <div className="requestAttachment" key={name}>
                      <span><LineIcon name="doc" /></span>
                      <div>
                        <strong>{name}</strong>
                        <small>{size} - {meta}</small>
                      </div>
                      <div className="requestAttachmentActions">
                        <button type="button" className="softBtn" onClick={() => setPreviewAttachment(attachment)}><LineIcon name="eye" /> Pratinjau</button>
                        <button type="button" className="primaryBtn" onClick={() => downloadAttachment(attachment, requestDetail)}><LineIcon name="upload" /> Unduh</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          )}
        </div>

        <aside className="requestSide">
          {needsNumbering ? (
            <OperatorFinalNumberPanel nomor={nomor} detail={requestDetail} setConfirm={setConfirm} onSubmitFinal={onUpdateAjuan} onSent={onBack} />
          ) : hasFinalNumber ? (
            <article className="requestActionCard verificationActive">
              <h2><LineIcon name="check" /> Ajuan Selesai</h2>
              <p>Nomor surat sudah diberikan operator dan tersinkron ke portal user.</p>
              <div className="revisionNotice"><LineIcon name="info" /><span>Nomor Surat: {getAjuanNomorSurat(requestDetail)}</span></div>
            </article>
          ) : (
          <article className="requestActionCard verificationActive">
            <h2><LineIcon name="clock" /> Monitoring Ajuan</h2>
            <p>Approval dilakukan di portal pimpinan. Operator hanya memantau aktivitas dan menginput nomor surat setelah surat disetujui serta ditandatangani pimpinan.</p>
            <div className="dispositionFlow">
              {[
                ["Dikirim user", true],
                ["Approval pimpinan", ["Menunggu Approval", "Disetujui", "Selesai", "Ditolak"].includes(status)],
                ["Tanda tangan dan upload surat", ["Disetujui", "Selesai"].includes(status)],
                ["Input nomor surat", status === "Selesai"]
              ].map(([label, active], index) => (
                <p key={label} className={active ? "active" : ""}><b>{index + 1}</b>{label}</p>
              ))}
            </div>
          </article>
          )}

        </aside>
      </section>
      {previewAttachment && <AttachmentPreviewModal attachment={previewAttachment} detail={requestDetail} onClose={() => setPreviewAttachment(null)} />}
    </section>
  );
}

function OperatorFinalNumberPanel({ nomor, detail, setConfirm, onSubmitFinal, onSent }) {
  const [nomorSurat, setNomorSurat] = useState(detail.nomorSuratFinal || "");
  const [errors, setErrors] = useState({});

  async function submitFinalNumbering(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const finalFile = form.get("finalDocument");
    const trimmedNumber = nomorSurat.trim();
    const nextErrors = {};
    if (!trimmedNumber) nextErrors.nomorSurat = "Nomor surat wajib diisi untuk keabsahan surat.";
    const fileError = finalFile?.name ? validateUploadFile(finalFile) : "Upload dokumen final wajib diisi.";
    if (fileError) nextErrors.file = fileError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const uploadedAt = new Date().toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta"
    });
    const uploadedDataUrl = await readFileAsDataUrl(finalFile);
    const attachmentKey = makeAttachmentKey("operator-final", nomor, finalFile);
    await saveAttachmentPayload(attachmentKey, uploadedDataUrl);
    const finalAttachment = [
      finalFile.name,
      formatFileSize(finalFile.size),
      `Diunggah operator ${uploadedAt}`,
      uploadedDataUrl,
      finalFile.type,
      attachmentKey
    ];

    setConfirm({
      title: "Simpan nomor surat?",
      body: `${nomor} akan diberi nomor surat ${trimmedNumber}. Dokumen final ${finalFile.name} tersimpan dan status ajuan menjadi Selesai.`,
      onConfirm: () => {
        onSubmitFinal?.(nomor, {
          ...detail,
          status: "Selesai",
          nomorSuratFinal: trimmedNumber,
          suratFinalOperator: finalAttachment,
          lampiranFinal: [finalAttachment],
          dinomoriOleh: "Rina Operator",
          dinomoriPada: new Date().toLocaleString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })
        });
        onSent?.();
      }
    });
  }

  return (
    <article className="requestActionCard verificationActive numberingCard">
      <h2 className="numberingTitle"><span><LineIcon name="doc" /></span> Penomoran Surat</h2>
      <p>Surat sudah disetujui pimpinan. Operator menginput nomor surat dan mengunggah dokumen final agar tersinkron ke portal user.</p>
      <form className="verificationFields operatorFinalForm" onSubmit={submitFinalNumbering}>
        <label>
          <span className="fieldLabelInline">Nomor Surat <span className="requiredMark">*</span></span>
          <input
            type="text"
            value={nomorSurat}
            onChange={(event) => setNomorSurat(event.target.value)}
            placeholder="Contoh: 001/STT-PU/VI/2026"
          />
          {errors.nomorSurat && <small className="fieldError">{errors.nomorSurat}</small>}
        </label>
        <UploadDropzone label={<>Upload Dokumen <span className="uploadRequiredMark">*</span></>} name="finalDocument" accept=".pdf,application/pdf" formats="PDF. Maksimal 10 MB." />
        <div className="numberingNotice">
          <LineIcon name="info" />
          <span>Dokumen final yang diunggah operator akan menjadi file utama di portal user dan arsip.</span>
          {errors.file && <small className="fieldError">{errors.file}</small>}
        </div>
        <button type="submit" className="primaryBtn"><LineIcon name="check" /> Simpan Nomor Surat</button>
      </form>
    </article>
  );
}

function RevisionRequestPanel({ nomor, pemohon, setConfirm, onCancel, onLock, onSubmitRevision, onSent }) {
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("Lampiran belum lengkap");
  const [customCategory, setCustomCategory] = useState("");
  const [error, setError] = useState("");

  function submitRevision(event) {
    event.preventDefault();
    const trimmedNote = note.trim();
    const finalCategory = category === "Lainnya" ? customCategory.trim() : category;
    if (!finalCategory) {
      setError("Kategori lainnya wajib diisi agar alasan revisi jelas.");
      return;
    }
    if (!trimmedNote) {
      setError("Catatan revisi wajib diisi agar pemohon tahu bagian yang perlu diperbaiki.");
      return;
    }
    setError("");
    setConfirm({
      title: "Kirim permintaan revisi?",
      body: `${nomor} akan dikembalikan ke ${pemohon} dengan kategori "${finalCategory}" dan catatan revisi: ${trimmedNote}`,
      onConfirm: () => {
        onLock?.();
        onSubmitRevision?.(nomor, {
          status: "Perlu Revisi",
          kategoriRevisi: finalCategory,
          catatanOperator: trimmedNote,
          direvisiOleh: "Rina Operator",
          direvisiPada: new Date().toLocaleString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })
        });
        onCancel();
        onSent?.();
      }
    });
  }

  return (
    <form className="revisionRequestPanel" onSubmit={submitRevision}>
      <div className="verificationStepper" aria-label="Tahapan permintaan revisi">
        {["Pilih Masalah", "Tulis Catatan", "Kirim Revisi"].map((step, index) => (
          <span className={index === 1 ? "active" : ""} key={step}><b>{index + 1}</b>{step}</span>
        ))}
      </div>

      <div className="verificationFields">
        <label>
          Kategori Revisi
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Lampiran belum lengkap</option>
            <option>Data pemohon perlu diperbaiki</option>
            <option>Tujuan atau perihal belum jelas</option>
            <option>Format dokumen tidak sesuai</option>
            <option>Lainnya</option>
          </select>
        </label>
        {category === "Lainnya" && (
          <label>
            Kategori Lainnya <span>*</span>
            <input
              value={customCategory}
              onChange={(event) => setCustomCategory(event.target.value)}
              placeholder="Tuliskan kategori revisi lainnya"
            />
          </label>
        )}
        <label>
          Catatan untuk Pemohon
          <textarea
            rows={5}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Contoh: Mohon unggah ulang proposal penelitian yang sudah ditandatangani prodi."
          />
          {error && <small className="fieldError">{error}</small>}
        </label>
      </div>

      <div className="revisionNotice">
        <LineIcon name="info" />
        <span>Pemohon akan menerima notifikasi internal dan status ajuan berubah menjadi Perlu Revisi.</span>
      </div>

      <div className="verificationActions">
        <button type="button" className="ghostBtn" onClick={onCancel}>Batal</button>
        <button type="submit" className="primaryBtn"><LineIcon name="refresh" /> Kirim Revisi</button>
      </div>
    </form>
  );
}

function RejectRequestPanel({ nomor, pemohon, setConfirm, onCancel, onLock, onSubmitReject, onSent }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function submitReject(event) {
    event.preventDefault();
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setError("Catatan penolakan wajib diisi agar pemohon tahu alasan pengajuan ditolak.");
      return;
    }
    setError("");
    setConfirm({
      title: "Tolak pengajuan?",
      body: `${nomor} akan ditolak dan dikembalikan ke ${pemohon} dengan catatan: ${trimmedNote}`,
      onConfirm: () => {
        onLock?.();
        onSubmitReject?.(nomor, {
          status: "Ditolak",
          catatanOperator: trimmedNote,
          kategoriRevisi: "Ditolak operator",
          diputuskanOleh: "Rina Operator",
          diputuskanPada: new Date().toLocaleString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })
        });
        onCancel();
        onSent?.();
      }
    });
  }

  return (
    <form className="revisionRequestPanel" onSubmit={submitReject}>
      <div className="verificationStepper" aria-label="Tahapan penolakan pengajuan">
        {["Tulis Catatan", "Konfirmasi", "Kirim ke Pemohon"].map((step, index) => (
          <span className={index === 0 ? "active" : ""} key={step}><b>{index + 1}</b>{step}</span>
        ))}
      </div>

      <div className="verificationFields">
        <label>
          Catatan untuk Pemohon
          <textarea
            rows={5}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Contoh: Pengajuan ditolak karena tujuan surat tidak sesuai dengan kewenangan unit."
          />
          {error && <small className="fieldError">{error}</small>}
        </label>
      </div>

      <div className="revisionNotice rejectNotice">
        <LineIcon name="info" />
        <span>Catatan ini akan tampil di portal user sebagai alasan penolakan pengajuan.</span>
      </div>

      <div className="verificationActions">
        <button type="button" className="ghostBtn" onClick={onCancel}>Batal</button>
        <button type="submit" className="dangerBtn"><LineIcon name="x" /> Tolak Pengajuan</button>
      </div>
    </form>
  );
}

function VerificationProcessPanel({ nomor, pemohon, setConfirm, onCancel, onSubmitInspection, onLock, onSent }) {
  const [inspectionResult, setInspectionResult] = useState("valid");
  const checklist = [
    ["Detail Pengajuan", "Jenis surat, tujuan, kategori, dan kebutuhan pengajuan sudah jelas."]
  ];
  const resultLabels = {
    valid: "Data lengkap dan valid",
    review: "Perlu pemeriksaan lanjutan"
  };
  const nextStatus = inspectionResult === "valid" ? "Menunggu Approval" : "Perlu Verifikasi";

  function sendInspectionResult() {
    setConfirm({
      title: "Kirim hasil pemeriksaan?",
      body: inspectionResult === "valid"
        ? `${nomor} akan diteruskan ke portal pimpinan untuk approval.`
        : `${nomor} tetap di portal operator dengan hasil: ${resultLabels[inspectionResult]}.`,
      onConfirm: () => {
        onLock?.();
        onSubmitInspection?.(nomor, {
          status: nextStatus,
          hasilPemeriksaan: resultLabels[inspectionResult],
          diteruskanKe: inspectionResult === "valid" ? "Dewi Pimpinan" : "",
          diperiksaOleh: "Rina Operator",
          diperiksaPada: new Date().toLocaleString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })
        });
        onSent?.();
      }
    });
  }

  return (
    <div className="verificationProcess">
      <div className="verificationStepper" aria-label="Tahapan proses verifikasi">
        {["Periksa Data", "Validasi Dokumen", "Kirim Proses"].map((step, index) => (
          <span className={index === 0 ? "active" : ""} key={step}><b>{index + 1}</b>{step}</span>
        ))}
      </div>

      <div className="verificationChecklist">
        <h3>Pemeriksaan Kelengkapan</h3>
        {checklist.map(([title, body]) => (
          <label key={title}>
            <input type="checkbox" />
            <span><strong>{title}</strong><small>{body}</small></span>
          </label>
        ))}
      </div>

      <div className="verificationFields">
        <label>
          Hasil Pemeriksaan
          <select value={inspectionResult} onChange={(event) => setInspectionResult(event.target.value)}>
            <option value="valid">Data lengkap dan valid</option>
            <option value="review">Perlu pemeriksaan lanjutan</option>
          </select>
        </label>
      </div>

      <div className="verificationActions">
        <button type="button" className="ghostBtn" onClick={onCancel}>Batal</button>
        <button type="button" className="primaryBtn" onClick={sendInspectionResult}><LineIcon name="check" /> Kirim Proses</button>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value, wide = false }) {
  return (
    <div className={`detailItem${wide ? " wide" : ""}`}>
      {icon && <LineIcon name={icon} />}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function validateUploadFile(file) {
  if (!file?.name) return "";
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext !== "pdf") return "Format file harus PDF.";
  if (file.type && file.type !== "application/pdf") return "Tipe file harus application/pdf.";
  if (file.size > 10 * 1024 * 1024) return "Ukuran file maksimal 10 MB.";
  return "";
}

function formatFileSize(size) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getAttachmentExt(name) {
  return String(name || "").split(".").pop().toLowerCase();
}

function getAttachmentMime(name, fallback = "") {
  const ext = getAttachmentExt(name);
  const types = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png"
  };
  return fallback || types[ext] || "application/octet-stream";
}

function downloadDataUrl(filename, dataUrl) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function buildAttachmentPlaceholder(attachment, detail) {
  const [name, size, meta] = attachment;
  const lines = [
    `Nama file: ${name}`,
    `Ukuran: ${size}`,
    `Info upload: ${meta}`,
    `Judul ajuan: ${detail.judul || "-"}`,
    `Tujuan: ${detail.tujuan || "-"}`,
    "",
    detail.keterangan || "Dokumen lampiran pengajuan surat."
  ];
  const ext = getAttachmentExt(name);
  if (ext === "pdf") return { content: createSimplePdf("Pratinjau Lampiran Ajuan", lines), type: "application/pdf" };
  if (["xls", "xlsx"].includes(ext)) {
    const rows = [["Field", "Nilai"], ["Nama file", name], ["Ukuran", size], ["Info upload", meta], ["Judul", detail.judul || "-"], ["Tujuan", detail.tujuan || "-"]];
    const html = `<html><head><meta charset="utf-8" /></head><body><table border="1">${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
    return { content: html, type: "application/vnd.ms-excel;charset=utf-8" };
  }
  const html = `<html><head><meta charset="utf-8" /></head><body><h2>Pratinjau Lampiran Ajuan</h2>${lines.map((line) => `<p>${escapeHtml(line || " ")}</p>`).join("")}</body></html>`;
  return { content: html, type: "application/msword;charset=utf-8" };
}

function downloadAttachment(attachment, detail) {
  const [name, , , dataUrl] = attachment;
  if (dataUrl) {
    downloadDataUrl(name, dataUrl);
    return;
  }
  const placeholder = buildAttachmentPlaceholder(attachment, detail);
  downloadBlob(name, placeholder.content, placeholder.type);
}

function createDataUrl(content, type) {
  if (typeof window !== "undefined" && window.btoa) {
    return `data:${type};base64,${window.btoa(content)}`;
  }
  if (typeof Buffer !== "undefined") {
    return `data:${type};base64,${Buffer.from(content, "binary").toString("base64")}`;
  }
  return "";
}

function safeFilename(value) {
  return String(value || "dokumen")
    .replace(/[^a-z0-9._-]+/gi, "_")
    .replace(/^_+|_+$/g, "");
}

function createLetterDocumentAttachment(spec) {
  const title = spec.title || "Dokumen Surat";
  const filename = safeFilename(spec.filename || `${title}.pdf`);
  const lines = [
    `Nomor: ${spec.number || "-"}`,
    `Jenis: ${spec.kind || "-"}`,
    `Perihal: ${spec.subject || "-"}`,
    `Pihak terkait: ${spec.party || "-"}`,
    `Status: ${spec.status || "-"}`,
    "",
    spec.summary || "Dokumen surat dibuat dari data e-office."
  ];
  const pdf = createSimplePdf(title, lines);
  return [filename, formatFileSize(new Blob([pdf]).size), spec.meta || "Dibuat otomatis oleh sistem", createDataUrl(pdf, "application/pdf"), "application/pdf"];
}

function previewLetterDocument(spec, setPreviewDocument) {
  if (spec.attachment) {
    setPreviewDocument(spec.attachment);
    return;
  }
  setPreviewDocument(createLetterDocumentAttachment(spec));
}

function downloadLetterDocument(spec) {
  if (spec.attachment) {
    downloadAttachment(spec.attachment, {
      judul: spec.title,
      tujuan: spec.party,
      keterangan: spec.summary
    });
    return;
  }
  downloadAttachment(createLetterDocumentAttachment(spec), {
    judul: spec.title,
    tujuan: spec.party,
    keterangan: spec.summary
  });
}

function DocumentOpenButtons({ spec, onPreview, compact = false }) {
  return (
    <div className={compact ? "documentOpenActions compact" : "documentOpenActions"}>
      <button type="button" className="softBtn" onClick={() => previewLetterDocument(spec, onPreview)}><LineIcon name="eye" /> Pratinjau</button>
      <button type="button" className="primaryBtn" onClick={() => downloadLetterDocument(spec)}><LineIcon name="upload" /> Unduh</button>
    </div>
  );
}

function incomingDocumentSpec(detail, attachment) {
  const [name, , meta] = attachment || [];
  return {
    title: "Surat Masuk",
    filename: name || `${detail.agenda || detail.nomorSurat || "surat_masuk"}.pdf`,
    number: detail.nomorSurat || detail.agenda,
    kind: "Surat Masuk",
    subject: detail.perihal,
    party: detail.pengirim,
    status: detail.status,
    summary: detail.ringkasan,
    meta
  };
}

function formatIncomingEmailDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function outgoingDocumentSpec(detail, attachment) {
  const [name, , meta] = attachment || [];
  return {
    title: detail.jenis || "Surat Keluar",
    filename: name || `${detail.nomor || "surat_keluar"}.pdf`,
    number: detail.nomor,
    kind: detail.jenis,
    subject: detail.perihal,
    party: detail.penerima || detail.tujuan,
    status: detail.status,
    summary: detail.ringkasan,
    meta,
    attachment
  };
}

function AttachmentPreviewModal({ attachment, detail, onClose }) {
  const [name, size, meta, dataUrl, mime] = attachment;
  const type = getAttachmentMime(name, mime);
  const isPdf = type.includes("pdf");
  const isImage = type.startsWith("image/");
  const showUploadedPdf = dataUrl && isPdf;
  const showLetterPreview = !dataUrl && isPdf && hasLetterPreviewDetail(detail);

  return (
    <div className="modalBackdrop" role="presentation" onClick={onClose}>
      <section className="modal attachmentPreviewModal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="attachmentPreviewHeader">
          <div>
            <h3>Pratinjau Dokumen</h3>
            <p>{name} - {size} - {meta}</p>
          </div>
          <button type="button" className="iconBtn" onClick={onClose} aria-label="Tutup pratinjau"><LineIcon name="x" /></button>
        </div>
        <div className="attachmentPreviewBody">
          {showUploadedPdf && <iframe title={`Pratinjau ${name}`} src={dataUrl} />}
          {showLetterPreview && <LetterPreviewSheet detail={detail} attachment={attachment} />}
          {dataUrl && isImage && <img src={dataUrl} alt={`Pratinjau ${name}`} />}
          {!showUploadedPdf && !showLetterPreview && (!dataUrl || (!isPdf && !isImage)) && (
            <div className="attachmentPreviewSheet">
              <small>{getAttachmentExt(name).toUpperCase() || "PDF"}</small>
              <h4>{detail.judul || name}</h4>
              <p>{detail.keterangan || "Lampiran ajuan surat siap diperiksa oleh operator."}</p>
              <div className="docLines"><i /><i /><i /><i /></div>
              <span>Preview penuh tersedia untuk PDF dan gambar. File ini tetap bisa diunduh.</span>
            </div>
          )}
        </div>
        <div className="actions end">
          <button type="button" className="ghostBtn" onClick={onClose}>Tutup</button>
          <button type="button" className="primaryBtn" onClick={() => downloadAttachment(attachment, detail)}><LineIcon name="upload" /> Unduh</button>
        </div>
      </section>
    </div>
  );
}

function hasLetterPreviewDetail(detail) {
  if (!detail) return false;
  return Boolean(
    detail.nomor ||
    detail.jenis ||
    detail.judul ||
    detail.perihal ||
    detail.pemohon ||
    detail.penerima ||
    detail.tujuan ||
    detail.keterangan ||
    detail.ringkasan
  );
}

function getLetterPreviewValue(value, fallback = "-") {
  return value ? String(value) : fallback;
}

function LetterPreviewSheet({ detail, attachment }) {
  const [name, , meta] = attachment;
  const subject = detail.judul || detail.perihal || detail.ringkasan || "Ajuan surat";
  const recipient = detail.tujuan || detail.penerima || detail.pengirim || "Pihak terkait";
  const applicant = detail.pemohon || detail.dibuatOleh || detail.operator || "Operator";
  const body = detail.keterangan || detail.ringkasan || `Mohon persetujuan atas ${subject.toLowerCase()} sesuai dokumen yang diajukan.`;
  const letterRows = [
    ["Nomor Ajuan", detail.nomor || detail.nomorSurat || detail.agenda],
    ["Jenis Surat", detail.jenis || "Surat"],
    ["Tanggal", detail.tanggal],
    ["Pemohon/Operator", applicant],
    ["Unit", detail.unit],
    ["Tujuan", recipient]
  ].filter(([, value]) => value);

  return (
    <article className="letterPreviewSheet">
      <header className="letterPreviewKop">
        <strong>E-Office Persuratan</strong>
        <span>STT Pekerjaan Umum Jakarta</span>
        <small>Ringkasan dokumen upload operator ketika PDF asli belum tersedia untuk pratinjau</small>
      </header>
      <section className="letterPreviewMeta">
        {letterRows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <b>{getLetterPreviewValue(value)}</b>
          </div>
        ))}
      </section>
      <section className="letterPreviewContent">
        <p>Kepada Yth.</p>
        <h4>{recipient}</h4>
        <p className="letterPreviewSubject">Perihal: {subject}</p>
        <p>Dengan hormat,</p>
        <p>{body}</p>
        <p>Dokumen ini diajukan melalui sistem E-Office untuk diperiksa dan diputuskan oleh pimpinan. Lampiran asli tetap tersedia melalui tombol unduh.</p>
      </section>
      <footer className="letterPreviewFooter">
        <div>
          <span>Dokumen</span>
          <b>{name}</b>
          <small>{meta}</small>
        </div>
        <div className="letterPreviewSign">
          <span>Jakarta, {detail.tanggal || new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
          <b>Pimpinan</b>
          <i />
          <strong>Dewi Pimpinan</strong>
        </div>
      </footer>
    </article>
  );
}

function UploadDropzone({ label, name, accept, formats }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return undefined;
    function handleFormReset() {
      setSelectedFile(null);
      setUploadError("");
    }
    form.addEventListener("reset", handleFormReset);
    return () => form.removeEventListener("reset", handleFormReset);
  }, []);

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    const nextError = validateUploadFile(file);
    setUploadError(nextError);
    setSelectedFile(nextError ? null : file);
    if (nextError) event.target.value = "";
  }

  return (
    <label className={selectedFile ? "uploadDropzone hasFile" : "uploadDropzone"}>
      {label && <strong className="uploadDropzoneLabel">{label}</strong>}
      <input ref={inputRef} name={name} type="file" accept={accept} onChange={handleFileChange} />
      <span><LineIcon name="upload" /></span>
      <b>{selectedFile ? selectedFile.name : "Klik untuk unggah dokumen"}</b>
      <small>{selectedFile ? `${formatFileSize(selectedFile.size)} - siap diunggah` : formats}</small>
      {uploadError && <em className="uploadError">{uploadError}</em>}
    </label>
  );
}

function IncomingLetterForm({ role, setConfirm }) {
  const [emailSyncing, setEmailSyncing] = useState(false);
  const [processingEmailId, setProcessingEmailId] = useState("");
  const [savingIncoming, setSavingIncoming] = useState("");
  const [incomingMode, setIncomingMode] = useState("dashboard");
  const [emailRows, setEmailRows] = useState([
    {
      id: "email-demo-1",
      agenda: "EMAIL/2026/06/000124",
      letterNumber: "SM/124/VI/2026",
      sender: "sekretariat@sttpu.ac.id",
      subject: "Permintaan data layanan akademik",
      receivedAt: "2026-06-02T09:18:00+07:00",
      status: "Diregistrasi",
      attachments: [{ filename: "surat-permintaan-data.pdf", size: 684000, contentType: "application/pdf" }]
    },
    {
      id: "email-demo-2",
      agenda: "EMAIL/2026/06/000123",
      letterNumber: "SM/123/VI/2026",
      sender: "dinas.pupr@example.go.id",
      subject: "Undangan rapat koordinasi infrastruktur",
      receivedAt: "2026-06-02T08:42:00+07:00",
      status: "Diregistrasi",
      attachments: [{ filename: "undangan-rapat-koordinasi.pdf", size: 512000, contentType: "application/pdf" }]
    },
    {
      id: "email-demo-3",
      agenda: "EMAIL/2026/06/000122",
      letterNumber: "SM/122/VI/2026",
      sender: "bappeda@example.go.id",
      subject: "Koordinasi program kerja sama kampus",
      receivedAt: "2026-06-01T14:05:00+07:00",
      status: "Diteruskan",
      attachments: [{ filename: "koordinasi-program.pdf", size: 438000, contentType: "application/pdf" }]
    }
  ]);
  const [emailLoading, setEmailLoading] = useState(false);
  useEffect(() => {
    if (role !== "Pimpinan" && incomingMode === "email" && getStoredToken() && !isDummyToken()) {
      loadEmailIncoming();
    }
  }, [role, incomingMode]);
  if (role === "Pimpinan") return <PimpinanIncomingReview setConfirm={setConfirm} />;

  const recipients = ["Waket I", "Waket II", "Waket III", "Prodi TS", "Prodi TI", "Prodi TL", "Unit LPPM", "Unit LPMI"];
  const instructions = ["Untuk diketahui", "Teliti dan proses lebih lanjut", "Bicarakan dengan saya", "Minta pendapat saudari", "Siapkan jawaban", "Setuju"];

  async function saveIncomingLetter(event, intent) {
    const form = event.currentTarget.form;
    if (!form) return;
    const formData = new FormData(form);
    const file = formData.get("document");
    const fileError = file?.name ? validateUploadFile(file) : "";
    if (fileError) {
      setConfirm({ title: "Dokumen belum valid", body: fileError });
      return;
    }

    const agendaNumber = String(formData.get("agendaNumber") || "").trim() || `AG-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const payload = {
      agendaNumber,
      letterNumber: String(formData.get("letterNumber") || "").trim(),
      letterDate: String(formData.get("letterDate") || "").trim(),
      receivedDate: String(formData.get("receivedDate") || "").trim(),
      sender: String(formData.get("sender") || "").trim(),
      subject: String(formData.get("subject") || "").trim(),
      summary: String(formData.get("summary") || "").trim(),
      followUp: String(formData.get("followUp") || "").trim(),
      followUpTo: String(formData.get("followUpTo") || "").trim(),
      recipients: formData.getAll("recipients"),
      instructions: formData.getAll("instructions"),
      leaderTargets: formData.getAll("leaderTargets"),
      document: file?.name ? {
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: await readFileAsDataUrl(file)
      } : null
    };

    const missingFields = [];
    if (!payload.letterNumber) missingFields.push("No. surat");
    if (!payload.letterDate) missingFields.push("Tanggal surat");
    if (!payload.receivedDate) missingFields.push("Tanggal terima");
    if (!payload.sender) missingFields.push("Dari");
    if (!payload.subject) missingFields.push("Perihal");
    if (missingFields.length) {
      setConfirm({ title: "Data belum lengkap", body: `${missingFields.join(", ")} wajib diisi sebelum surat disimpan.` });
      return;
    }

    const isForward = intent === "forward";
    setSavingIncoming(intent);
    try {
      if (getStoredToken() && !isDummyToken()) {
        const createPayload = await apiFetch("/incoming-letters", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (isForward) {
          await apiFetch(`/incoming-letters/${createPayload.data.id}/forward`, {
            method: "POST",
            body: JSON.stringify({ leaderTargets: payload.leaderTargets })
          });
        }
      } else {
        const existingRows = readLocalJson(LOCAL_INCOMING_KEY, []);
        writeLocalJson(LOCAL_INCOMING_KEY, [{
          ...payload,
          id: `local-incoming-${Date.now()}`,
          status: isForward ? "Diteruskan" : "Diregistrasi",
          createdAt: new Date().toISOString()
        }, ...existingRows]);
      }
      form.reset();
      form.dispatchEvent(new Event("reset", { bubbles: true }));
      setConfirm({
        title: "Surat diteruskan",
        body: `${agendaNumber} tersimpan, status menjadi diteruskan, dan notifikasi pimpinan dibuat.`
      });
    } catch (error) {
      setConfirm({ title: "Gagal menyimpan surat masuk", body: error.message || "Silakan coba lagi." });
    } finally {
      setSavingIncoming("");
    }
  }

  async function ensureBackendOperatorSession() {
    if (getStoredToken() && !isDummyToken()) return;
    await loginBackendSession("operator", "operator123");
  }

  async function syncIncomingEmail() {
    setEmailSyncing(true);
    try {
      await ensureBackendOperatorSession();
      const payload = await apiFetch("/email/sync-incoming", { method: "POST" });
      const synced = payload.data?.synced?.length || 0;
      const skipped = payload.data?.skipped?.length || 0;
      await loadEmailIncoming();
      setConfirm({
        title: "Sinkron email selesai",
        body: `${synced} email baru masuk ke Surat Masuk. ${skipped} email sudah pernah tersinkron dan dilewati.`
      });
    } catch (error) {
      setConfirm({ title: "Sinkron email gagal", body: error.message });
    } finally {
      setEmailSyncing(false);
    }
  }

  async function loadEmailIncoming() {
    if (!getStoredToken() || isDummyToken()) return;
    setEmailLoading(true);
    try {
      const payload = await apiFetch("/email/incoming");
      if (payload.data?.length) setEmailRows(payload.data);
    } catch (error) {
      setConfirm({ title: "Gagal memuat email masuk", body: error.message });
    } finally {
      setEmailLoading(false);
    }
  }

  async function processEmailAsIncomingLetter(row) {
    if (row.processStatus === "sudah_diproses") {
      setConfirm({
        title: "Email sudah diproses",
        body: `${row.subject} sudah memiliki nomor agenda ${row.agenda || "surat masuk"}.`
      });
      return;
    }

    setConfirm({
      title: "Proses email sebagai surat masuk?",
      body: `${row.subject} akan dibuat menjadi surat masuk, lampiran email disimpan sebagai dokumen, dan aktivitas dicatat di audit trail.`,
      onConfirm: async () => {
        setProcessingEmailId(row.id);
        try {
          await ensureBackendOperatorSession();
          const payload = await apiFetch(`/email/incoming/${row.id}/process`, { method: "POST" });
          await loadEmailIncoming();
          setConfirm({
            title: "Email berhasil diproses",
            body: `Nomor agenda ${payload.data?.incomingLetter?.agenda_number || payload.data?.incomingLetter?.agenda || "-"} berhasil dibuat dari email.`
          });
        } catch (error) {
          setConfirm({ title: "Gagal memproses email", body: error.message });
        } finally {
          setProcessingEmailId("");
        }
      }
    });
  }

  if (incomingMode === "dashboard") {
    const incomingRows = [
      ["SM/2025/05/0124", "PT Cipta Karya", "Permohonan Kerja Sama", "22 Mei 2025", "Bagian Akademik", "Baru"],
      ["SM/2025/05/0123", "Dinas PU Jakarta", "Undangan Rapat Koordinasi", "21 Mei 2025", "Pimpinan", "Diteruskan"],
      ["SM/2025/05/0122", "Universitas X", "Permintaan Data Penelitian", "21 Mei 2025", "Bagian Administrasi", "Diproses"],
      ["SM/2025/05/0121", "CV Maju Jaya", "Surat Penawaran", "20 Mei 2025", "Bagian Umum", "Selesai"]
    ];
    const incomingStats = [
      ["Total Surat Masuk", "124", "mail", "blue"],
      ["Belum Diproses", "7", "clipboard", "orange"],
      ["Sudah Diteruskan", "98", "send", "green"],
      ["Hari Ini", "11", "calendar", "purple"]
    ];
    const guideItems = [
      "Catat nomor agenda dan tanggal masuk.",
      "Isi asal surat dan perihal dengan lengkap.",
      "Tentukan tujuan/bagian penerima internal.",
      "Lanjutkan ke pimpinan bila memerlukan disposisi.",
      "Arsipkan surat setelah selesai diproses."
    ];
    const incomingNotices = [
      ["mail", "Surat baru diterima", "SM/2025/05/0124 - PT Cipta Karya", "8 menit lalu", "blue"],
      ["clipboard", "Surat perlu diproses", "SM/2025/05/0122 - Universitas X", "22 menit lalu", "orange"],
      ["send", "Surat telah diteruskan", "SM/2025/05/0123 - Dinas PU Jakarta", "1 jam lalu", "green"]
    ];

    return (
      <section className="incomingPage incomingDashboardPage">
        <header className="ajuanHeader incomingDashboardHeader">
          <div>
            <h1>Surat Masuk</h1>
            <p>Kelola surat masuk dari instansi atau perusahaan luar.</p>
          </div>
        </header>

        <section className="incomingOverviewGrid">
          {incomingStats.map(([label, value, icon, tone]) => (
            <article className={`incomingStatCard ${tone}`} key={label}>
              <span className="incomingStatIcon"><LineIcon name={icon} /></span>
              <div>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
              <i className="sparkLine" aria-hidden="true" />
            </article>
          ))}
        </section>

        <section className="incomingDashboardGrid">
          <article className="tableShell incomingListCard">
            <div className="rowBetween incomingListHeader">
              <h3>Daftar Surat Masuk</h3>
              <button type="button" className="primaryBtn" onClick={() => setIncomingMode("manual")}><LineIcon name="plus" /> Input Surat Masuk</button>
            </div>
            <div className="tableScroll">
              <table>
                <thead>
                  <tr>
                    <th>Nomor Agenda</th>
                    <th>Asal Surat</th>
                    <th>Perihal</th>
                    <th>Tanggal Masuk</th>
                    <th>Tujuan/Bagian</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {incomingRows.map(([agenda, sender, subject, date, target, status]) => (
                    <tr key={agenda}>
                      <td>{agenda}</td>
                      <td>{sender}</td>
                      <td>{subject}</td>
                      <td>{date}</td>
                      <td>{target}</td>
                      <td><Status text={status} /></td>
                      <td>
                        <button type="button" className="iconBtn" aria-label={`Lihat ${agenda}`} onClick={() => setConfirm({ title: "Detail surat masuk", body: `${agenda} dari ${sender}: ${subject}` })}>
                          <LineIcon name="eye" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="incomingSideStack">
            <article className="incomingInfoCard">
              <h3><LineIcon name="book" /> Panduan Surat Masuk</h3>
              <ul>
                {guideItems.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>

            <article className="incomingInfoCard incomingNoticeCard">
              <div className="rowBetween">
                <h3>Notifikasi Surat Masuk</h3>
                <button type="button" className="linkBtn">Lihat semua</button>
              </div>
              <div className="incomingNoticeList">
                {incomingNotices.map(([icon, title, body, time, tone]) => (
                  <div className="incomingNoticeItem" key={title}>
                    <span className={`incomingNoticeIcon ${tone}`}><LineIcon name={icon} /></span>
                    <div>
                      <strong>{title}</strong>
                      <small>{body}</small>
                    </div>
                    <time>{time}</time>
                    <i aria-hidden="true" />
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>
      </section>
    );
  }

  if (incomingMode === "email") {
    const waitingCount = emailRows.filter((row) => row.processStatus === "belum_diproses" || ["Belum Diproses", "Baru"].includes(row.status)).length;
    return (
      <section className="incomingPage incomingEmailPage">
        <header className="ajuanHeader">
          <div>
            <h1>Surat Masuk dari Email</h1>
            <p>Email eksternal dari sekretariat@sttpu.ac.id masuk ke E-Office sebelum diteruskan ke pimpinan.</p>
          </div>
          <div className="incomingEmailActions">
            <button type="button" className="softBtn" onClick={() => setIncomingMode("manual")}><LineIcon name="doc" /> Registrasi Manual</button>
            <button type="button" className="primaryBtn emailSyncBtn" onClick={syncIncomingEmail} disabled={emailSyncing}>
              <LineIcon name={emailSyncing ? "refresh" : "mail"} />
              {emailSyncing ? "Menyinkronkan" : "Sinkron Email"}
            </button>
          </div>
        </header>

        <section className="ajuanStatusGrid incomingEmailStats">
          {[
            ["Mailbox", "sekretariat@sttpu.ac.id", "Sumber surat eksternal", "mail", "blue"],
            ["Email Masuk", String(emailRows.length), "Sudah tersinkron", "inbox", "purple"],
            ["Belum Diteruskan", String(waitingCount), "Perlu diproses operator", "clock", "orange"],
            ["Lampiran", String(emailRows.reduce((total, row) => total + (row.attachments?.length || 0), 0)), "Dokumen surat email", "upload", "green"]
          ].map(([label, value, meta, icon, tone]) => (
            <article className={`ajuanStatusCard ${tone}`} key={label}>
              <span className="icon3d">{iconSymbol(icon)}</span>
              <div><small>{label}</small><strong>{value}</strong><p>{meta}</p></div>
            </article>
          ))}
        </section>

        <article className="tableShell incomingEmailTable">
          <div className="rowBetween">
            <div>
              <h3>Daftar Surat Masuk Email</h3>
              <p className="tableSubtext">{emailLoading ? "Memuat email masuk..." : "Surat dari email ditampilkan di sini sebelum diproses atau diteruskan."}</p>
            </div>
            <span className="status waiting">{emailRows.length} email</span>
          </div>
          <div className="tableScroll">
            <table>
              <thead>
                <tr>
                  <th>Agenda</th>
                  <th>Pengirim</th>
                  <th>Perihal</th>
                  <th>Diterima</th>
                  <th>Lampiran</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {emailRows.map((row) => (
                  <tr key={row.id || row.agenda}>
                    <td>{row.agenda || "-"}</td>
                    <td>{row.sender}</td>
                    <td>{row.subject}</td>
                    <td>{formatIncomingEmailDate(row.receivedAt)}</td>
                    <td>{row.attachments?.length ? row.attachments.map((item) => item.filename || "Lampiran").join(", ") : "-"}</td>
                    <td><Status text={row.status || "Diregistrasi"} /></td>
                    <td className="operatorActions">
                      <button
                        type="button"
                        className={row.processStatus === "sudah_diproses" ? "softBtn" : "primaryBtn"}
                        onClick={() => processEmailAsIncomingLetter(row)}
                        disabled={processingEmailId === row.id}
                      >
                        <LineIcon name={row.processStatus === "sudah_diproses" ? "check" : "send"} />
                        {row.processStatus === "sudah_diproses" ? "Sudah Diproses" : processingEmailId === row.id ? "Memproses" : "Proses"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="incomingPage">
      <header className="ajuanHeader">
        <div>
          <h1>Form Surat Masuk</h1>
          <p>Registrasi surat masuk eksternal, buat nomor agenda, dan teruskan kepada pimpinan.</p>
        </div>
        <button type="button" className="softBtn emailSyncBtn" onClick={() => setIncomingMode("dashboard")}><LineIcon name="arrowLeft" /> Kembali</button>
      </header>

      <form className="incomingPaper" onSubmit={(event) => event.preventDefault()}>
        <section className="incomingBox incomingTop">
          <div className="incomingTo">
            <span>Kepada Yth.</span>
            {["Ketua", "Waket I", "Waket II", "Waket III"].map((item) => (
              <label key={item}><input type="checkbox" name="leaderTargets" value={item} /> {item}</label>
            ))}
          </div>
          <div className="incomingFields">
            <label>Dari <input name="sender" placeholder="Nama instansi / pengirim" required /></label>
            <label>Perihal <input name="subject" placeholder="Perihal surat" required /></label>
            <label>No. Surat <input name="letterNumber" placeholder="Nomor surat" required /></label>
            <label>Tgl Surat <input name="letterDate" type="date" required /></label>
            <label>Tgl Terima <input name="receivedDate" type="date" required /></label>
          </div>
          <label className="agendaField">No. Agenda <input name="agendaNumber" placeholder="AG-2026-001" /></label>
        </section>

        <section className="incomingMiddle">
          <div className="incomingBox">
            <h3>Kepada Yth.</h3>
            <div className="checkLineList">
              {recipients.map((item) => <label key={item}>{item}<input type="checkbox" name="recipients" value={item} /></label>)}
            </div>
          </div>
          <div className="incomingBox">
            <h3>Instruksi</h3>
            <div className="checkLineList">
              {instructions.map((item) => <label key={item}>{item}<input type="checkbox" name="instructions" value={item} /></label>)}
            </div>
          </div>
        </section>

        <section className="incomingBox incomingBottom">
          <label>Kepada Yth. <input name="followUpTo" placeholder="Tujuan tindak lanjut" /></label>
          <label>Proses lebih lanjut <textarea name="followUp" rows={2} placeholder="Tuliskan tindak lanjut yang dibutuhkan" /></label>
          <label>Isi <textarea name="summary" rows={7} placeholder="Catatan isi surat" /></label>
        </section>

        <section className="incomingBox incomingUploadInline">
          <div className="rowBetween">
            <div>
              <h3>Upload Dokumen</h3>
            </div>
            <span className="status waiting">Maks. 10 MB</span>
          </div>
          <div className="archiveNotice">
            <LineIcon name="info" />
            <span>Format file: <strong>PDF</strong>. Dokumen akan ikut tersimpan saat surat diteruskan.</span>
          </div>
          <div className="incomingUploadFields">
            <div className="uploadField">
              <strong>File Dokumen</strong>
              <UploadDropzone name="document" accept=".pdf,application/pdf" formats="PDF (Maks. 10 MB)" />
            </div>
          </div>
        </section>

        <div className="incomingActions">
          <button type="button" className="primaryBtn" onClick={(event) => saveIncomingLetter(event, "forward")} disabled={Boolean(savingIncoming)}>
            {savingIncoming === "forward" ? "Meneruskan..." : "Teruskan ke Pimpinan"}
          </button>
        </div>
      </form>
    </section>
  );
}

function incomingStatusLabel(status) {
  const value = String(status || "").toLowerCase();
  if (value === "diregistrasi") return "Diregistrasi";
  if (value === "diteruskan") return "Diteruskan";
  if (value === "didisposisikan") return "Didisposisikan";
  if (value === "ditindaklanjuti") return "Ditindaklanjuti";
  if (value === "selesai") return "Selesai";
  return status || "Diteruskan";
}

function mapIncomingLetterToPimpinanRow(item) {
  const agenda = item.agenda_number || item.agendaNumber || item.agenda || "-";
  const letterNumber = item.letter_number || item.letterNumber || "-";
  const sender = item.sender || "Pengirim eksternal";
  const subject = item.subject || "Surat masuk eksternal";
  const status = incomingStatusLabel(item.status);
  const row = [agenda, letterNumber, sender, subject, status];
  const document = item.document;
  row.detail = {
    agenda,
    nomorSurat: letterNumber,
    pengirim: sender,
    perihal: subject,
    status,
    tanggalSurat: formatDateOnly(item.letter_date || item.letterDate),
    tanggalTerima: formatDateOnly(item.received_date || item.receivedDate),
    sifat: item.letter_nature_name || "Biasa",
    tujuanAwal: item.leaderTargets?.length ? item.leaderTargets : ["Pimpinan"],
    ringkasan: item.summary || subject,
    lampiran: document?.original_name || document?.name
      ? [[document.original_name || document.name, formatFileSize(document.file_size_bytes || document.size || 1), "Diunggah operator"]]
      : [["Dokumen_Surat_Masuk.pdf", "512 KB", "Diunggah operator"]],
    riwayat: [
      [formatDateTime(item.created_at || item.createdAt), "Operator meregistrasi surat masuk"],
      [formatDateTime(item.forwarded_at || item.forwardedAt || item.created_at || item.createdAt), "Surat diteruskan kepada pimpinan"]
    ]
  };
  return row;
}

function getIncomingLetterDetail(row) {
  if (row?.detail) return row.detail;
  const [agenda, nomorSurat, pengirim, perihal, status] = row;
  const detailMap = {
    "AG-2026-041": {
      tanggalSurat: "10 Mei 2026",
      tanggalTerima: "12 Mei 2026",
      sifat: "Segera",
      tujuanAwal: ["Ketua", "Waket I"],
      ringkasan: "Dinas Kominfo meminta data layanan untuk kebutuhan sinkronisasi program digitalisasi layanan publik.",
      lampiran: [["Surat_Masuk_Kominfo.pdf", "684 KB", "Diunggah operator 12 Mei 2026, 09:42 WIB"]],
      riwayat: [
        ["12 Mei 2026, 09:40 WIB", "Operator meregistrasi surat masuk"],
        ["12 Mei 2026, 09:42 WIB", "Dokumen surat diunggah"],
        ["12 Mei 2026, 09:45 WIB", "Surat diteruskan kepada pimpinan"]
      ]
    },
    "AG-2026-040": {
      tanggalSurat: "9 Mei 2026",
      tanggalTerima: "12 Mei 2026",
      sifat: "Penting",
      tujuanAwal: ["Ketua", "Waket II"],
      ringkasan: "Bappeda mengirim surat koordinasi program dan meminta kehadiran unit terkait pada rapat teknis.",
      lampiran: [["Surat_Koordinasi_Bappeda.pdf", "512 KB", "Diunggah operator 12 Mei 2026, 08:35 WIB"]],
      riwayat: [
        ["12 Mei 2026, 08:30 WIB", "Operator meregistrasi surat masuk"],
        ["12 Mei 2026, 08:35 WIB", "Dokumen surat diunggah"],
        ["12 Mei 2026, 08:41 WIB", "Surat diteruskan kepada pimpinan"]
      ]
    },
    "AG-2026-039": {
      tanggalSurat: "8 Mei 2026",
      tanggalTerima: "11 Mei 2026",
      sifat: "Biasa",
      tujuanAwal: ["Ketua"],
      ringkasan: "Inspektorat menyampaikan jadwal audit dan permintaan kesiapan dokumen pendukung.",
      lampiran: [["Jadwal_Audit_Inspektorat.pdf", "438 KB", "Diunggah operator 11 Mei 2026, 14:10 WIB"]],
      riwayat: [
        ["11 Mei 2026, 14:00 WIB", "Operator meregistrasi surat masuk"],
        ["11 Mei 2026, 14:10 WIB", "Dokumen surat diunggah"],
        ["11 Mei 2026, 15:05 WIB", "Pimpinan membuat disposisi"]
      ]
    }
  };
  return {
    agenda,
    nomorSurat,
    pengirim,
    perihal,
    status,
    ...(detailMap[agenda] || {
      tanggalSurat: "12 Mei 2026",
      tanggalTerima: "12 Mei 2026",
      sifat: "Penting",
      tujuanAwal: ["Ketua"],
      ringkasan: perihal,
      lampiran: [["Dokumen_Surat_Masuk.pdf", "512 KB", "Diunggah operator"]],
      riwayat: [["12 Mei 2026, 10:00 WIB", "Surat diteruskan kepada pimpinan"]]
    })
  };
}

function PimpinanIncomingReview({ setConfirm }) {
  const [dispositionSource, setDispositionSource] = useState(null);
  const [incomingAction, setIncomingAction] = useState(null);
  const demoIncomingRows = [
    ["AG-2026-041", "SM/109/V/2026", "Dinas Kominfo", "Permintaan data layanan", "Diteruskan"],
    ["AG-2026-040", "SM/108/V/2026", "Bappeda", "Koordinasi program", "Diteruskan"],
    ["AG-2026-039", "SM/107/V/2026", "Inspektorat", "Jadwal audit", "Didisposisikan"]
  ];
  const [incomingRows, setIncomingRows] = useState(demoIncomingRows);
  const [incomingLoading, setIncomingLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadForwardedIncomingLetters() {
      setIncomingLoading(true);
      try {
        const forwardedLocalRows = readLocalJson(LOCAL_INCOMING_KEY, [])
          .filter((item) => String(item.status || "").toLowerCase() === "diteruskan")
          .map(mapIncomingLetterToPimpinanRow);

        if (getStoredToken() && !isDummyToken()) {
          const payload = await apiFetch("/incoming-letters?perPage=50");
          if (!active) return;
          const apiRows = (payload.data || [])
            .filter((item) => ["diteruskan", "didisposisikan", "ditindaklanjuti", "selesai"].includes(String(item.status || "").toLowerCase()))
            .map(mapIncomingLetterToPimpinanRow);
          const byAgenda = new Map();
          [...apiRows, ...forwardedLocalRows, ...demoIncomingRows].forEach((row) => {
            if (!byAgenda.has(row[0])) byAgenda.set(row[0], row);
          });
          setIncomingRows([...byAgenda.values()]);
          return;
        }

        const byAgenda = new Map();
        [...forwardedLocalRows, ...demoIncomingRows].forEach((row) => {
          if (!byAgenda.has(row[0])) byAgenda.set(row[0], row);
        });
        if (active) setIncomingRows([...byAgenda.values()]);
      } catch (error) {
        if (active) {
          setConfirm({ title: "Gagal memuat surat masuk pimpinan", body: error.message || "Data surat masuk belum dapat dimuat." });
        }
      } finally {
        if (active) setIncomingLoading(false);
      }
    }

    loadForwardedIncomingLetters();
    return () => {
      active = false;
    };
  }, [setConfirm]);

  if (dispositionSource) {
    return (
      <PimpinanDispositionCreate
        sourceDetail={dispositionSource === "manual" ? null : dispositionSource}
        onBack={() => setDispositionSource(null)}
        setConfirm={setConfirm}
      />
    );
  }

  if (incomingAction) {
    const detail = getIncomingLetterDetail(incomingAction.row);
    if (incomingAction.mode === "detail") {
      return <PimpinanIncomingDetail detail={detail} onBack={() => setIncomingAction(null)} />;
    }
    return (
      <PimpinanIncomingProcess
        detail={detail}
        onBack={() => setIncomingAction(null)}
        onCreateDisposition={() => {
          setIncomingAction(null);
          setDispositionSource(detail);
        }}
        setConfirm={setConfirm}
      />
    );
  }

  return (
    <section className="incomingPage">
      <header className="ajuanHeader">
        <div>
          <h1>Review Surat Masuk</h1>
          <p>Surat yang sudah diteruskan operator dapat dibaca pimpinan, diberi komentar, lalu diproses disposisi.</p>
        </div>
      </header>

      <section className="previewLayout singleColumn">
        <article className="tableShell">
          <div className="rowBetween">
            <h3>Surat Masuk Diteruskan</h3>
            <span className="status waiting">{incomingLoading ? "Memuat..." : `${incomingRows.filter((row) => row[4] === "Diteruskan").length} perlu review`}</span>
          </div>
          <DataTable
            heads={tableHeads["Surat Masuk"]}
            data={incomingRows}
            setConfirm={setConfirm}
            view="Surat Masuk Pimpinan"
            onDetail={(row) => setIncomingAction({ mode: "detail", row })}
            onProcess={(row) => setIncomingAction({ mode: "process", row })}
          />

          <section className="incomingBox leadershipComments">
            <div className="rowBetween">
              <div>
                <h3>Komentar Pimpinan</h3>
                <p>Isi arahan setelah membaca surat dan dokumen yang diteruskan operator.</p>
              </div>
              <span className="status waiting">Dapat diisi</span>
            </div>
            <div className="commentGrid">
              {["Bapak Ketua", "Waket 1", "Waket 2", "Waket 3"].map((name) => (
                <label key={name}>
                  {name}
                  <textarea rows={3} placeholder={`Tulis komentar ${name}`} />
                </label>
              ))}
            </div>
            <div className="incomingActions compact">
              <button type="button" className="primaryBtn" onClick={() => setConfirm({ title: "Kirim komentar pimpinan?", body: "Komentar akan tersimpan, tampil di portal operator, dan aktivitasnya masuk audit trail." })}>Kirim Komentar</button>
            </div>
          </section>
        </article>
      </section>
    </section>
  );
}

function PimpinanIncomingDetail({ detail, onBack }) {
  const [previewDocument, setPreviewDocument] = useState(null);
  return (
    <section className="incomingPage dispositionDetailPage ajuanDraftDetailPage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Review Surat Masuk</button>
          <h1>Detail Surat Masuk</h1>
          <p>Informasi surat yang diteruskan operator, dokumen lampiran, dan riwayat aktivitas.</p>
        </div>
        <Status text={detail.status} />
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="mail" /> Identitas Surat</h2>
              <span className={detail.sifat === "Segera" ? "priority high" : "priority"}>{detail.sifat}</span>
            </div>
            <div className="dispositionSourceRows">
              <DetailItem icon="calendar" label="Nomor Agenda" value={detail.agenda} />
              <DetailItem icon="doc" label="Nomor Surat" value={detail.nomorSurat} />
              <DetailItem icon="user" label="Pengirim" value={detail.pengirim} />
              <DetailItem icon="info" label="Perihal" value={detail.perihal} />
              <DetailItem icon="calendar" label="Tanggal Surat" value={detail.tanggalSurat} />
              <DetailItem icon="clock" label="Tanggal Terima" value={detail.tanggalTerima} />
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="users" /> Tujuan dan Ringkasan</h2>
            <div className="detailPillList">
              {detail.tujuanAwal.map((item) => <span key={item}>{item}</span>)}
            </div>
            <div className="dispositionNoteBox">
              <small>Ringkasan isi surat</small>
              <strong>{detail.perihal}</strong>
              <p>{detail.ringkasan}</p>
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="upload" /> Dokumen Lampiran</h2>
            <div className="attachmentList">
              {detail.lampiran.map((attachment) => {
                const [name, size, meta] = attachment;
                return (
                <div className="requestAttachment" key={name}>
                  <span><LineIcon name="doc" /></span>
                  <div>
                    <strong>{name}</strong>
                    <small>{size} - {meta}</small>
                  </div>
                  <DocumentOpenButtons spec={incomingDocumentSpec(detail, attachment)} onPreview={setPreviewDocument} compact />
                </div>
              );})}
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="clock" /> Riwayat Aktivitas</h2>
            <div className="dispositionTimeline">
              {detail.riwayat.map(([time, activity]) => (
                <p key={`${time}-${activity}`}><i /><span>{time}</span><strong>{activity}</strong></p>
              ))}
            </div>
          </article>
        </div>

        <aside className="dispositionPreview">
          <h3>Preview Dokumen Surat</h3>
          <div className="documentFrame">
            <div className="documentPage">
              <h4>SURAT MASUK</h4>
              <p>{detail.agenda} | {detail.nomorSurat}</p>
              <div className="docLines"><i /><i /><i /><i /></div>
            </div>
          </div>
          <p className="muted">Dokumen hanya dapat dibuka dari sesi pengguna yang berwenang.</p>
          <DocumentOpenButtons spec={incomingDocumentSpec(detail, detail.lampiran[0])} onPreview={setPreviewDocument} />
        </aside>
      </section>
      {previewDocument && <AttachmentPreviewModal attachment={previewDocument} detail={detail} onClose={() => setPreviewDocument(null)} />}
    </section>
  );
}

function PimpinanIncomingProcess({ detail, onBack, onCreateDisposition, setConfirm }) {
  return (
    <section className="incomingPage dispositionCreatePage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Review Surat Masuk</button>
          <h1>Proses Surat Masuk</h1>
          <p>Beri komentar pimpinan dan tentukan apakah surat diteruskan menjadi disposisi.</p>
        </div>
        <Status text={detail.status} />
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="mail" /> Surat Sumber</h2>
              <span className={detail.sifat === "Segera" ? "priority high" : "priority"}>{detail.sifat}</span>
            </div>
            <div className="dispositionSourceRows">
              <DetailItem icon="calendar" label="Nomor Agenda" value={detail.agenda} />
              <DetailItem icon="doc" label="Nomor Surat" value={detail.nomorSurat} />
              <DetailItem icon="user" label="Pengirim" value={detail.pengirim} />
              <DetailItem icon="info" label="Perihal" value={detail.perihal} />
            </div>
          </article>

          <form className="dispositionForm" onSubmit={(event) => event.preventDefault()}>
            <section className="dispositionFormCard">
              <h2><LineIcon name="edit" /> Komentar Pimpinan</h2>
              <label className="dispositionTextArea">
                Catatan Review
                <textarea rows={5} placeholder="Tuliskan komentar, arahan awal, atau catatan sebelum disposisi dibuat." />
              </label>
            </section>

            <section className="dispositionFormCard">
              <h2><LineIcon name="clipboard" /> Keputusan Review</h2>
              <div className="reviewDecisionGrid">
                {[
                  ["Perlu Disposisi", "Surat membutuhkan arahan dan tindak lanjut unit kerja.", true],
                  ["Selesai Tanpa Disposisi", "Surat cukup dibaca dan dicatat sebagai selesai.", false],
                  ["Minta Perbaikan Data", "Kembalikan ke operator untuk melengkapi metadata atau dokumen.", false]
                ].map(([title, body, checked]) => (
                  <label key={title}>
                    <input type="radio" name="incomingDecision" defaultChecked={checked} />
                    <span><strong>{title}</strong><small>{body}</small></span>
                  </label>
                ))}
              </div>
            </section>

            <section className="dispositionFormCard dispositionMetaForm">
              <label>
                Status Review
                <select defaultValue="siap_disposisi">
                  <option value="siap_disposisi">Siap Disposisi</option>
                  <option value="selesai">Selesai</option>
                  <option value="perlu_perbaikan">Perlu Perbaikan</option>
                </select>
              </label>
              <label>
                Sifat Surat
                <select defaultValue={detail.sifat.toLowerCase()}>
                  <option value="biasa">Biasa</option>
                  <option value="penting">Penting</option>
                  <option value="segera">Segera</option>
                </select>
              </label>
              <label className="dispositionTextArea">
                Catatan untuk Operator
                <textarea rows={3} placeholder="Opsional, isi jika data surat perlu dikoreksi atau dilengkapi." />
              </label>
            </section>

            <div className="dispositionSubmitBar">
              <button type="button" className="softBtn" onClick={() => setConfirm({ title: "Simpan komentar pimpinan?", body: `Komentar untuk ${detail.agenda} akan tersimpan dan masuk audit trail.` })}><LineIcon name="edit" /> Simpan Komentar</button>
              <button type="button" className="primaryBtn" onClick={onCreateDisposition}><LineIcon name="send" /> Lanjut Buat Disposisi</button>
            </div>
          </form>
        </div>

        <aside className="dispositionPreview">
          <h3>Preview Dokumen Surat</h3>
          <div className="documentFrame">
            <div className="documentPage">
              <h4>SURAT MASUK</h4>
              <p>{detail.agenda} | {detail.nomorSurat}</p>
              <div className="docLines"><i /><i /><i /><i /></div>
            </div>
          </div>
          <div className="dispositionFlow">
            <h3>Alur Proses</h3>
            {["Review surat", "Pilih keputusan", "Simpan komentar", "Lanjut disposisi"].map((item, index) => (
              <p key={item}><b>{index + 1}</b>{item}</p>
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}

function PimpinanDispositionCreate({ onBack, setConfirm, sourceDetail = null }) {
  const targets = ["Bagian Umum", "Bagian Akademik", "Bagian Keuangan", "Prodi Teknik Sipil", "Unit LPPM"];
  const instructions = ["Untuk diketahui", "Teliti dan proses lebih lanjut", "Siapkan jawaban", "Koordinasikan dengan unit terkait", "Laporkan hasil tindak lanjut"];
  const source = sourceDetail || {
    agenda: "AG-2026-041",
    nomorSurat: "SM/109/V/2026",
    pengirim: "Dinas Kominfo",
    perihal: "Permintaan data layanan",
    sifat: "Penting"
  };

  return (
    <section className="incomingPage dispositionCreatePage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Review Surat Masuk</button>
          <h1>Buat Disposisi</h1>
          <p>{sourceDetail ? `Susun disposisi untuk ${source.agenda} berdasarkan hasil review pimpinan.` : "Pilih tujuan, instruksi, dan batas waktu tindak lanjut untuk surat yang akan didisposisikan."}</p>
        </div>
        <span className="status waiting">{sourceDetail ? "Dari Review Surat" : "Draft Manual"}</span>
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="mail" /> Surat Sumber</h2>
              <Status text="Diteruskan" />
            </div>
            <div className="dispositionSourceRows">
              <DetailItem icon="calendar" label="Nomor Agenda" value={source.agenda} />
              <DetailItem icon="doc" label="Nomor Surat" value={source.nomorSurat} />
              <DetailItem icon="user" label="Pengirim" value={source.pengirim} />
              <DetailItem icon="info" label="Perihal" value={source.perihal} />
            </div>
          </article>

          <form className="dispositionForm" onSubmit={(event) => event.preventDefault()}>
            <section className="dispositionFormCard">
              <h2><LineIcon name="users" /> Tujuan Disposisi</h2>
              <div className="dispositionCheckGrid">
                {targets.map((target, index) => (
                  <label key={target}>
                    <input type="checkbox" defaultChecked={index === 0} />
                    <span>{target}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="dispositionFormCard">
              <h2><LineIcon name="clipboard" /> Instruksi Disposisi</h2>
              <div className="dispositionCheckGrid instructionGrid">
                {instructions.map((instruction, index) => (
                  <label key={instruction}>
                    <input type="checkbox" defaultChecked={index === 1} />
                    <span>{instruction}</span>
                  </label>
                ))}
              </div>
              <label className="dispositionTextArea">
                Catatan Instruksi
                <textarea rows={5} defaultValue={`Mohon ditelaah dan ditindaklanjuti terkait ${source.perihal.toLowerCase()}. Laporkan hasil tindak lanjut melalui sistem.`} />
              </label>
            </section>

            <section className="dispositionFormCard dispositionMetaForm">
              <label>
                Batas Waktu
                <input type="date" defaultValue="2026-05-20" />
              </label>
              <label>
                Prioritas
                <select defaultValue={source.sifat?.toLowerCase() || "penting"}>
                  <option value="biasa">Biasa</option>
                  <option value="penting">Penting</option>
                  <option value="segera">Segera</option>
                </select>
              </label>
              <label>
                Status Awal
                <select defaultValue="dikirim">
                  <option value="dikirim">Dikirim</option>
                  <option value="draft">Draft</option>
                </select>
              </label>
            </section>

            <div className="dispositionSubmitBar">
              <button type="button" className="ghostBtn" onClick={onBack}>Batal</button>
              <button type="button" className="primaryBtn" onClick={() => setConfirm({ title: "Kirim disposisi?", body: `Disposisi untuk ${source.agenda} akan dikirim kepada tujuan yang dipilih, notifikasi dibuat, dan aktivitas masuk audit trail.` })}><LineIcon name="send" /> Kirim Disposisi</button>
            </div>
          </form>
        </div>

        <aside className="dispositionPreview">
          <h3>Preview Surat</h3>
          <div className="documentFrame">
            <div className="documentPage">
              <h4>SURAT MASUK</h4>
              <p>{source.agenda} | {source.nomorSurat}</p>
              <div className="docLines"><i /><i /><i /><i /></div>
            </div>
          </div>
          <div className="dispositionFlow">
            <h3>Alur Disposisi</h3>
            {["Pimpinan membuat disposisi", "Tujuan menerima notifikasi", "User/staf mengirim tindak lanjut"].map((item, index) => (
              <p key={item}><b>{index + 1}</b>{item}</p>
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}

function ArchiveHome({ ajuanRequests = [] }) {
  const [archiveFilter, setArchiveFilter] = useState(null);
  const [archiveTypeFolder, setArchiveTypeFolder] = useState(null);
  const [archivePage, setArchivePage] = useState(1);
  const [archivePageSize, setArchivePageSize] = useState(10);
  const [previewDocument, setPreviewDocument] = useState(null);
  const baseArchiveRows = [
    ["AJ/2025/05/00128", "Ajuan Surat", "Surat Izin Penelitian", "16 Mei 2025", "Otomatis", "Disetujui"],
    ["SM/109/V/2026", "Surat Masuk", "Permintaan data layanan", "15 Mei 2025", "Otomatis", "Selesai"],
    ["SK/2026/018", "Surat Keluar", "Pembaruan SOP arsip", "15 Mei 2025", "Otomatis", "Dikirim"],
    ["DSP/2026/020", "Disposisi", "Telaah dan laporkan", "14 Mei 2025", "Otomatis", "Selesai"],
    ["AJ/2025/05/00124", "Ajuan Surat", "Surat Keterangan Aktif", "14 Mei 2025", "Otomatis", "Disetujui"]
  ];
  const completedAjuanArchiveRows = getCompletedAjuanArchiveRows(ajuanRequests);
  const existingArchiveNumbers = new Set(baseArchiveRows.map((row) => row[0]));
  const archiveRows = [
    ...completedAjuanArchiveRows.filter((row) => !existingArchiveNumbers.has(row[0])),
    ...baseArchiveRows
  ];
  const archiveSummary = [
    ["Total Arsip", String(archiveRows.length), "Semua dokumen otomatis", "folder", "blue"],
    ["Ajuan Selesai", String(archiveRows.filter((row) => row[1] === "Ajuan Surat").length), "Masuk otomatis setelah penomoran", "check", "green"],
    ["Surat Masuk", String(archiveRows.filter((row) => row[1] === "Surat Masuk").length), "Masuk setelah selesai", "mail", "purple"],
    ["Disposisi", String(archiveRows.filter((row) => row[1] === "Disposisi").length), "Tindak lanjut selesai", "clipboard", "orange"]
  ];
  const archiveFilterMap = {
    "Ajuan Selesai": "Ajuan Surat",
    "Surat Masuk": "Surat Masuk",
    Disposisi: "Disposisi"
  };
  const getArchiveLetterTypeFolder = (row) => row[2] || row[1] || "Lainnya";
  const archiveTypeFolders = Object.entries(
    archiveRows.reduce((acc, row) => {
      const folder = getArchiveLetterTypeFolder(row);
      acc[folder] = (acc[folder] || 0) + 1;
      return acc;
    }, {})
  );
  const filteredArchiveRows = archiveRows.filter((row) => {
    const matchesSummary = archiveFilter ? row[1] === archiveFilterMap[archiveFilter] : true;
    const matchesTypeFolder = archiveTypeFolder ? getArchiveLetterTypeFolder(row) === archiveTypeFolder : true;
    return matchesSummary && matchesTypeFolder;
  });
  const totalArchivePages = Math.max(1, Math.ceil(filteredArchiveRows.length / archivePageSize));
  const visibleArchiveRows = filteredArchiveRows.slice((archivePage - 1) * archivePageSize, archivePage * archivePageSize);
  const archiveStart = filteredArchiveRows.length ? (archivePage - 1) * archivePageSize + 1 : 0;
  const archiveEnd = Math.min(archivePage * archivePageSize, filteredArchiveRows.length);
  const archivePageItems = getPaginationItems(archivePage, totalArchivePages);
  const applyArchiveFilter = (filter) => {
    setArchiveFilter(filter);
    setArchivePage(1);
  };
  const applyArchiveTypeFolder = (folder) => {
    setArchiveTypeFolder(folder);
    setArchivePage(1);
  };
  const updateArchivePageSize = (event) => {
    setArchivePageSize(Number(event.target.value));
    setArchivePage(1);
  };

  useEffect(() => {
    if (archivePage > totalArchivePages) setArchivePage(totalArchivePages);
  }, [archivePage, totalArchivePages]);

  return (
    <section className="archivePage">
      <header className="ajuanHeader">
        <div>
          <h1>Arsip Digital</h1>
          <p>Arsip dibuat otomatis dari surat dan ajuan yang sudah selesai, tanpa upload dokumen ulang.</p>
        </div>
      </header>

      <section className="ajuanStatusGrid">
        {archiveSummary.map(([label, value, meta, icon, tone]) => (
          <button type="button" className={`ajuanStatusCard clickable ${tone}`} key={label} onClick={() => applyArchiveFilter(label === "Total Arsip" ? null : label)} aria-label={`Filter arsip ${label}`}>
            <span className="icon3d">{iconSymbol(icon)}</span>
            <div><small>{label}</small><strong>{value}</strong><p>{meta}</p></div>
          </button>
        ))}
      </section>

      <article className="ajuanHistory">
        <div className="panelHeader">
          <h3>{archiveTypeFolder ? `Daftar Arsip - ${archiveTypeFolder}` : archiveFilter ? `Daftar Arsip - ${archiveFilter}` : "Daftar Arsip Otomatis"}</h3>
          <button type="button" className="archiveResetBtn" onClick={() => { applyArchiveFilter(null); applyArchiveTypeFolder(null); }} aria-label="Tampilkan semua arsip">
            Semua arsip <span aria-hidden="true">-&gt;</span>
          </button>
        </div>
        <div className="archiveNotice">
          <LineIcon name="info" />
          <span>Ajuan surat otomatis masuk arsip ketika operator menyimpan nomor surat final dan status berubah menjadi <strong>Selesai</strong>.</span>
        </div>
        <section className="dispositionFolderPanel archiveFolderPanel">
          <div className="dispositionFolderHeader">
            <h4>Folder Berdasarkan Jenis Surat</h4>
            <button type="button" onClick={() => applyArchiveTypeFolder(null)}>Lihat semua folder <span aria-hidden="true">-&gt;</span></button>
          </div>
          <div className="dispositionFolderGrid archiveFolderGrid">
            {archiveTypeFolders.map(([folder, count]) => (
              <button
                type="button"
                className={archiveTypeFolder === folder ? "dispositionFolderItem active" : "dispositionFolderItem"}
                key={folder}
                onClick={() => applyArchiveTypeFolder(folder)}
              >
                <span><LineIcon name="folder" /></span>
                <strong>{folder}</strong>
                <small>{count}</small>
              </button>
            ))}
          </div>
        </section>
        <table className="dashboardTable ajuanHistoryTable archiveTable">
          <thead><tr><th>Nomor Surat</th><th>Sumber</th><th>Perihal</th><th>Tanggal Arsip</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {visibleArchiveRows.map((row) => {
              const [number, source, subject, date, , status] = row;
              const attachment = getArchiveRowAttachment(row);
              const spec = {
                title: source,
                filename: attachment?.[0] || `${number}.pdf`,
                number,
                kind: source,
                subject,
                party: "Arsip Digital",
                status,
                summary: `${subject} diarsipkan otomatis pada ${date} setelah nomor surat final tersimpan.`,
                meta: `Tanggal arsip ${date}`,
                attachment
              };
              return (
              <tr key={number}>
                <td>{number}</td><td>{source}</td><td>{subject}</td><td>{date}</td><td><Status text={status} /></td>
                <td><DocumentOpenButtons spec={spec} onPreview={setPreviewDocument} compact /></td>
              </tr>
            );})}
          </tbody>
        </table>
        <div className="archivePagination" aria-label="Navigasi halaman arsip">
          <label className="archivePageSize">
            Tampilkan
            <select value={archivePageSize} onChange={updateArchivePageSize}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <div className="archivePaginationRight">
            <div className="archivePageInfo">
              <strong>{archiveStart}-{archiveEnd}</strong>
              <span>dari {filteredArchiveRows.length} arsip</span>
            </div>
            <div className="archivePageControls">
              <button type="button" className="archivePageNav" disabled={archivePage <= 1} onClick={() => setArchivePage((page) => Math.max(1, page - 1))} aria-label="Halaman sebelumnya">&lt;</button>
              {archivePageItems.map((item, index) => (
                item === "ellipsis"
                  ? <span className="archivePageEllipsis" key={`ellipsis-${index}`}>...</span>
                  : (
                    <button
                      type="button"
                      className={item === archivePage ? "archivePageNumber active" : "archivePageNumber"}
                      key={item}
                      onClick={() => setArchivePage(item)}
                      aria-label={`Halaman ${item}`}
                      aria-current={item === archivePage ? "page" : undefined}
                    >
                      {item}
                    </button>
                  )
              ))}
              <button type="button" className="archivePageNav" disabled={archivePage >= totalArchivePages} onClick={() => setArchivePage((page) => Math.min(totalArchivePages, page + 1))} aria-label="Halaman berikutnya">&gt;</button>
            </div>
          </div>
        </div>
      </article>
      {previewDocument && <AttachmentPreviewModal attachment={previewDocument} detail={{ judul: "Arsip Digital", keterangan: "Dokumen arsip dapat dipratinjau dan diunduh." }} onClose={() => setPreviewDocument(null)} />}
    </section>
  );
}

function getCompletedAjuanArchiveRows(ajuanRequests) {
  return getLatestAjuanRequests(ajuanRequests)
    .filter((item) => getAjuanWorkflowStatus(item) === "Selesai" && getAjuanNomorSurat(item) !== "-")
    .map((item) => [
      getAjuanNomorSurat(item),
      "Ajuan Surat",
      item.judul || item.keterangan || item.jenis || "-",
      getAjuanArchiveDate(item),
      "Otomatis",
      "Selesai",
      item
    ]);
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const normalizedPages = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  return normalizedPages.flatMap((page, index) => {
    const previousPage = normalizedPages[index - 1];
    return previousPage && page - previousPage > 1 ? ["ellipsis", page] : [page];
  });
}

function getArchiveRowAttachment(row) {
  const detail = row?.[6];
  if (!detail || typeof detail !== "object") return null;
  return detail.suratFinalOperator || detail.lampiranFinal?.[0] || detail.dokumenApprovalPimpinan || detail.lampiranApproval?.[0] || null;
}

function getAjuanApprovalAttachments(detail) {
  const attachments = detail?.lampiranApproval?.length ? detail.lampiranApproval : [];
  if (attachments.length > 0) return attachments;
  return detail?.dokumenApprovalPimpinan ? [detail.dokumenApprovalPimpinan] : [];
}

function getAjuanFinalAttachments(detail) {
  const attachments = detail?.lampiranFinal?.length ? detail.lampiranFinal : [];
  if (attachments.length > 0) return attachments;
  return detail?.suratFinalOperator ? [detail.suratFinalOperator] : [];
}

function getAjuanArchiveDate(item) {
  const numberedAt = item?.dinomoriPada || item?.tanggalSelesai || item?.tanggal;
  if (!numberedAt) return "-";
  return String(numberedAt).split(" pukul ")[0].split(",")[0].trim();
}

function AjuanSuratHome({ setConfirm, onCreateAjuan, currentUserName, currentUserProfile, ajuanRequests }) {
  const [statusFilter, setStatusFilter] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAjuan, setSelectedAjuan] = useState(null);
  const currentUserRequests = ajuanRequests.filter((item) => (
    item.pemohon === currentUserName && item.nomor !== "AJ/2025/05/00130"
  ));
  const visibleUserRequests = getLatestAjuanRequests(currentUserRequests);
  const userRequestRows = visibleUserRequests.map((item, index) => [
    String(index + 1),
    item.nomor,
    item.jenis,
    item.judul || item.jenis,
    item.tanggal,
    getAjuanDisplayStatus(item),
    item,
    getAjuanWorkflowStatus(item)
  ]);
  const statusCards = [
    ["Draf", String(visibleUserRequests.filter((item) => getAjuanWorkflowStatus(item) === "Draft").length), "Belum dikirim", "doc", "blue"],
    ["Diproses", String(visibleUserRequests.filter((item) => ["Menunggu Approval", "Disetujui"].includes(getAjuanWorkflowStatus(item))).length), "Sedang berjalan", "clock", "purple"],
    ["Selesai", String(visibleUserRequests.filter((item) => getAjuanWorkflowStatus(item) === "Selesai").length), "Ajuan selesai", "check", "green"],
    ["Perlu Revisi", String(visibleUserRequests.filter((item) => ["Perlu Revisi", "Ditolak"].includes(getAjuanWorkflowStatus(item))).length), "Lengkapi ulang", "refresh", "red"]
  ];
  const guideSteps = [
    "Pilih jenis surat yang sesuai dengan kebutuhan Anda.",
    "Lengkapi data dan informasi dengan benar.",
    "Unggah dokumen pendukung dalam format PDF.",
    "Kirim ajuan ke pimpinan dan pantau status hingga selesai."
  ];
  const stages = [
    ["1. Draft Ajuan", "Buat dan lengkapi data ajuan", "send", "purple"],
    ["2. Approval Pimpinan", "Pimpinan menyetujui atau menolak", "shield", "blue"],
    ["3. Tanda Tangan", "Pimpinan mengunggah surat bertanda tangan", "upload", "blue"],
    ["4. Penomoran", "Operator menginput nomor surat", "edit", "purple"],
    ["5. Surat Final", "Surat final dapat diunduh", "archive", "green"],
    ["6. Ajuan Selesai", "Pengajuan surat selesai", "check", "green"]
  ];
  const history = userRequestRows;
  const statusFilterMap = {
    Draf: ["Draft"],
    Diproses: ["Menunggu Approval", "Disetujui"],
    Selesai: ["Selesai"],
    "Perlu Revisi": ["Perlu Revisi", "Ditolak"]
  };
  const filteredHistory = statusFilter
    ? history.filter((row) => statusFilterMap[statusFilter]?.includes(row[7] || getAjuanWorkflowStatus(row[6] || row[5])))
    : history;
  const trackedRow = getTrackedAjuanRow(history);
  const trackedStatus = trackedRow?.[5] || trackedRow?.[7] || "Draft";
  const trackedNumber = trackedRow?.[1] || "Ajuan baru";
  const showTrackedAjuanMeta = trackedRow && trackedStatus !== "Draft";
  const activeStageIndex = getAjuanStageIndex(trackedStatus);
  const isRevisionTrack = isAjuanRevisionStatus(trackedStatus);
  const openCreateAjuan = (draft = null) => {
    setSelectedAjuan(draft);
    setCreateOpen(true);
  };
  const createRetryDraft = (ajuan) => ({
    nomor: ajuan.nomor,
    nomorSuratFinal: ajuan.nomorSuratFinal,
    jenis: ajuan.jenis,
    tujuan: ajuan.tujuan,
    judul: ajuan.judul,
    sourceStatus: ajuan.status,
    catatanOperator: ajuan.catatanOperator,
    catatanPimpinan: ajuan.catatanPimpinan,
    kategoriRevisi: ajuan.kategoriRevisi,
    revisionMode: true,
    sourceNomor: ajuan.nomor
  });

  if (createOpen) {
    return <AjuanSuratCreate onCancel={() => { setCreateOpen(false); setSelectedAjuan(null); }} setConfirm={setConfirm} onCreateAjuan={onCreateAjuan} currentUserName={currentUserName} currentUserProfile={currentUserProfile} draft={selectedAjuan} />;
  }

  if (selectedAjuan) {
    return (
      <AjuanSuratDetail
        ajuan={selectedAjuan}
        onBack={() => setSelectedAjuan(null)}
        onContinue={() => openCreateAjuan(selectedAjuan)}
        onCreateRetry={(ajuan) => openCreateAjuan(createRetryDraft(ajuan))}
        setConfirm={setConfirm}
      />
    );
  }

  return (
    <section className="ajuanPage">
      <header className="ajuanHeader">
        <div>
          <h1>Ajuan Surat</h1>
          <p>Buat pengajuan surat baru dan pantau riwayat pengajuan</p>
        </div>
        <button className="newAjuanBtn createAjuanBtn" onClick={() => openCreateAjuan()}>
          <span>+</span>
          Buat Ajuan Baru
        </button>
      </header>

      <section className="ajuanStatusGrid" aria-label="Ringkasan Status Ajuan">
        {statusCards.map(([label, value, meta, icon, tone]) => (
          <button type="button" className={`ajuanStatusCard clickable ${tone}`} key={label} onClick={() => setStatusFilter(label)} aria-label={`Filter ajuan ${label}`}>
            <span className="icon3d">{iconSymbol(icon)}</span>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
              <p>{meta}</p>
            </div>
          </button>
        ))}
      </section>

      <section className="ajuanMainGrid">
        <article className="ajuanGuide">
          <div className="guideHeader">
            <div>
              <span className="guideInfo"><LineIcon name="info" /></span>
              <h2>Panduan Pengajuan Surat</h2>
            </div>
            <ClipboardIllustration />
          </div>
          <p className="guideIntro">Ikuti langkah-mudah berikut untuk membuat pengajuan surat.</p>
          <div className="guideSteps">
            {guideSteps.map((body) => (
              <div className="guideStep" key={body}>
                <span><LineIcon name="check" /></span>
                <div>{body}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="ajuanStages">
          <div className="stageHeader">
            <h2>Tahapan Pengajuan Surat</h2>
            {showTrackedAjuanMeta && <span><Status text={trackedStatus} /> {trackedNumber}</span>}
          </div>
          <div className="stageRail">
            {stages.map(([title, body, icon, tone], index) => {
              const isCompleted = index < activeStageIndex;
              const isActive = index === activeStageIndex;
              const isReached = isCompleted || isActive;
              const stageTone = isReached ? tone : "pending";
              return (
                <div className={`stageItem ${stageTone}${isCompleted ? " completed" : ""}${isActive ? " active" : ""}${isRevisionTrack && isActive ? " rejected" : ""}`} key={title}>
                  <span className="stageIcon">{iconSymbol(icon)}</span>
                  {index < stages.length - 1 && <b aria-hidden="true" />}
                  <strong>{title}</strong>
                  <small>{body}</small>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <article className="ajuanHistory userAjuanHistory">
        <div className="panelHeader">
          <h3>{statusFilter ? `Riwayat Pengajuan - ${statusFilter}` : "Riwayat Pengajuan"}</h3>
          <button onClick={() => setStatusFilter(null)}>Lihat semua <span aria-hidden="true">-&gt;</span></button>
        </div>
        <table className="dashboardTable ajuanHistoryTable">
          <thead><tr><th>No.</th><th>Nomor Surat</th><th>Jenis Surat</th><th>Perihal</th><th>Tanggal Ajuan</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {filteredHistory.map((row) => {
              const detail = row[6] || historyRowToAjuan(row, currentUserName, currentUserProfile);
              const isDraftRow = getAjuanWorkflowStatus(detail) === "Draft";
              const openDetail = () => {
                if (isDraftRow) {
                  openCreateAjuan(detail);
                  return;
                }
                setSelectedAjuan(detail);
              };
              const nomorSurat = getAjuanNomorSurat(detail);
              return (
                <tr key={row[0]} className="clickableHistoryRow" onClick={openDetail}>
                  <td>{row[0]}</td>
                  <td>
                    <button
                      type="button"
                      className="letterCellButton"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetail();
                      }}
                    >
                      {nomorSurat}
                    </button>
                  </td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                  <td>{row[4]}</td>
                  <td>
                    <div className="statusActionCell">
                      <Status text={row[5]} />
                    </div>
                  </td>
                  <td>
                    <button className="viewBtn" onClick={(event) => { event.stopPropagation(); openDetail(); }} aria-label={`Lihat detail ${nomorSurat}`}>
                      <LineIcon name="eye" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="ajuanTableFooter">
          <div className="ajuanPages"><button disabled>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div>
          <div className="ajuanRows">Tampilkan <select><option>5</option><option>10</option></select> dari {filteredHistory.length} data</div>
        </div>
      </article>
    </section>
  );
}

function getAjuanStageIndex(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("draft")) return 0;
  if (value.includes("ditolak") || value.includes("revisi")) return 1;
  if (value.includes("approval") || value.includes("review")) return 1;
  if (value.includes("penomoran")) return 3;
  if (value.includes("selesai")) return 5;
  if (value.includes("disetujui")) return 3;
  if (value.includes("dikirim") || value.includes("diproses") || value.includes("verifikasi")) return 1;
  return 1;
}

function isAjuanRevisionStatus(status) {
  const value = String(status || "").toLowerCase();
  return value.includes("ditolak") || value.includes("revisi");
}

function historyRowToAjuan(row, currentUserName, currentUserProfile) {
  return {
    nomor: row[1],
    nomorSuratFinal: row[7] || "",
    jenis: row[2],
    pemohon: currentUserName,
    unit: currentUserProfile?.unit || "Kepegawaian",
    tanggal: row[4],
    status: row[5],
    judul: row[3],
    tujuan: "STT Pekerjaan Umum Jakarta",
    keterangan: `${row[3]} diajukan melalui portal user dan mengikuti alur verifikasi administrasi.`
  };
}

function getAjuanNomorSurat(ajuan) {
  return ajuan?.nomorSuratFinal || ajuan?.nomorSurat || ajuan?.nomor_surat || "-";
}

function hasUploadedAjuanDocument(ajuan) {
  if (!ajuan?.lampiran?.length) return false;
  return (ajuan?.lampiran || []).some((attachment) => {
    const [name, size, , dataUrl, , attachmentKey] = attachment || [];
    if (!name || String(name).toLowerCase().includes("belum diunggah")) return false;
    return Boolean(dataUrl || attachmentKey || (String(name).toLowerCase().endsWith(".pdf") && size && size !== "-"));
  });
}

function getAjuanWorkflowStatus(ajuanOrStatus) {
  if (!ajuanOrStatus || typeof ajuanOrStatus === "string") return ajuanOrStatus || "Draft";
  const status = ajuanOrStatus.status || "Draft";
  if (status !== "Draft" && !hasUploadedAjuanDocument(ajuanOrStatus)) return "Draft";
  if (status === "Disetujui" && getAjuanNomorSurat(ajuanOrStatus) !== "-") return "Selesai";
  return status;
}

function getAjuanDisplayStatus(ajuanOrStatus) {
  const status = getAjuanWorkflowStatus(ajuanOrStatus);
  if (status === "Ajuan Baru") return "Menunggu Approval";
  if (status === "Perlu Verifikasi") return "Diproses Operator";
  if (status === "Disetujui") return "Penomoran Surat";
  return status || "Draft";
}

function getAjuanProgressRank(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("selesai")) return 5;
  if (value.includes("penomoran") || value.includes("disetujui")) return 4;
  if (value.includes("ditolak") || value.includes("revisi")) return 3;
  if (value.includes("approval") || value.includes("review")) return 2;
  if (value.includes("dikirim") || value.includes("diproses") || value.includes("verifikasi")) return 1;
  return 0;
}

function getLatestAjuanRequests(requests) {
  const byKey = new Map();
  requests.forEach((request) => {
    const key = getAjuanIdentityKey(request);
    const current = byKey.get(key);
    if (!current || getAjuanProgressRank(getAjuanWorkflowStatus(request)) >= getAjuanProgressRank(getAjuanWorkflowStatus(current))) {
      byKey.set(key, request);
    }
  });
  return [...byKey.values()];
}

function isAjuanCompletedStatus(status) {
  const value = String(status || "").toLowerCase();
  return value.includes("selesai");
}

function getTrackedAjuanRow(history) {
  const activeRows = history.filter((row) => !isAjuanCompletedStatus(row[7] || getAjuanWorkflowStatus(row[6] || row[5])));
  if (activeRows.length === 0) return null;
  return [...activeRows].sort((left, right) => {
    const rankDiff = getAjuanProgressRank(right[7] || getAjuanWorkflowStatus(right[6] || right[5])) - getAjuanProgressRank(left[7] || getAjuanWorkflowStatus(left[6] || left[5]));
    if (rankDiff !== 0) return rankDiff;
    return String(right[1]).localeCompare(String(left[1]));
  })[0];
}

function AjuanSuratDetail({ ajuan, onBack, onContinue, onCreateRetry, setConfirm }) {
  const isDraft = ajuan.status === "Draft";
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const detailStatus = getAjuanDisplayStatus(ajuan);
  const ajuanDetailStages = ["Draft", "Dikirim", "Approval", "Penomoran Surat", "Selesai"];
  const detailStageIndex = Math.min(getAjuanStageIndex(detailStatus), ajuanDetailStages.length - 1);
  const detailNeedsRevision = isAjuanRevisionStatus(ajuan.status);
  const rejectionNote = ajuan.catatanPimpinan || ajuan.catatanOperator || ajuan.catatanPenolakan || ajuan.rejectionNote || "";
  const finalAttachments = getAjuanFinalAttachments(ajuan);
  return (
    <section className="incomingPage dispositionDetailPage ajuanDraftDetailPage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Riwayat Pengajuan</button>
          <h1>Detail Ajuan Surat</h1>
          <p>Periksa data ajuan, lampiran, dan status proses sebelum melanjutkan.</p>
        </div>
        <Status text={detailStatus} />
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="clipboard" /> Data Ajuan</h2>
              <span className="priority">{ajuan.nomor}</span>
            </div>
            <div className="detailGrid">
              <DetailItem icon="doc" label="Nomor Ajuan" value={ajuan.nomor} />
              <DetailItem icon="doc" label="Nomor Surat" value={getAjuanNomorSurat(ajuan)} />
              <DetailItem icon="info" label="Jenis Surat" value={ajuan.jenis} />
              <DetailItem icon="calendar" label="Tanggal Ajuan" value={ajuan.tanggal} />
              <DetailItem icon="user" label="Pemohon" value={ajuan.pemohon} />
              <DetailItem icon="bank" label="Tujuan Surat" value={ajuan.tujuan || "-"} wide />
              <DetailItem icon="mail" label="Perihal" value={ajuan.judul || ajuan.jenis} wide />
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="edit" /> Keterangan</h2>
            <div className="dispositionNoteBox">
              <small>Isi pengajuan</small>
              <strong>{ajuan.judul || ajuan.jenis}</strong>
              <p>{ajuan.keterangan || "Belum ada keterangan."}</p>
            </div>
          </article>

          {ajuan.hasilPemeriksaan && (
            <article className="dispositionFormCard">
              <h2><LineIcon name="check" /> Hasil Pemeriksaan Operator</h2>
              <div className="dispositionNoteBox">
                <small>{ajuan.diperiksaPada || "Baru saja"} oleh {ajuan.diperiksaOleh || "Operator"}</small>
                <strong>{ajuan.hasilPemeriksaan}</strong>
                <p>Hasil pemeriksaan sudah dikirim ke ajuan ini dan dapat dipantau dari riwayat pengajuan.</p>
              </div>
            </article>
          )}

          {detailNeedsRevision && (
            <article className="dispositionFormCard rejectedDecisionCard">
              <h2><LineIcon name="refresh" /> Keterangan Revisi</h2>
              <div className="requestMessage">
                <LineIcon name="info" />
                <div>
                  <h3>{ajuan.diputuskanOleh || ajuan.direvisiOleh || "Operator/Pimpinan"} mengembalikan ajuan ini</h3>
                  {ajuan.kategoriRevisi && <small>Kategori: {ajuan.kategoriRevisi}</small>}
                  <p>{rejectionNote || "Catatan revisi belum tersedia. Silakan perbarui keterangan dan unggah dokumen pendukung terbaru."}</p>
                  {(ajuan.diputuskanPada || ajuan.direvisiPada) && <small>Dikembalikan pada {ajuan.diputuskanPada || ajuan.direvisiPada}</small>}
                </div>
              </div>
            </article>
          )}

          {finalAttachments.length > 0 && (
            <article className="dispositionFormCard">
              <h2><LineIcon name="check" /> Surat Final</h2>
              <div className="dispositionNoteBox">
                <small>{ajuan.dinomoriPada ? `Dinomori pada ${ajuan.dinomoriPada}` : "Surat sudah selesai"}</small>
                <strong>{getAjuanNomorSurat(ajuan)}</strong>
                <p>Surat final yang sudah di-approval dan diberi nomor oleh operator dapat dipratinjau atau diunduh.</p>
              </div>
              <div className="attachmentList">
                {finalAttachments.map((attachment) => {
                  const [name, size, meta] = attachment;
                  return (
                    <div className="requestAttachment" key={`${name}-${meta}`}>
                      <span><LineIcon name="doc" /></span>
                      <div>
                        <strong>{name}</strong>
                        <small>{size} - {meta}</small>
                      </div>
                      <div className="requestAttachmentActions">
                        <button type="button" className="softBtn" onClick={() => setPreviewAttachment(attachment)}><LineIcon name="eye" /> Pratinjau</button>
                        <button type="button" className="primaryBtn" onClick={() => downloadAttachment(attachment, ajuan)}><LineIcon name="upload" /> Unduh</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          )}

          <article className="dispositionFormCard">
            <h2><LineIcon name="upload" /> Lampiran</h2>
            <div className="attachmentList">
              {(ajuan.lampiran || []).map((attachment) => {
                const [name, size, meta] = attachment;
                const hasFile = Boolean(attachment[3]);
                return (
                  <div className="requestAttachment" key={`${name}-${meta}`}>
                    <span><LineIcon name="doc" /></span>
                    <div>
                      <strong>{name}</strong>
                      <small>{size} - {meta}</small>
                    </div>
                    {hasFile && (
                      <div className="requestAttachmentActions">
                        <button type="button" className="softBtn" onClick={() => setPreviewAttachment(attachment)}><LineIcon name="eye" /> Pratinjau</button>
                        <button type="button" className="primaryBtn" onClick={() => downloadAttachment(attachment, ajuan)}><LineIcon name="upload" /> Unduh</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        </div>

        <aside className="dispositionPreview">
          <h3>Status Ajuan</h3>
          <div className="dispositionFlow">
            {ajuanDetailStages.map((item, index) => (
              <p key={item} className={`${index < detailStageIndex ? "completed" : ""}${index === detailStageIndex ? " active" : ""}${detailNeedsRevision && index === detailStageIndex ? " rejected" : ""}`}><b>{index + 1}</b>{item}</p>
            ))}
          </div>
          <div className="dispositionSubmitBar">
            {isDraft ? (
              <button type="button" className="primaryBtn" onClick={onContinue}><LineIcon name="send" /> Kirim Ajuan</button>
            ) : detailNeedsRevision ? (
              <button type="button" className="primaryBtn" onClick={() => onCreateRetry(ajuan)}><LineIcon name="refresh" /> Revisi Ajuan</button>
            ) : (
              <button type="button" className="softBtn" onClick={() => setConfirm({ title: "Pantau status ajuan", body: `${ajuan.nomor} sedang berada pada status ${detailStatus}.` })}><LineIcon name="eye" /> Pantau Status</button>
            )}
          </div>
        </aside>
      </section>
      {previewAttachment && <AttachmentPreviewModal attachment={previewAttachment} detail={ajuan} onClose={() => setPreviewAttachment(null)} />}
    </section>
  );
}

function AjuanSuratCreate({ onCancel, setConfirm, onCreateAjuan, currentUserName, currentUserProfile, draft }) {
  const isRevisionMode = Boolean(draft?.revisionMode);
  const savedJenis = draft?.jenis || "";
  const savedOtherJenis = savedJenis.startsWith("Surat Lainnya - ")
    ? savedJenis.replace("Surat Lainnya - ", "")
    : "";
  const savedJenisSelection = savedOtherJenis ? "Surat Lainnya" : savedJenis;
  const [selectedJenis, setSelectedJenis] = useState(savedJenisSelection);
  const [otherJenis, setOtherJenis] = useState(savedOtherJenis);
  const letterTypeOptions = draft?.jenis && !ajuanLetterTypeOptions.includes(draft.jenis)
    ? [draft.jenis, ...ajuanLetterTypeOptions]
    : ajuanLetterTypeOptions;
  const savedDraftAttachment = !isRevisionMode && (draft?.lampiran || []).find((attachment) => {
    const [name, size] = attachment || [];
    return name && !String(name).toLowerCase().includes("belum diunggah") && size && size !== "-";
  });

  async function submitAjuan(event) {
    event.preventDefault();
    const submitter = event.nativeEvent.submitter;
    const form = new FormData(event.currentTarget);
    const intent = submitter?.value || "send";
    const nomor = String(form.get("nomor") || "").trim() || generateAjuanNumber();
    const selectedJenisValue = String(form.get("jenis") || "").trim();
    const jenisLainnya = String(form.get("jenisLainnya") || "").trim();
    const jenis = selectedJenisValue === "Surat Lainnya"
      ? `Surat Lainnya - ${jenisLainnya}`
      : selectedJenisValue;
    const tujuan = String(form.get("tujuan") || "").trim();
    const judul = String(form.get("judul") || "").trim();
    const keterangan = String(form.get("keterangan") || "").trim();
    const file = form.get("lampiran");
    const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const fileError = validateUploadFile(file);

    if (fileError) {
      setConfirm({ title: "Upload dokumen gagal", body: fileError });
      return;
    }
    if (selectedJenisValue === "Surat Lainnya" && !jenisLainnya) {
      setConfirm({ title: "Jenis surat belum jelas", body: "Tuliskan jenis surat yang dimaksud pada kolom Jenis Surat Lainnya sebelum menyimpan atau mengirim ajuan." });
      return;
    }
    if (intent === "send" && !file?.name && !hasUploadedAjuanDocument(draft)) {
      setConfirm({ title: "Upload dokumen wajib", body: "Unggah dokumen surat terlebih dahulu sebelum ajuan dikirim ke operator. Tanpa dokumen, tahapan tetap berada di Draft Ajuan." });
      return;
    }
    if (isRevisionMode && intent === "send" && !file?.name && !hasUploadedAjuanDocument(draft)) {
      setConfirm({ title: "Upload dokumen wajib", body: "Untuk revisi ajuan, unggah dokumen pendukung terbaru sebelum mengirim kembali." });
      return;
    }

    const uploadedDataUrl = file?.name ? await readFileAsDataUrl(file) : "";
    const attachmentKey = file?.name ? makeAttachmentKey("ajuan", nomor, file) : "";
    if (attachmentKey) await saveAttachmentPayload(attachmentKey, uploadedDataUrl);
    const lampiran = file?.name
      ? [[file.name, formatFileSize(file.size), `Diunggah ${today}`, uploadedDataUrl, file.type, attachmentKey]]
      : draft?.lampiran?.length
        ? draft.lampiran
        : [["Dokumen pendukung belum diunggah", "-", `Ajuan dikirim ${today}`]];

    onCreateAjuan({
      nomor,
      jenis,
      pemohon: currentUserName || "Budi Santoso",
      unit: currentUserProfile?.unit || "Kepegawaian",
      tanggal: today,
      status: "Menunggu Approval",
      dikirimDariDraft: intent === "send" && draft?.status === "Draft",
      tujuan,
      judul,
      keterangan,
      dokumenDiunggahUser: Boolean(file?.name) || Boolean(draft?.dokumenDiunggahUser) || hasUploadedAjuanDocument(draft),
      nomorSuratFinal: draft?.nomorSuratFinal || "",
      revisiDariStatus: draft?.sourceStatus || "",
      revisiPada: isRevisionMode ? new Date().toLocaleString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }) : "",
      nim: currentUserProfile?.nim || "202101891",
      nik: currentUserProfile?.nik || "3309190107020006",
      email: currentUserProfile?.email || "budi.santoso@stt-pu.ac.id",
      phone: currentUserProfile?.phone || "0812-3456-7890",
      lampiran
    });
    onCancel();
  }

  return (
    <section className="ajuanCreatePage">
      <header className="dispositionCreateHeader">
        <div>
          <h1>{isRevisionMode ? "Revisi Ajuan Surat" : "Buat Ajuan Surat"}</h1>
          <p>{isRevisionMode ? `Ajuan ${draft.sourceNomor} dikembalikan. User dapat mengisi keterangan revisi dan wajib upload dokumen terbaru untuk dikirim kembali ke pimpinan.` : "Pilih jenis surat, isi tujuan, judul, dan unggah dokumen. Keterangan dapat diisi bila diperlukan. Approval dilakukan pimpinan, lalu operator memberi nomor surat setelah surat ditandatangani."}</p>
        </div>
      </header>

      <section className="ajuanCreateGrid">
        <form className="ajuanCreateForm" onSubmit={submitAjuan}>
          {isRevisionMode && (
            <div className="revisionInstructionNotice">
              <LineIcon name="info" />
              <div>
                <strong>Mode revisi aktif</strong>
                <span>Nomor ajuan, jenis surat, tujuan surat, dan judul surat memakai data sebelumnya. Nomor surat final tetap dibuat oleh operator.</span>
              </div>
            </div>
          )}
          <article className="dispositionFormCard">
            <h2><span className="createSectionIcon"><LineIcon name="doc" /></span> Data Ajuan</h2>
            {isRevisionMode ? (
              <>
                <div className="revisionLockedSummary">
                  {[
                    ["Nomor Ajuan", draft?.nomor || "-"],
                    ["Jenis Surat", draft?.jenis || "-"],
                    ["Tujuan Surat", draft?.tujuan || "-"]
                  ].map(([label, value]) => (
                    <div className="revisionLockedItem" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <input type="hidden" name="nomor" value={draft?.nomor || ""} />
                <input type="hidden" name="jenis" value={draft?.jenis || ""} />
                <input type="hidden" name="tujuan" value={draft?.tujuan || ""} />
                <input type="hidden" name="judul" value={draft?.judul || ""} />
              </>
            ) : (
              <>
                <div className="operatorNumberField">
                  <label htmlFor="nomorSuratFinal">Nomor Surat</label>
                  <p>Nomor ajuan dibuat otomatis oleh sistem. Nomor surat final diterbitkan operator setelah pimpinan menyetujui, menandatangani, dan mengunggah surat.</p>
                  <input id="nomorSuratFinal" value="Nomor surat dibuat oleh operator" disabled readOnly />
                </div>
                <div className="adminUserFields ajuanCreateFields">
                <label>Jenis Surat <span>*</span>
                  <select name="jenis" value={selectedJenis} onChange={(event) => setSelectedJenis(event.target.value)} required>
                    <option value="" disabled>Pilih jenis surat</option>
                    {letterTypeOptions.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label>Tujuan Surat <span>*</span>
                  <input name="tujuan" placeholder="Isi Tujuan Surat" defaultValue={draft?.tujuan || ""} required />
                </label>
                {selectedJenis === "Surat Lainnya" && (
                  <label className="ajuanOtherTypeField">Jenis Surat Lainnya <span>*</span>
                    <input
                      name="jenisLainnya"
                      placeholder="Contoh: Surat Rekomendasi Beasiswa"
                      value={otherJenis}
                      onChange={(event) => setOtherJenis(event.target.value)}
                      required
                    />
                    <small>Tuliskan nama jenis surat agar operator memahami kebutuhan ajuan.</small>
                  </label>
                )}
                </div>
              </>
            )}
          </article>

          <article className="dispositionFormCard">
            <h2><span className="createSectionIcon"><LineIcon name="edit" /></span> Isi Pengajuan</h2>
            <div className="ajuanCreateStack">
              {!isRevisionMode && (
                <label>Judul Surat <span>*</span>
                  <input name="judul" placeholder="Isi Judul Surat" defaultValue={draft?.judul || ""} required />
                </label>
              )}
              {isRevisionMode && (
                <div className="revisionTitleSummary">
                  <span>Judul Surat</span>
                  <strong>{draft?.judul || "-"}</strong>
                  <small>Judul surat tidak perlu diisi ulang.</small>
                </div>
              )}
              <label>Keterangan
                <textarea name="keterangan" rows={6} placeholder={isRevisionMode ? "Tuliskan keterangan revisi atau penjelasan perbaikan dokumen." : "Tuliskan kebutuhan, latar belakang, atau keterangan singkat ajuan surat."} defaultValue={isRevisionMode ? "" : draft?.keterangan || ""} />
              </label>
              <UploadDropzone label={<>Upload Dokumen Pendukung <span className="uploadRequiredMark">*</span></>} name="lampiran" accept=".pdf,application/pdf" formats="PDF. Maksimal 10 MB." />
              {savedDraftAttachment && (
                <small className="savedDraftFile">Dokumen tersimpan: {savedDraftAttachment[0]} - {savedDraftAttachment[1]}</small>
              )}
            </div>
          </article>

          <div className="dispositionSubmitBar">
            <button type="button" className="ghostBtn" onClick={onCancel}>Batal</button>
            <button type="submit" name="intent" value="send" className="primaryBtn"><LineIcon name="send" /> Kirim Ajuan</button>
          </div>
        </form>

        <aside className="ajuanCreateSide">
          <div className="processHero" aria-hidden="true">
            <span><LineIcon name="doc" /></span>
            <b><LineIcon name="check" /></b>
          </div>
          <h3>Ringkasan Proses</h3>
          {(isRevisionMode ? [
            ["Revisi", "Isi keterangan perbaikan dan unggah dokumen terbaru.", "refresh"],
            ["Approval", "Pimpinan menyetujui atau menolak ajuan.", "shield"],
            ["Penomoran", "Operator menginput nomor surat.", "edit"],
            ["Selesai", "Surat final masuk ke arsip digital.", "check"]
          ] : [
            ["Pengiriman", "Ajuan langsung dikirim setelah data dan dokumen lengkap.", "send"],
            ["Approval", "Pimpinan menyetujui atau menolak ajuan.", "shield"],
            ["Penomoran", "Operator menginput nomor surat.", "edit"],
            ["Selesai", "Surat final masuk ke arsip digital.", "check"]
          ]).map(([title, body, icon]) => (
            <p key={title}><i><LineIcon name={icon} /></i><span><strong>{title}</strong><small>{body}</small></span></p>
          ))}
        </aside>
      </section>
    </section>
  );
}

function ClipboardIllustration() {
  return (
    <div className="clipboardArt" aria-hidden="true">
      <div className="clipTop" />
      {[0, 1, 2, 3].map((item) => <span key={item}><LineIcon name="check" /><i /></span>)}
    </div>
  );
}

function DisposisiMasukHome({ setConfirm }) {
  const [statusFilter, setStatusFilter] = useState(null);
  const [folderFilter, setFolderFilter] = useState(null);
  const [followupDraft, setFollowupDraft] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [dispositionItems, setDispositionItems] = useState([
    ["DSP/2025/05/00021", "Evaluasi dokumen permohonan data", "Dewi Pimpinan", "Tinggi", "20 Mei 2025", "Dikirim"],
    ["DSP/2025/05/00020", "Siapkan laporan tindak lanjut rapat koordinasi", "Dewi Pimpinan", "Normal", "22 Mei 2025", "Diterima"],
    ["DSP/2025/05/00019", "Lengkapi bahan pendukung surat tugas", "Dewi Pimpinan", "Tinggi", "18 Mei 2025", "Ditindaklanjuti"],
    ["DSP/2025/05/00018", "Arsipkan dokumen undangan kegiatan", "Dewi Pimpinan", "Rendah", "Selesai", "Selesai"]
  ]);
  const summary = [
    ["Baru", String(dispositionItems.filter((row) => row[5] === "Dikirim").length), "Belum dibaca", "bell", "blue"],
    ["Diterima", String(dispositionItems.filter((row) => row[5] === "Diterima").length), "Sudah diterima", "mail", "purple"],
    ["Ditindaklanjuti", String(dispositionItems.filter((row) => row[5] === "Ditindaklanjuti").length), "Dalam pengerjaan", "clock", "orange"],
    ["Selesai", String(dispositionItems.filter((row) => row[5] === "Selesai").length), "Tindak lanjut selesai", "check", "green"]
  ];
  const statusFilterMap = { Baru: "Dikirim", Diterima: "Diterima", Ditindaklanjuti: "Ditindaklanjuti", Selesai: "Selesai" };
  const dispositionFolders = useMemo(() => {
    const counts = dispositionItems.reduce((acc, row) => {
      const jenis = row[1].includes("rapat") ? "Rapat Koordinasi" : row[1].includes("surat tugas") ? "Surat Tugas" : row[1].includes("undangan") ? "Surat Undangan" : "Surat Permohonan";
      acc[jenis] = (acc[jenis] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts);
  }, [dispositionItems]);
  const getDispositionFolder = (row) => (
    row[1].includes("rapat") ? "Rapat Koordinasi" : row[1].includes("surat tugas") ? "Surat Tugas" : row[1].includes("undangan") ? "Surat Undangan" : "Surat Permohonan"
  );
  const filteredDispositions = dispositionItems.filter((row) => {
    const matchesStatus = statusFilter ? row[5] === statusFilterMap[statusFilter] : true;
    const matchesFolder = folderFilter ? getDispositionFolder(row) === folderFilter : true;
    return matchesStatus && matchesFolder;
  });
  const openFollowup = (row = dispositionItems[0]) => {
    const [id, instruksi, pemberi, prioritas, deadline, status] = row;
    setSelectedDocument(null);
    setFollowupDraft({ id, instruksi, pemberi, prioritas, deadline, status });
  };
  const openDocument = (row) => {
    const [id, instruksi, pemberi, prioritas, deadline, status] = row;
    setFollowupDraft(null);
    setSelectedDocument({
      id,
      instruksi,
      pemberi,
      prioritas,
      deadline,
      status,
      nomor: id.replace("DSP", "SM"),
      jenis: instruksi.includes("rapat") ? "Notulen Rapat" : instruksi.includes("surat tugas") ? "Surat Tugas" : instruksi.includes("undangan") ? "Surat Undangan" : "Surat Permohonan",
      perihal: instruksi,
      catatan: `Mohon ditindaklanjuti sesuai instruksi pimpinan. Hasil pekerjaan dikirim melalui menu Tindak Lanjut pada disposisi ${id}.`
    });
  };
  const selectedDocumentSpec = selectedDocument ? {
    title: selectedDocument.jenis,
    filename: `${selectedDocument.nomor}.pdf`,
    number: selectedDocument.nomor,
    kind: selectedDocument.jenis,
    subject: selectedDocument.perihal,
    party: selectedDocument.pemberi,
    status: selectedDocument.status,
    summary: selectedDocument.catatan,
    meta: `Disposisi ${selectedDocument.id}`
  } : null;
  const markReceived = (id) => {
    setConfirm({
      title: "Tandai disposisi diterima?",
      body: `${id} akan ditandai sebagai diterima dan dicatat pada audit trail.`,
      onConfirm: () => {
        setDispositionItems((current) => current.map((row) => row[0] === id ? [...row.slice(0, 5), "Diterima"] : row));
        setFollowupDraft((current) => current?.id === id ? { ...current, status: "Diterima" } : current);
      }
    });
  };

  return (
    <section className="disposisiPage">
      <header className="ajuanHeader">
        <div>
          <h1>Disposisi Masuk</h1>
          <p>Terima instruksi dari pimpinan dan tindak lanjuti disposisi sesuai daftar.</p>
        </div>
      </header>

      <section className="ajuanStatusGrid" aria-label="Ringkasan Disposisi Masuk">
        {summary.map(([label, value, meta, icon, tone]) => (
          <button type="button" className={`ajuanStatusCard clickable ${tone}`} key={label} onClick={() => setStatusFilter(label)} aria-label={`Filter disposisi ${label}`}>
            <span className="icon3d">{iconSymbol(icon)}</span>
            <div><small>{label}</small><strong>{value}</strong><p>{meta}</p></div>
          </button>
        ))}
      </section>

      <section className="dispositionFolderPanel dispositionFolderPanelTop">
        <div className="dispositionFolderHeader">
          <h4>Folder Berdasarkan Jenis Disposisi</h4>
          <button type="button" onClick={() => setFolderFilter(null)}>Lihat semua folder <span aria-hidden="true">-&gt;</span></button>
        </div>
        <div className="dispositionFolderGrid">
          {dispositionFolders.map(([folder, count]) => (
            <button
              type="button"
              className={folderFilter === folder ? "dispositionFolderItem active" : "dispositionFolderItem"}
              key={folder}
              onClick={() => setFolderFilter(folder)}
            >
              <span><LineIcon name="folder" /></span>
              <strong>{folder}</strong>
              <small>{count}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="disposisiGrid">
        <article className="disposisiList">
          <div className="panelHeader">
            <h3>{statusFilter ? `Daftar Disposisi - ${statusFilter}` : "Daftar Disposisi dari Pimpinan"}</h3>
            <button onClick={() => setStatusFilter(null)}>Semua status <span aria-hidden="true">-&gt;</span></button>
          </div>
          <div className="disposisiCards">
            {filteredDispositions.map((row) => {
              const [id, instruksi, pemberi, prioritas, deadline, status] = row;
              return (
              <div className="disposisiCard" key={id}>
                <div className="disposisiCardTop">
                  <Status text={status} />
                </div>
                <h4>{instruksi}</h4>
                <p>{id} | Dari: {pemberi}</p>
                <div className="disposisiMeta"><span><LineIcon name="clock" /> Batas waktu: {deadline}</span></div>
                <div className="disposisiActions">
                  <button type="button" className="softBtn" onClick={() => openDocument(row)}>Lihat Dokumen</button>
                  <button type="button" className="softBtn" onClick={() => markReceived(id)} disabled={status !== "Dikirim"}>
                    {status === "Dikirim" ? "Tandai Diterima" : "Sudah Diterima"}
                  </button>
                  <button type="button" className="primaryBtn" onClick={() => openFollowup(row)}>Tindak Lanjut</button>
                </div>
              </div>
            );})}
          </div>
        </article>

        {selectedDocument ? (
          <aside className="followupPanel dispositionDocumentPanel">
            <div className="followupFormHeader">
              <span className="mail3d"><LineIcon name="doc" /></span>
              <button type="button" className="iconBtn" onClick={() => setSelectedDocument(null)} aria-label="Tutup dokumen"><LineIcon name="x" /></button>
            </div>
            <h3>Dokumen Terkait</h3>
            <div className="documentInfoRows">
              <span>Nomor Dokumen <b>{selectedDocument.nomor}</b></span>
              <span>Jenis Dokumen <b>{selectedDocument.jenis}</b></span>
              <span>Dari <b>{selectedDocument.pemberi}</b></span>
              <span>Batas Waktu <b>{selectedDocument.deadline}</b></span>
            </div>
            <div className="dispositionPreviewSheet">
              <small>{selectedDocument.id}</small>
              <h4>{selectedDocument.perihal}</h4>
              <p>{selectedDocument.catatan}</p>
              <div className="docLines"><i /><i /><i /><i /></div>
            </div>
            <DocumentOpenButtons spec={selectedDocumentSpec} onPreview={setPreviewDocument} />
          </aside>
        ) : followupDraft ? (
          <aside className="followupPanel followupFormPanel">
            <div className="followupFormHeader">
              <span className="mail3d"><LineIcon name="clipboard" /></span>
              <button type="button" className="iconBtn" onClick={() => setFollowupDraft(null)} aria-label="Tutup form tindak lanjut"><LineIcon name="x" /></button>
            </div>
            <h3>Kirim Hasil Tindak Lanjut</h3>
            <div className="followupSelected">
              <strong>{followupDraft.instruksi}</strong>
              <small>{followupDraft.id} | Dari: {followupDraft.pemberi}</small>
            </div>
            <form className="followupForm" onSubmit={(event) => {
              event.preventDefault();
              setConfirm({ title: "Kirim hasil tindak lanjut?", body: `Hasil tindak lanjut untuk ${followupDraft.id} akan dikirim ke pimpinan dan tercatat di audit trail.` });
            }}>
              <label>Status Penyelesaian
                <select defaultValue="Ditindaklanjuti">
                  <option>Ditindaklanjuti</option>
                  <option>Selesai</option>
                </select>
              </label>
              <label>Catatan Tindak Lanjut
                <textarea rows={5} placeholder="Tuliskan hasil pekerjaan, kendala, atau keterangan tindak lanjut." required />
              </label>
              <div className="uploadField">
                <strong>Lampiran Pendukung</strong>
                <UploadDropzone accept=".pdf,application/pdf" formats="PDF (Maks. 10 MB)" />
              </div>
              <button type="submit" className="primaryBtn"><LineIcon name="send" /> Kirim Hasil</button>
            </form>
          </aside>
        ) : (
          <aside className="followupPanel">
            <span className="mail3d"><LineIcon name="clipboard" /></span>
            <h3>Alur Tindak Lanjut</h3>
            <div className="followupSteps">
              {[
                ["Terima Disposisi", "Baca instruksi dan tandai diterima."],
                ["Kerjakan Instruksi", "Siapkan catatan atau dokumen pendukung."],
                ["Kirim Hasil", "Unggah lampiran jika ada dan kirim ke pimpinan."]
              ].map(([title, body], index) => (
                <div key={title}><b>{index + 1}</b><span><strong>{title}</strong><small>{body}</small></span></div>
              ))}
            </div>
          </aside>
        )}
      {previewDocument && <AttachmentPreviewModal attachment={previewDocument} detail={{ judul: "Dokumen Disposisi", keterangan: "Dokumen terkait disposisi." }} onClose={() => setPreviewDocument(null)} />}
      </section>
    </section>
  );
}

function PanelHeader({ title, action, onClick }) {
  return <div className="panelHeader"><h3>{title}</h3>{action && <button onClick={onClick}>{action} <span aria-hidden="true">-&gt;</span></button>}</div>;
}

function Sparkline({ tone }) {
  return (
    <svg className={`sparkline ${tone}`} viewBox="0 0 92 36" aria-hidden="true">
      <polyline points="2,28 16,28 30,24 42,12 54,18 66,8 78,6 90,2" />
    </svg>
  );
}

function iconSymbol(icon) {
  return <LineIcon name={icon} />;
}

function navIcon(item) {
  const icons = {
    Dashboard: "dashboard",
    "Ajuan Surat": "send",
    "Disposisi Masuk": "mail",
    "Konsep Surat": "doc",
    "Status Ajuan": "clipboard",
    "Ajuan Masuk": "inbox",
    Disposisi: "users",
    "Arsip Digital": "archive",
    Arsip: "archive",
    Notifikasi: "bell",
    Profil: "user",
    "Surat Masuk": "inbox",
    "Surat Keluar": "send",
    Laporan: "chart",
    Pengguna: "user",
    "Audit Trail": "clock",
    Backup: "upload",
    Approval: "check"
  };
  return <LineIcon name={icons[item] || "doc"} />;
}

function LineIcon({ name }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2" };
  const paths = {
    home: <><path d="m3 11 9-7 9 7" {...common} /><path d="M5 10v10h14V10" {...common} /><path d="M9 20v-6h6v6" {...common} /></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" {...common} /><rect x="14" y="3" width="7" height="7" rx="1" {...common} /><rect x="3" y="14" width="7" height="7" rx="1" {...common} /><rect x="14" y="14" width="7" height="7" rx="1" {...common} /></>,
    send: <><path d="M21 3 10 14" {...common} /><path d="m21 3-7 18-4-7-7-4 18-7Z" {...common} /></>,
    doc: <><path d="M6 3h8l4 4v14H6V3Z" {...common} /><path d="M14 3v5h5" {...common} /><path d="M9 13h6M9 17h6" {...common} /></>,
    inbox: <><path d="M4 15V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9" {...common} /><path d="M8 10h8" {...common} /><path d="M8 7h5" {...common} /><path d="M4 15h5l2 3h2l2-3h5v5H4v-5Z" {...common} /></>,
    clipboard: <><path d="M8 4h8l1 3H7l1-3Z" {...common} /><path d="M7 6H5v15h14V6h-2" {...common} /><path d="m8 14 3 3 5-7" {...common} /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" {...common} /><circle cx="9.5" cy="7" r="4" {...common} /><path d="M22 21v-2a4 4 0 0 0-3-3.87" {...common} /><path d="M16 3.13a4 4 0 0 1 0 7.75" {...common} /></>,
    folder: <><path d="M3 6h7l2 2h9v11H3V6Z" {...common} /></>,
    archive: <><path d="M4 7h16v13H4V7Z" {...common} /><path d="M3 4h18v3H3V4Z" {...common} /><path d="M9 11h6" {...common} /></>,
    upload: <><path d="M12 16V4" {...common} /><path d="m7 9 5-5 5 5" {...common} /><path d="M5 20h14" {...common} /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" {...common} /><path d="M10 21h4" {...common} /></>,
    user: <><circle cx="12" cy="8" r="4" {...common} /><path d="M4 21a8 8 0 0 1 16 0" {...common} /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" {...common} /><path d="M8 10V7a4 4 0 0 1 8 0v3" {...common} /><path d="M12 15v2" {...common} /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" {...common} /><path d="m3 7 9 7 9-7" {...common} /></>,
    plus: <><circle cx="12" cy="12" r="9" {...common} /><path d="M12 8v8M8 12h8" {...common} /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" {...common} /><path d="M4 5.5A2.5 2.5 0 0 1 6.5 8H20" {...common} /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" {...common} /><circle cx="12" cy="12" r="3" {...common} /></>,
    info: <><circle cx="12" cy="12" r="9" {...common} /><path d="M12 11v5M12 8h.01" {...common} /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" {...common} /><path d="M9 7V5h6v2M3 12h18" {...common} /></>,
    shield: <><path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" {...common} /><path d="m9 12 2 2 4-5" {...common} /></>,
    chart: <><path d="M4 19V5" {...common} /><path d="M4 19h17" {...common} /><path d="M8 16V9M13 16V6M18 16v-4" {...common} /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" {...common} /><path d="M16 3v4M8 3v4M3 10h18" {...common} /></>,
    clock: <><circle cx="12" cy="12" r="9" {...common} /><path d="M12 7v5l4 2" {...common} /></>,
    refresh: <><path d="M20 12a8 8 0 1 1-2.34-5.66" {...common} /><path d="M20 4v6h-6" {...common} /></>,
    check: <><circle cx="12" cy="12" r="9" {...common} /><path d="m8 12 3 3 5-6" {...common} /></>,
    settings: <><circle cx="12" cy="12" r="3" {...common} /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 1 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.06a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 1 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.06a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 1 1 4 0v.06a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.2.34.4.66.6 1H20a2 2 0 1 1 0 4h-.06a1.7 1.7 0 0 0-.54 1Z" {...common} /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...common} /><path d="M16 17l5-5-5-5" {...common} /><path d="M21 12H9" {...common} /></>,
    search: <><circle cx="11" cy="11" r="7" {...common} /><path d="m20 20-4-4" {...common} /></>,
    x: <><circle cx="12" cy="12" r="9" {...common} /><path d="m9 9 6 6M15 9l-6 6" {...common} /></>,
    edit: <><path d="M12 20h9" {...common} /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" {...common} /></>,
    arrowLeft: <><path d="M19 12H5" {...common} /><path d="m12 19-7-7 7-7" {...common} /></>,
    bank: <><path d="M4 10h16" {...common} /><path d="M5 10 12 5l7 5" {...common} /><path d="M6 10v8M10 10v8M14 10v8M18 10v8" {...common} /><path d="M4 18h16M3 21h18" {...common} /></>
    ,
    phone: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.91.32 1.8.6 2.65a2 2 0 0 1-.45 2.11L8 9.74a16 16 0 0 0 6 6l1.26-1.26a2 2 0 0 1 2.11-.45c.85.28 1.74.48 2.65.6A2 2 0 0 1 22 16.92Z" {...common} /></>,
    tag: <><path d="M20.59 13.41 12 22l-9-9V4h9l8.59 8.59a2 2 0 0 1 0 2.82Z" {...common} /><path d="M7.5 7.5h.01" {...common} /></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name] || paths.doc}</svg>;
}

function getDispositionDetail(row) {
  const [id, nomorSurat, tujuan, instruksi, status] = row;
  const detailMap = {
    "DSP-2026-021": {
      agenda: "AG-2026-041",
      pengirim: "Dinas Kominfo",
      perihal: "Permintaan data layanan",
      prioritas: "Segera",
      deadline: "20 Mei 2026",
      catatan: "Mohon ditelaah dan dikoordinasikan dengan unit terkait. Laporkan hasil tindak lanjut melalui sistem.",
      penerima: ["Bagian Umum", "Bagian Akademik"],
      riwayat: [
        ["12 Mei 2026, 10:25 WIB", "Pimpinan membuat disposisi"],
        ["12 Mei 2026, 10:27 WIB", "Notifikasi dikirim ke Bagian Umum"],
        ["12 Mei 2026, 10:35 WIB", "Disposisi menunggu penerimaan"]
      ]
    },
    "DSP-2026-020": {
      agenda: "AG-2026-038",
      pengirim: "Biro Keuangan",
      perihal: "Telaah anggaran kegiatan",
      prioritas: "Penting",
      deadline: "18 Mei 2026",
      catatan: "Telaah dokumen dan sampaikan ringkasan rekomendasi sebelum batas waktu.",
      penerima: ["Keuangan"],
      riwayat: [
        ["11 Mei 2026, 09:15 WIB", "Pimpinan membuat disposisi"],
        ["11 Mei 2026, 09:20 WIB", "Keuangan menerima disposisi"],
        ["12 Mei 2026, 08:10 WIB", "Keuangan mengirim tindak lanjut awal"]
      ]
    },
    "DSP-2026-019": {
      agenda: "AG-2026-034",
      pengirim: "Sekretariat",
      perihal: "Arsipkan dokumen kegiatan",
      prioritas: "Biasa",
      deadline: "16 Mei 2026",
      catatan: "Pastikan dokumen final masuk arsip digital dan dapat dicari melalui nomor surat.",
      penerima: ["Sekretariat"],
      riwayat: [
        ["10 Mei 2026, 13:00 WIB", "Pimpinan membuat disposisi"],
        ["10 Mei 2026, 14:30 WIB", "Sekretariat mengunggah hasil"],
        ["11 Mei 2026, 15:05 WIB", "Pimpinan menandai selesai"]
      ]
    }
  };
  return {
    id,
    nomorSurat,
    tujuan,
    instruksi,
    status,
    ...(detailMap[id] || {
      agenda: "AG-2026-041",
      pengirim: "-",
      perihal: instruksi,
      prioritas: "Penting",
      deadline: "20 Mei 2026",
      catatan: instruksi,
      penerima: [tujuan],
      riwayat: [["12 Mei 2026, 10:00 WIB", "Disposisi dibuat"]]
    })
  };
}

function getOutgoingLetterDetail(row, savedDetail = null) {
  const [nomor, jenis, tujuan, perihal, status] = row;
  const detailMap = {
    "SK-2026-018": {
      tanggal: "15 Mei 2026",
      penerima: "Seluruh Unit Internal",
      sifat: "Penting",
      penandatangan: "Kepala Bagian Umum",
      pembuat: "Rina Operator",
      ringkasan: "Surat edaran pembaruan SOP pengelolaan arsip digital untuk seluruh unit internal.",
      lampiran: [["Draft_SK-2026-018.pdf", "642 KB", "Diunggah 15 Mei 2026, 09:20 WIB"]],
      riwayat: [
        ["15 Mei 2026, 09:20 WIB", "Operator membuat draft surat keluar"],
        ["15 Mei 2026, 09:45 WIB", "Surat dikirim untuk approval pimpinan"],
        ["15 Mei 2026, 10:05 WIB", "Menunggu keputusan approval"]
      ]
    },
    "SK-2026-017": {
      tanggal: "14 Mei 2026",
      penerima: "PT Mitra Karya",
      sifat: "Biasa",
      penandatangan: "Dewi Pimpinan",
      pembuat: "Rina Operator",
      ringkasan: "Undangan rapat evaluasi triwulan bersama mitra kerja.",
      lampiran: [["Surat_Undangan_SK-2026-017.pdf", "518 KB", "Disetujui 14 Mei 2026, 15:10 WIB"]],
      riwayat: [
        ["14 Mei 2026, 10:10 WIB", "Operator membuat surat"],
        ["14 Mei 2026, 13:40 WIB", "Pimpinan menyetujui surat"],
        ["14 Mei 2026, 15:10 WIB", "Surat siap dikirim"]
      ]
    },
    "SK-2026-016": {
      tanggal: "13 Mei 2026",
      penerima: "Pegawai Lapangan",
      sifat: "Segera",
      penandatangan: "Kepala Bagian Umum",
      pembuat: "Rina Operator",
      ringkasan: "Surat tugas untuk pelaksanaan kegiatan lapangan.",
      lampiran: [["Surat_Tugas_SK-2026-016.pdf", "476 KB", "Dikirim 13 Mei 2026, 16:00 WIB"]],
      riwayat: [
        ["13 Mei 2026, 08:30 WIB", "Operator membuat surat tugas"],
        ["13 Mei 2026, 11:25 WIB", "Pimpinan menyetujui surat"],
        ["13 Mei 2026, 16:00 WIB", "Surat dikirim dan masuk arsip"]
      ]
    }
  };
  return {
    nomor,
    jenis,
    tujuan,
    perihal,
    status,
    ...(detailMap[nomor] || {
      tanggal: savedDetail?.tanggal || "15 Mei 2026",
      penerima: savedDetail?.penerima || tujuan,
      sifat: savedDetail?.sifat || "Biasa",
      penandatangan: savedDetail?.penandatangan || "Pimpinan",
      pembuat: savedDetail?.pembuat || "Operator",
      ringkasan: savedDetail?.ringkasan || perihal,
      lampiran: savedDetail?.lampiran?.length ? savedDetail.lampiran : [["Dokumen_Surat_Keluar.pdf", "512 KB", "Diunggah operator"]],
      riwayat: savedDetail?.riwayat?.length ? savedDetail.riwayat : [["15 Mei 2026, 09:00 WIB", "Data surat keluar dibuat"]]
    }),
    ...(savedDetail || {})
  };
}

function getAuditTrailDetail(row) {
  const [time, actor, module, activity, log] = row;
  if (log) {
    let payloadArr = [];
    if (log.payload) {
      try {
        if (typeof log.payload === "object") {
          payloadArr = Object.entries(log.payload).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
        } else {
          payloadArr = [String(log.payload)];
        }
      } catch (e) {
        payloadArr = ["Gagal mem-parse data payload"];
      }
    }
    
    return {
      time,
      actor,
      module,
      activity,
      id: log.id,
      date: new Date(log.created_at).toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }),
      ipAddress: log.ip_address || "127.0.0.1",
      device: log.user_agent || "Browser / Client",
      result: log.status || "success",
      target: log.module,
      description: log.activity,
      payload: payloadArr,
      notes: log.notes || "-",
      review_status: log.review_status || null,
      review_notes: log.review_notes || null,
      reviewed_at: log.reviewed_at ? new Date(log.reviewed_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : null,
      reviewed_by_name: log.reviewed_by_name || null
    };
  }

  const detailMap = {
    "10:42 WIB-Rina Operator": {
      id: "AUD-2026-0518-1042",
      date: "18 Mei 2026",
      ipAddress: "192.168.10.42",
      device: "Chrome 124 / Windows",
      result: "Berhasil",
      target: "AG-2026-041",
      description: "Operator meneruskan surat masuk ke portal pimpinan untuk proses review dan disposisi.",
      payload: ["Status lama: Diregistrasi", "Status baru: Diteruskan", "Notifikasi pimpinan dibuat"]
    },
    "10:21 WIB-Budi Santoso": {
      id: "AUD-2026-0518-1021",
      date: "18 Mei 2026",
      ipAddress: "192.168.10.18",
      device: "Edge 124 / Windows",
      result: "Berhasil",
      target: "AJ-2026-0007",
      description: "User mengirim ajuan surat tugas sehingga masuk antrean verifikasi operator.",
      payload: ["Status lama: Draft", "Status baru: Ajuan Baru", "Lampiran tervalidasi"]
    },
    "09:55 WIB-Admin Sistem": {
      id: "AUD-2026-0518-0955",
      date: "18 Mei 2026",
      ipAddress: "192.168.10.5",
      device: "Chrome 124 / Windows",
      result: "Berhasil",
      target: "USR-003",
      description: "Administrator mengubah status pengguna melalui modul manajemen user.",
      payload: ["Role: User", "Status akun diperbarui", "Perubahan dicatat untuk audit"]
    }
  };
  return {
    time,
    actor,
    module,
    activity,
    ...(detailMap[`${time}-${actor}`] || {
      id: "AUD-2026-0518-0000",
      date: "18 Mei 2026",
      ipAddress: "192.168.10.10",
      device: "Browser / Windows",
      result: "Berhasil",
      target: module,
      description: activity,
      payload: ["Aktivitas tercatat", "Tidak ada anomali"]
    })
  };
}

function ModuleView({
  view,
  query,
  setQuery,
  onSubmit,
  errors,
  setConfirm,
  userRows,
  auditRows,
  apiNotice,
  outgoingLetters,
  onCreateOutgoing,
  onUpdateOutgoing,
  onCreateUser,
  onUserDelete,
  onUserResetPassword,
  onAuditReviewSuccess
}) {
  const [openForms, setOpenForms] = useState({});
  const [dispositionAction, setDispositionAction] = useState(null);
  const [dispositionFolderFilter, setDispositionFolderFilter] = useState(null);
  const [outgoingAction, setOutgoingAction] = useState(null);
  const [auditAction, setAuditAction] = useState(null);
  const outgoingRows = outgoingLetters.map(outgoingLetterToRow);
  const sourceRows = view === "Pengguna" ? userRows : view === "Audit Trail" ? (auditRows || []) : view === "Surat Keluar" ? outgoingRows : (rows[view] || rows["Ajuan Surat"]);
  const dispositionFolders = useMemo(() => {
    if (view !== "Disposisi") return [];
    const counts = sourceRows.reduce((acc, row) => {
      const folder = row[2] || "Lainnya";
      acc[folder] = (acc[folder] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts);
  }, [sourceRows, view]);
  
  const data = useMemo(() => {
    return sourceRows.filter((row) => {
      const stringified = row.map(cell => {
        if (typeof cell === "object" && cell !== null) return "";
        return String(cell);
      }).join(" ");
      const matchesQuery = stringified.toLowerCase().includes(query.toLowerCase());
      const matchesDispositionFolder = view !== "Disposisi" || !dispositionFolderFilter || row[2] === dispositionFolderFilter;
      return matchesQuery && matchesDispositionFolder;
    });
  }, [query, sourceRows, view, dispositionFolderFilter]);
  const readOnlyList = view === "Disposisi" || view === "Audit Trail";
  const formVisible = !readOnlyList && view !== "Pengguna" && (view !== "Surat Keluar" || openForms[view]);
  
  const handleAddData = () => {
    if (view === "Pengguna") {
      setOpenForms((current) => ({ ...current, [view]: true }));
      return;
    }
    if (view === "Surat Keluar") {
      setOpenForms((current) => ({ ...current, [view]: true }));
      return;
    }
    setConfirm({ title: "Tambah data?", body: "Form siap digunakan untuk draft baru." });
  };

  if (view === "Surat Keluar" && openForms[view]) {
    return (
      <OutgoingLetterForm
        onCancel={() => setOpenForms((current) => ({ ...current, [view]: false }))}
        setConfirm={setConfirm}
        onCreateOutgoing={(letter) => {
          onCreateOutgoing(letter);
          setOpenForms((current) => ({ ...current, [view]: false }));
        }}
      />
    );
  }

  if (view === "Pengguna" && openForms[view]) {
    return (
      <AdminUserCreate
        onCancel={() => setOpenForms((current) => ({ ...current, [view]: false }))}
        setConfirm={setConfirm}
        onCreateUser={async (user) => {
          const saved = await onCreateUser(user);
          if (saved !== false) setOpenForms((current) => ({ ...current, [view]: false }));
        }}
      />
    );
  }

  if (view === "Disposisi" && dispositionAction) {
    const detail = getDispositionDetail(dispositionAction.row);
    if (dispositionAction.mode === "detail") {
      return <PimpinanDispositionDetail detail={detail} onBack={() => setDispositionAction(null)} />;
    }
    return <PimpinanDispositionProcess detail={detail} onBack={() => setDispositionAction(null)} setConfirm={setConfirm} />;
  }

  if (view === "Surat Keluar" && outgoingAction) {
    const detail = getOutgoingLetterDetail(
      outgoingAction.row,
      outgoingLetters.find((letter) => letter.nomor === outgoingAction.row[0])
    );
    if (outgoingAction.mode === "detail") {
      return (
        <OutgoingLetterDetail
          detail={detail}
          onBack={() => setOutgoingAction(null)}
          onRevise={() => setOutgoingAction({ mode: "process", row: outgoingAction.row })}
          onNumbering={() => setOutgoingAction({ mode: "numbering", row: outgoingAction.row })}
        />
      );
    }
    if (outgoingAction.mode === "numbering") {
      return <OutgoingLetterProcess detail={detail} onBack={() => setOutgoingAction(null)} setConfirm={setConfirm} onUpdateOutgoing={onUpdateOutgoing} />;
    }
    return <OutgoingLetterProcess detail={detail} onBack={() => setOutgoingAction(null)} setConfirm={setConfirm} onUpdateOutgoing={onUpdateOutgoing} />;
  }

  if (view === "Audit Trail" && auditAction) {
    const detail = getAuditTrailDetail(auditAction.row);
    if (auditAction.mode === "detail") {
      return <AuditTrailDetail detail={detail} onBack={() => setAuditAction(null)} />;
    }
    return (
      <AuditTrailReview
        detail={detail}
        onBack={() => setAuditAction(null)}
        setConfirm={setConfirm}
        onSaveSuccess={() => {
          onAuditReviewSuccess?.();
          setAuditAction(null);
        }}
      />
    );
  }

  if (view === "Surat Keluar") {
    return (
      <OperatorOutgoingList
        query={query}
        setQuery={setQuery}
        outgoingLetters={outgoingLetters}
        onCreate={() => setOpenForms((current) => ({ ...current, [view]: true }))}
        onDetail={(row) => setOutgoingAction({ mode: "detail", row })}
        onProcess={(row) => setOutgoingAction({ mode: row[4] === "Disetujui" ? "numbering" : "process", row })}
      />
    );
  }

  return (
    <section className={formVisible ? "previewLayout" : "previewLayout singleColumn"}>
      {view === "Disposisi" && (
        <section className="dispositionFolderPanel dispositionFolderPanelTop">
          <div className="dispositionFolderHeader">
            <h4>Folder Berdasarkan Tujuan Disposisi</h4>
            <button type="button" onClick={() => setDispositionFolderFilter(null)}>Lihat semua folder <span aria-hidden="true">-&gt;</span></button>
          </div>
          <div className="dispositionFolderGrid">
            {dispositionFolders.map(([folder, count]) => (
              <button
                type="button"
                className={dispositionFolderFilter === folder ? "dispositionFolderItem active" : "dispositionFolderItem"}
                key={folder}
                onClick={() => setDispositionFolderFilter(folder)}
              >
                <span><LineIcon name="folder" /></span>
                <strong>{folder}</strong>
                <small>{count}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      <article className="tableShell">
        <div className="rowBetween">
          <h3>{view === "Disposisi" ? "Monitoring Disposisi" : view}</h3>
          {!readOnlyList && <button className="primaryBtn" onClick={handleAddData}>{view === "Pengguna" ? "Add User" : "Tambah Data"}</button>}
        </div>
        {apiNotice && (view === "Pengguna" || view === "Audit Trail") && <small className="fieldError">{apiNotice}</small>}
        {view !== "Audit Trail" && <Filters query={query} setQuery={setQuery} />}
        <DataTable
          heads={tableHeads[view]}
          data={data}
          setConfirm={setConfirm}
          view={view}
          onDetail={view === "Disposisi" ? (row) => setDispositionAction({ mode: "detail", row }) : view === "Surat Keluar" ? (row) => setOutgoingAction({ mode: "detail", row }) : null}
          onProcess={view === "Disposisi" ? (row) => setDispositionAction({ mode: "process", row }) : view === "Surat Keluar" ? (row) => setOutgoingAction({ mode: "process", row }) : null}
          onAuditDetail={view === "Audit Trail" ? (row) => setAuditAction({ mode: "detail", row }) : null}
          onAuditReview={view === "Audit Trail" ? (row) => setAuditAction({ mode: "review", row }) : null}
          onUserDelete={onUserDelete}
          onUserResetPassword={onUserResetPassword}
        />
      </article>
      {formVisible && <FormPanel view={view} errors={errors} onSubmit={onSubmit} onCancel={view === "Surat Keluar" ? () => setOpenForms((current) => ({ ...current, [view]: false })) : null} />}
    </section>
  );
}

function OperatorOutgoingList({ query, setQuery, outgoingLetters, onCreate, onDetail, onProcess }) {
  const [letterType, setLetterType] = useState("Semua Jenis");
  const [status, setStatus] = useState("Semua Status");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const displayRows = outgoingLetters.map((letter) => ({
    ...letter,
    tanggal: getOutgoingDisplayDate(letter)
  }));
  const letterTypes = ["Semua Jenis", ...Array.from(new Set(displayRows.map((letter) => letter.jenis)))];
  const statuses = ["Semua Status", ...Array.from(new Set(displayRows.map((letter) => letter.status)))];
  const filteredRows = displayRows.filter((letter) => {
    const matchesQuery = [letter.nomor, letter.jenis, letter.tujuan, letter.perihal]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesType = letterType === "Semua Jenis" || letter.jenis === letterType;
    const matchesStatus = status === "Semua Status" || letter.status === status;
    return matchesQuery && matchesType && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const pageItems = getPaginationItems(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [query, letterType, status, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section className="operatorOutgoingPage">
      <div className="operatorOutgoingToolbar">
        <label className="operatorSearchField" aria-label="Cari surat keluar">
          <LineIcon name="search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nomor surat, tujuan, atau perihal..."
          />
        </label>
        <label className="operatorDateField" aria-label="Filter tanggal">
          <LineIcon name="calendar" />
          <input type="date" />
        </label>
        <select value={letterType} onChange={(event) => setLetterType(event.target.value)} aria-label="Filter jenis surat">
          {letterTypes.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter status">
          {statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button type="button" className="primaryBtn operatorCreateBtn" onClick={onCreate}><LineIcon name="plus" /> Buat Surat Keluar</button>
      </div>

      <article className="ajuanHistory operatorOutgoingCard">
        <div className="ajuanListHeader">
          <div>
            <h3>Daftar Surat Keluar</h3>
            <p>Pantau surat keluar berdasarkan nomor, jenis, perihal, tanggal, atau status.</p>
          </div>
        </div>
        <div className="operatorOutgoingTableWrap">
          <table className="dashboardTable ajuanHistoryTable operatorOutgoingTable">
            <thead>
              <tr>
                {["No", "Nomor Surat", "Jenis Surat", "Perihal", "Tanggal Ajuan", "Status", "Aksi"].map((head) => <th key={head}>{head}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((letter, index) => {
                const row = outgoingLetterToRow(letter);
                return (
                  <tr key={letter.nomor}>
                    <td>{(page - 1) * pageSize + index + 1}</td>
                    <td>
                      <button type="button" className="outgoingNumberLink" onClick={() => onDetail(row)}>
                        {letter.nomorFinal || letter.nomor}
                      </button>
                    </td>
                    <td>{letter.jenis}</td>
                    <td>{letter.perihal}</td>
                    <td>{letter.tanggal}</td>
                    <td><Status text={letter.status} /></td>
                    <td>
                      <div className="operatorOutgoingActions">
                        <button type="button" aria-label={`Lihat ${letter.nomor}`} onClick={() => onDetail(row)}><LineIcon name="eye" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredRows.length === 0 && (
            <div className="operatorOutgoingEmpty">Tidak ada surat keluar yang cocok dengan filter.</div>
          )}
        </div>
        <div className="archivePagination operatorOutgoingListFooter" aria-label="Navigasi halaman surat keluar">
          <div className="archivePageControls">
            <button type="button" className="archivePageNav" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Halaman sebelumnya">&lt;</button>
            {pageItems.map((item, index) => (
              item === "ellipsis"
                ? <span className="archivePageEllipsis" key={`ellipsis-${index}`}>...</span>
                : (
                  <button
                    type="button"
                    className={item === page ? "archivePageNumber active" : "archivePageNumber"}
                    key={item}
                    onClick={() => setPage(item)}
                    aria-label={`Halaman ${item}`}
                    aria-current={item === page ? "page" : undefined}
                  >
                    {item}
                  </button>
                )
            ))}
            <button type="button" className="archivePageNav" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Halaman berikutnya">&gt;</button>
          </div>
          <div className="archivePaginationRight">
            <label className="archivePageSize">
              Tampilkan
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </label>
            <div className="archivePageInfo">
              <span>dari {filteredRows.length} data</span>
            </div>
          </div>
        </div>
      </article>

      <nav className="operatorOutgoingPagination" aria-label="Pagination surat keluar">
        <button type="button" className="operatorPageNav" aria-label="Halaman sebelumnya">‹</button>
        {[1, 2, 3, 4].map((page) => (
          <button type="button" key={page} className={`operatorPageNumber${page === 1 ? " active" : ""}`}>{page}</button>
        ))}
        <span>...</span>
        <button type="button" className="operatorPageNumber">8</button>
        <button type="button" className="operatorPageNav" aria-label="Halaman berikutnya">›</button>
      </nav>
    </section>
  );
}

function AdminUserCreate({ onCancel, onCreateUser }) {
  function saveUser(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const username = String(form.get("username") || "").trim();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "").trim();
    const role = String(form.get("role") || "").trim();
    const status = String(form.get("status") || "Aktif").trim();
    const unit = String(form.get("unit") || "").trim();
    const jabatan = String(form.get("jabatan") || "").trim();
    if (!name || !username || !password || !role) return;
    onCreateUser({ name, username, email, password, role, status, unit, jabatan });
  }

  return (
    <section className="adminUserCreatePage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onCancel}><LineIcon name="arrowLeft" /> Kembali ke Daftar Pengguna</button>
          <h1>Add User</h1>
          <p>Tambahkan akun pengguna baru dan atur role sesuai hak akses sistem.</p>
        </div>
      </header>

      <section className="adminUserCreateGrid">
        <form className="adminUserForm" onSubmit={saveUser}>
          <article className="dispositionFormCard">
            <h2><LineIcon name="user" /> Informasi Akun</h2>
            <div className="adminUserFields">
              <label>Nama Lengkap <span>*</span>
                <input name="name" placeholder="Masukkan nama lengkap" required />
              </label>
              <label>Username <span>*</span>
                <input name="username" placeholder="Contoh: operator2" required />
              </label>
              <label>Email
                <input name="email" type="email" placeholder="nama@instansi.ac.id" />
              </label>
              <label>Password Awal <span>*</span>
                <input name="password" type="password" placeholder="Masukkan password awal" required />
              </label>
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="shield" /> Role dan Unit Kerja</h2>
            <div className="adminUserFields">
              <label>Role <span>*</span>
                <select name="role" defaultValue="" required>
                  <option value="" disabled>Pilih role</option>
                  <option>Administrator</option>
                  <option>Operator</option>
                  <option>Pimpinan</option>
                  <option>User</option>
                </select>
              </label>
              <label>Status <span>*</span>
                <select name="status" defaultValue="Aktif">
                  <option>Aktif</option>
                  <option>Nonaktif</option>
                </select>
              </label>
              <label>Jabatan
                <input name="jabatan" placeholder="Contoh: Staf Administrasi" />
              </label>
              <label>Unit Kerja
                <input name="unit" placeholder="Contoh: Tata Usaha" />
              </label>
            </div>
          </article>

          <div className="dispositionSubmitBar">
            <button type="button" className="ghostBtn" onClick={onCancel}>Batal</button>
            <button type="submit" className="primaryBtn saveUserBtn"><LineIcon name="check" /> Simpan User</button>
          </div>
        </form>

        <aside className="adminUserGuide">
          <span><LineIcon name="shield" /></span>
          <h3>Panduan Role</h3>
          {[
            ["Administrator", "Mengelola pengguna, audit trail, backup, dan konfigurasi."],
            ["Operator", "Registrasi surat, proses ajuan, dan pengelolaan surat keluar."],
            ["Pimpinan", "Review surat, approval, disposisi, dan monitoring tindak lanjut."],
            ["User", "Ajuan surat, menerima disposisi, dan akses arsip sesuai izin."]
          ].map(([title, body]) => (
            <p key={title}><strong>{title}</strong><small>{body}</small></p>
          ))}
        </aside>
      </section>
    </section>
  );
}

function AuditTrailDetail({ detail, onBack }) {
  return (
    <section className="incomingPage dispositionDetailPage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Audit Trail</button>
          <h1>Detail Audit Trail</h1>
          <p>Informasi lengkap aktivitas sistem untuk pemeriksaan administrator.</p>
        </div>
        <Status text={detail.result} />
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="clock" /> Identitas Log</h2>
              <span className="priority">{detail.id}</span>
            </div>
            <div className="dispositionSourceRows">
              <DetailItem icon="calendar" label="Tanggal" value={detail.date} />
              <DetailItem icon="clock" label="Waktu" value={detail.time} />
              <DetailItem icon="user" label="User" value={detail.actor} />
              <DetailItem icon="archive" label="Modul" value={detail.module} />
              <DetailItem icon="info" label="Target Data" value={detail.target} />
              <DetailItem icon="shield" label="Hasil" value={detail.result} />
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="clipboard" /> Aktivitas</h2>
            <div className="dispositionNoteBox">
              <small>Aktivitas tercatat</small>
              <strong>{detail.activity}</strong>
              <p>{detail.description}</p>
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="info" /> Perubahan Data</h2>
            <div className="detailPillList">
              {detail.payload.map((item) => <span key={item}>{item}</span>)}
            </div>
          </article>
        </div>

        <aside className="dispositionPreview">
          <h3>Konteks Akses</h3>
          <div className="backupStatusRows">
            <span>IP Address <b>{detail.ipAddress}</b></span>
            <span>Perangkat <b>{detail.device}</b></span>
            <span>Zona Waktu <b>Asia/Jakarta</b></span>
          </div>
          <div className="followupResultBox">
            <span><LineIcon name="shield" /></span>
            <strong>Log terlindungi</strong>
            <p>Audit trail bersifat read-only dan dipakai untuk pelacakan aktivitas penting sistem.</p>
          </div>
        </aside>
      </section>
    </section>
  );
}

function AuditTrailReview({ detail, onBack, setConfirm, onSaveSuccess }) {
  const [status, setStatus] = useState(detail.review_status || "valid");
  const [notes, setNotes] = useState(detail.review_notes || "");

  const handleSave = async () => {
    try {
      await apiFetch(`/audit-logs/${detail.id}/review`, {
        method: "PUT",
        body: JSON.stringify({ status, notes })
      });
      onSaveSuccess?.();
    } catch (e) {
      alert("Gagal menyimpan tinjauan audit: " + e.message);
    }
  };

  const confirmSave = () => {
    setConfirm({
      title: "Simpan tinjauan audit?",
      body: `${detail.id} akan ditandai sudah diperiksa dan catatan administrator dicatat di audit trail.`,
      onConfirm: handleSave
    });
  };

  return (
    <section className="incomingPage dispositionDetailPage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Audit Trail</button>
          <h1>Proses Audit Trail</h1>
          <p>Tinjau aktivitas, beri catatan administrator, dan tandai log sebagai sudah diperiksa.</p>
        </div>
        <Status text={detail.result} />
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="shield" /> Log yang Ditinjau</h2>
              <span className="priority">{detail.module}</span>
            </div>
            <div className="dispositionSourceRows">
              <DetailItem icon="info" label="ID Audit" value={detail.id} />
              <DetailItem icon="user" label="User" value={detail.actor} />
              <DetailItem icon="clock" label="Waktu" value={`${detail.date}, ${detail.time}`} />
              <DetailItem icon="archive" label="Target Data" value={detail.target} />
            </div>
          </article>

          <form className="dispositionForm" onSubmit={(event) => event.preventDefault()}>
            <section className="dispositionFormCard">
              <h2><LineIcon name="clipboard" /> Catatan Pemeriksaan</h2>
              <div className="dispositionNoteBox">
                <small>Aktivitas</small>
                <strong>{detail.activity}</strong>
                <p>{detail.description}</p>
                {detail.payload && detail.payload.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <small style={{ display: "block", marginBottom: "4px" }}>Payload Details:</small>
                    <ul style={{ paddingLeft: "16px", margin: 0, fontSize: "0.9em", color: "#666" }}>
                      {detail.payload.map((p, idx) => <li key={idx}>{p}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <label className="dispositionTextArea">
                Catatan Administrator
                <textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tuliskan hasil pemeriksaan, anomali, atau tindak lanjut keamanan bila diperlukan."
                />
              </label>
            </section>

            <section className="dispositionFormCard dispositionMetaForm">
              <label>
                Status Pemeriksaan
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="valid">Valid</option>
                  <option value="perlu_tindak_lanjut">Perlu Tindak Lanjut</option>
                  <option value="anomali">Anomali</option>
                </select>
              </label>
              <label>
                Reviewer
                <input value={detail.reviewed_by_name || detail.actor || "Admin Sistem"} readOnly />
              </label>
            </section>

            {detail.reviewed_at && (
              <section className="dispositionFormCard">
                <h2><LineIcon name="check" /> Riwayat Review</h2>
                <p style={{ margin: 0, fontSize: "0.95em" }}>
                  Ditinjau oleh <strong>{detail.reviewed_by_name || "Admin"}</strong> pada {detail.reviewed_at}
                </p>
              </section>
            )}

            <div className="dispositionSubmitBar">
              <button type="button" className="softBtn" onClick={() => setConfirm({ title: "Export bukti audit?", body: `Ringkasan ${detail.id} akan dibuat untuk kebutuhan pemeriksaan.` })}><LineIcon name="upload" /> Export Bukti</button>
              <button type="button" className="primaryBtn" onClick={confirmSave}><LineIcon name="check" /> Simpan Tinjauan</button>
            </div>
          </form>
        </div>

        <aside className="dispositionPreview">
          <h3>Checklist Audit</h3>
          <div className="dispositionFlow">
            {["Cek user dan waktu", "Validasi modul target", "Tinjau perubahan data", "Simpan catatan"].map((item, index) => (
              <p key={item}><b>{index + 1}</b>{item}</p>
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}

function PimpinanDispositionDetail({ detail, onBack }) {
  return (
    <section className="incomingPage dispositionDetailPage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Monitoring Disposisi</button>
          <h1>Detail Disposisi</h1>
          <p>Ringkasan surat sumber, instruksi pimpinan, penerima, dan riwayat proses disposisi.</p>
        </div>
        <Status text={detail.status} />
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="clipboard" /> Informasi Disposisi</h2>
              <span className={detail.prioritas === "Segera" ? "priority high" : "priority"}>{detail.prioritas}</span>
            </div>
            <div className="dispositionSourceRows">
              <DetailItem icon="info" label="ID Disposisi" value={detail.id} />
              <DetailItem icon="doc" label="Nomor Surat" value={detail.nomorSurat} />
              <DetailItem icon="calendar" label="Nomor Agenda" value={detail.agenda} />
              <DetailItem icon="user" label="Pengirim" value={detail.pengirim} />
              <DetailItem icon="mail" label="Perihal" value={detail.perihal} />
              <DetailItem icon="clock" label="Batas Waktu" value={detail.deadline} />
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="users" /> Tujuan dan Instruksi</h2>
            <div className="detailPillList">
              {detail.penerima.map((item) => <span key={item}>{item}</span>)}
            </div>
            <div className="dispositionNoteBox">
              <small>Instruksi</small>
              <strong>{detail.instruksi}</strong>
              <p>{detail.catatan}</p>
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="clock" /> Riwayat Aktivitas</h2>
            <div className="dispositionTimeline">
              {detail.riwayat.map(([time, activity]) => (
                <p key={`${time}-${activity}`}><i /><span>{time}</span><strong>{activity}</strong></p>
              ))}
            </div>
          </article>
        </div>

        <aside className="dispositionPreview">
          <h3>Preview Surat</h3>
          <div className="documentFrame">
            <div className="documentPage">
              <h4>SURAT MASUK</h4>
              <p>{detail.agenda} | {detail.nomorSurat}</p>
              <div className="docLines"><i /><i /><i /><i /></div>
            </div>
          </div>
          <div className="dispositionFlow">
            <h3>Status Proses</h3>
            {["Dikirim", "Diterima", "Ditindaklanjuti", "Selesai"].map((item, index) => (
              <p key={item} className={item === detail.status ? "active" : ""}><b>{index + 1}</b>{item}</p>
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}

function PimpinanDispositionProcess({ detail, onBack, setConfirm }) {
  return (
    <section className="incomingPage dispositionDetailPage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Monitoring Disposisi</button>
          <h1>Proses Disposisi</h1>
          <p>Gunakan layar ini untuk memantau tindak lanjut, memberi catatan, dan memperbarui status disposisi.</p>
        </div>
        <Status text={detail.status} />
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="mail" /> Surat Sumber</h2>
              <span className={detail.prioritas === "Segera" ? "priority high" : "priority"}>{detail.prioritas}</span>
            </div>
            <div className="dispositionSourceRows">
              <DetailItem icon="info" label="ID Disposisi" value={detail.id} />
              <DetailItem icon="doc" label="Nomor Surat" value={detail.nomorSurat} />
              <DetailItem icon="users" label="Tujuan" value={detail.tujuan} />
              <DetailItem icon="clock" label="Batas Waktu" value={detail.deadline} />
            </div>
          </article>

          <form className="dispositionForm" onSubmit={(event) => event.preventDefault()}>
            <section className="dispositionFormCard">
              <h2><LineIcon name="clipboard" /> Tindak Lanjut</h2>
              <div className="dispositionNoteBox">
                <small>Instruksi awal</small>
                <strong>{detail.instruksi}</strong>
                <p>{detail.catatan}</p>
              </div>
              <label className="dispositionTextArea">
                Catatan Pimpinan
                <textarea rows={5} placeholder="Tuliskan catatan evaluasi, koreksi, atau arahan tambahan untuk penerima disposisi." />
              </label>
            </section>

            <section className="dispositionFormCard dispositionMetaForm">
              <label>
                Status Proses
                <select defaultValue={detail.status}>
                  <option>Dikirim</option>
                  <option>Diterima</option>
                  <option>Ditindaklanjuti</option>
                  <option>Selesai</option>
                </select>
              </label>
              <label>
                Batas Waktu
                <input type="date" defaultValue="2026-05-20" />
              </label>
              <label>
                Prioritas
                <select defaultValue={detail.prioritas.toLowerCase()}>
                  <option value="biasa">Biasa</option>
                  <option value="penting">Penting</option>
                  <option value="segera">Segera</option>
                </select>
              </label>
            </section>

            <div className="dispositionSubmitBar">
              <button type="button" className="softBtn" onClick={() => setConfirm({ title: "Kirim pengingat?", body: `Pengingat tindak lanjut untuk ${detail.id} akan dikirim ke ${detail.tujuan}.` })}><LineIcon name="bell" /> Kirim Pengingat</button>
              <button type="button" className="primaryBtn" onClick={() => setConfirm({ title: "Simpan proses disposisi?", body: `Status dan catatan ${detail.id} akan diperbarui, notifikasi dikirim, dan audit trail dicatat.` })}><LineIcon name="check" /> Simpan Proses</button>
            </div>
          </form>
        </div>

        <aside className="dispositionPreview">
          <h3>Hasil Tindak Lanjut</h3>
          <div className="followupResultBox">
            <span><LineIcon name="upload" /></span>
            <strong>Laporan tindak lanjut belum final</strong>
            <p>Penerima disposisi dapat mengunggah bukti atau laporan. Pimpinan meninjau hasilnya sebelum status ditutup.</p>
          </div>
          <div className="dispositionFlow">
            <h3>Alur Proses</h3>
            {["Review hasil", "Beri catatan", "Simpan status", "Notifikasi penerima"].map((item, index) => (
              <p key={item}><b>{index + 1}</b>{item}</p>
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}

function Filters({ query, setQuery }) {
  return (
    <div className="toolbar">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor, perihal, pengirim..." />
      <input type="date" />
      <select><option>Semua Jenis</option><option>Surat Undangan</option><option>Surat Tugas</option></select>
      <select><option>Semua Status</option><option>Diproses</option><option>Disetujui</option><option>Selesai</option></select>
    </div>
  );
}

function DataTable({
  heads,
  data,
  setConfirm,
  view,
  onDetail,
  onProcess,
  onAuditDetail,
  onAuditReview,
  onUserDelete,
  onUserResetPassword
}) {
  return (
    <>
      <div className="tableScroll">
        <table className="approvalTable">
          <thead><tr>{heads.map((head) => <th key={head}>{head}</th>)}<th>Aksi</th></tr></thead>
          <tbody>
            {data.map((row) => {
              const displayCells = row.slice(0, heads.length);
              return (
                <tr key={row[0]}>
                  {displayCells.map((cell, index) => (
                    <td key={`${row[0]}-${index}`}>
                      {index === heads.length - 1 && view !== "Audit Trail" ? (
                        <Status text={cell} />
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                  <td>
                    {view === "Pengguna" ? (
                      <div className="actions userActions">
                        <button
                          className="dangerSoftBtn"
                          onClick={() =>
                            setConfirm({
                              title: "Hapus pengguna?",
                              body: `${row[1]} akan dinonaktifkan menggunakan soft delete dan tidak dapat login.`,
                              onConfirm: () => onUserDelete?.(row[0], row[1])
                            })
                          }
                        >
                          Hapus
                        </button>
                        <button
                          className="softBtn"
                          onClick={() =>
                            setConfirm({
                              title: "Reset password?",
                              body: `Password awal baru untuk ${row[1]} akan dibuat dan aktivitas tercatat di audit trail.`,
                              onConfirm: () => onUserResetPassword?.(row[0], row[1])
                            })
                          }
                        >
                          Reset Password
                        </button>
                      </div>
                    ) : view === "Audit Trail" ? (
                      <div className="actions">
                        <button className="softBtn" onClick={() => onAuditDetail ? onAuditDetail(row) : setConfirm({ title: "Buka detail audit?", body: "Detail audit berisi waktu, user, modul, target, perangkat, dan perubahan data." })}>Detail</button>
                        <button className="softBtn" onClick={() => onAuditReview ? onAuditReview(row) : setConfirm({ title: "Tinjau audit?", body: "Log audit akan ditinjau dan diberi catatan administrator." })}>Proses</button>
                      </div>
                    ) : (
                      <div className="actions">
                        <button className="softBtn" onClick={() => onDetail ? onDetail(row) : setConfirm({ title: "Buka detail?", body: "Detail berisi preview dokumen, status proses, dan riwayat aktivitas." })}>Detail</button>
                        <button className="softBtn" onClick={() => onProcess ? onProcess(row) : setConfirm({ title: "Proses data?", body: "Status akan diperbarui, notifikasi dikirim, dan audit trail dicatat." })}>Proses</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pagination"><button className="ghostBtn">Sebelumnya</button><span>Halaman 1 dari 4</span><button className="ghostBtn">Berikutnya</button></div>
    </>
  );
}

function FormPanel({ view, errors, onSubmit, onCancel }) {
  const isDisposition = view === "Disposisi";
  return (
    <aside className="formPanel">
      <h3>{isDisposition ? "Buat Disposisi" : `Form ${view}`}</h3>
      <p className="muted">Validasi wajib aktif. Upload dokumen bersifat opsional untuk lampiran pendukung. Arsip dibuat otomatis saat proses selesai.</p>
      <form onSubmit={onSubmit} noValidate>
        <Field label={isDisposition ? "Tujuan Disposisi" : "Jenis Surat"} error={errors.jenis}>
          <select name="jenis"><option value="">Pilih data</option><option>Surat Undangan</option><option>Surat Tugas</option><option>Surat Edaran</option></select>
        </Field>
        <Field label={isDisposition ? "Instruksi" : "Perihal"} error={errors.perihal}>
          <textarea name="perihal" rows={3} placeholder="Isi ringkas dan jelas" />
        </Field>
        <div className="fieldBlock">
          <UploadDropzone label="Upload Dokumen Pendukung (Opsional)" name="file" accept=".pdf,application/pdf" formats="PDF (Maks. 10 MB)" />
          {errors.file && <small className="fieldError">{errors.file}</small>}
        </div>
        <div className="actions">
          {onCancel && <button type="button" className="ghostBtn" onClick={onCancel}>Batal</button>}
          <button className="primaryBtn">{isDisposition ? "Kirim Disposisi" : "Simpan"}</button>
        </div>
      </form>
    </aside>
  );
}

function OutgoingLetterForm({ onCancel, setConfirm, onCreateOutgoing }) {
  const [summaryLength, setSummaryLength] = useState(0);
  const [formErrors, setFormErrors] = useState({});
  const [savingIntent, setSavingIntent] = useState("");

  async function saveOutgoingLetter(form, intent) {
    const formData = new FormData(form);
    const file = formData.get("document");
    const fileError = file?.name ? validateUploadFile(file) : "";
    const draftNumber = generateOutgoingDraftNumber();
    const payload = {
      nomor: draftNumber,
      nomorFinal: "",
      tanggalInput: String(formData.get("letterDate") || "").trim(),
      jenis: String(formData.get("letterType") || "").trim(),
      tujuan: String(formData.get("destinationType") || "").trim(),
      penerima: String(formData.get("recipient") || "").trim(),
      perihal: String(formData.get("subject") || "").trim(),
      sifat: String(formData.get("priority") || "Biasa").trim(),
      ringkasan: String(formData.get("summary") || "").trim()
    };

    const nextErrors = {};
    if (!payload.tanggalInput) nextErrors.letterDate = "Tanggal surat wajib diisi.";
    if (!payload.jenis) nextErrors.letterType = "Jenis surat wajib dipilih.";
    if (!payload.tujuan) nextErrors.destinationType = "Tujuan surat wajib dipilih.";
    if (!payload.penerima) nextErrors.recipient = "Instansi atau penerima wajib diisi.";
    if (!payload.perihal) nextErrors.subject = "Perihal wajib diisi.";
    if (fileError) nextErrors.document = fileError;
    if (!file?.name) nextErrors.document = "Dokumen surat wajib diunggah sebelum dikirim.";

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setConfirm({
        title: "Data surat keluar belum lengkap",
        body: Object.values(nextErrors).join(" ")
      });
      return;
    }

    setSavingIntent(intent);
    try {
      let attachment = null;
      if (file?.name) {
        const storageKey = makeAttachmentKey("outgoing", payload.nomor, file);
        const dataUrl = await readFileAsDataUrl(file);
        await saveAttachmentPayload(storageKey, dataUrl);
        attachment = [file.name, formatFileSize(file.size), `Diunggah ${formatJakartaInputDate(payload.tanggalInput)}`, dataUrl, file.type, storageKey];
      }
      onCreateOutgoing({
        ...payload,
        tanggal: formatJakartaInputDate(payload.tanggalInput),
        status: "Menunggu Approval",
        penandatangan: "Dewi Pimpinan",
        pembuat: "Rina Operator",
        lampiran: attachment ? [attachment] : [],
        riwayat: [[`${formatJakartaInputDate(payload.tanggalInput)}, ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date())} WIB`, "Operator mengirim surat keluar ke pimpinan untuk approval"]]
      });
      form.reset();
      form.dispatchEvent(new Event("reset", { bubbles: true }));
      setSummaryLength(0);
    } finally {
      setSavingIntent("");
    }
  }

  function requestSave(event) {
    const form = event.currentTarget.form;
    if (!form) return;
    setConfirm({
      title: "Kirim surat keluar?",
      body: "Surat keluar akan disimpan dan masuk status Menunggu Approval untuk keputusan pimpinan.",
      onConfirm: () => saveOutgoingLetter(form, "send")
    });
  }

  return (
    <section className="outgoingPage">
      <header className="outgoingTitle">
        <h1>Surat Keluar</h1>
      </header>

      <section className="outgoingGrid">
        <article className="outgoingCard">
          <h2>Form Surat Keluar</h2>
          <form className="outgoingForm" onSubmit={(event) => event.preventDefault()} noValidate>
            <label className="outgoingDeferredNumber">Nomor Surat
              <input value="Dibuat setelah ditandatangani pimpinan" disabled readOnly />
              <small>Nomor surat final diterbitkan operator setelah approval dan tanda tangan pimpinan selesai.</small>
            </label>
            <label>Tanggal Surat <span>*</span>
              <input name="letterDate" type="date" defaultValue={getJakartaDateInputValue()} />
              {formErrors.letterDate && <small className="fieldError">{formErrors.letterDate}</small>}
            </label>
            <label>Jenis Surat <span>*</span>
              <select name="letterType" defaultValue="">
                <option value="" disabled>Pilih jenis surat</option>
                <option>Surat Undangan</option>
                <option>Surat Tugas</option>
                <option>Surat Edaran</option>
                <option>Surat Permohonan</option>
              </select>
              {formErrors.letterType && <small className="fieldError">{formErrors.letterType}</small>}
            </label>
            <label>Tujuan Surat <span>*</span>
              <select name="destinationType" defaultValue="">
                <option value="" disabled>Pilih tujuan surat</option>
                <option>Instansi Eksternal</option>
                <option>Unit Internal</option>
                <option>Pegawai</option>
                <option>Mitra Kerja</option>
              </select>
              {formErrors.destinationType && <small className="fieldError">{formErrors.destinationType}</small>}
            </label>
            <label>Instansi / Penerima <span>*</span>
              <input name="recipient" placeholder="Ketik nama instansi atau penerima" />
              {formErrors.recipient && <small className="fieldError">{formErrors.recipient}</small>}
            </label>
            <label>Perihal <span>*</span>
              <input name="subject" placeholder="Ketik perihal surat" />
              {formErrors.subject && <small className="fieldError">{formErrors.subject}</small>}
            </label>
            <label className="wideField">Sifat Surat
              <select name="priority" defaultValue="Biasa">
                <option value="" disabled>Pilih sifat surat</option>
                <option>Biasa</option>
                <option>Penting</option>
                <option>Segera</option>
                <option>Rahasia</option>
              </select>
            </label>
            <label className="wideField">Keterangan
              <textarea name="summary" rows={4} maxLength={1000} placeholder="Tuliskan isi ringkas atau deskripsi surat secara singkat dan jelas..." onChange={(event) => setSummaryLength(event.target.value.length)} />
              <small>{summaryLength} / 1000</small>
            </label>
            <section className="wideField outgoingAttachment">
              <h3>Lampiran / Dokumen <span className="uploadRequiredMark">*</span></h3>
              <UploadDropzone name="document" accept=".pdf,application/pdf" formats="PDF (Maks. 10 MB)" />
              {formErrors.document && <small className="fieldError">{formErrors.document}</small>}
            </section>
            <div className="outgoingActions wideField">
              <button type="button" className="outlineBtn" onClick={onCancel}>Batal</button>
              <button type="button" className="primaryBtn sendBtn" disabled={Boolean(savingIntent)} onClick={requestSave}><LineIcon name="send" /> {savingIntent === "send" ? "Mengirim" : "Kirim Surat"}</button>
            </div>
          </form>
        </article>

        <aside className="outgoingGuide">
          <h2><LineIcon name="doc" /> Panduan Surat Keluar</h2>
          <ul>
            <li>Lengkapi seluruh data surat keluaran dengan benar.</li>
            <li>Pastikan nomor surat belum digunakan.</li>
            <li>Unggah surat atau dokumen dalam format PDF.</li>
            <li>Pilih pejabat penandatangan yang sesuai.</li>
            <li>Ajukan approval untuk proses pemeriksaan.</li>
          </ul>
        </aside>
      </section>
    </section>
  );
}

function OutgoingLetterDetail({ detail, onBack, onRevise, onNumbering, backLabel = "Kembali ke Surat Keluar" }) {
  const [previewDocument, setPreviewDocument] = useState(null);
  const detailStatus = detail.status || "Draft";
  const outgoingStageMap = { Draft: 0, Ditolak: 1, "Menunggu Approval": 2, Disetujui: 3, Dikirim: 4, Selesai: 4 };
  const detailStageIndex = outgoingStageMap[detailStatus] ?? getAjuanStageIndex(detailStatus);
  const isRejected = isAjuanRevisionStatus(detailStatus);
  const needsNumbering = detail.status === "Disetujui";
  const rejectionNote = detail.catatanPimpinan || detail.catatanOperator || "";
  const finalAttachments = getAjuanFinalAttachments(detail);
  const attachments = detail.lampiran?.length ? detail.lampiran : [["Dokumen_Surat_Keluar.pdf", "512 KB", "Diunggah operator"]];
  return (
    <section className="incomingPage dispositionDetailPage ajuanDraftDetailPage outgoingDetailPage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> {backLabel}</button>
          <h1>Detail Surat Keluar</h1>
          <p>Periksa data surat, lampiran, dan status proses sebelum melanjutkan.</p>
        </div>
        <Status text={detailStatus} />
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="clipboard" /> Data Surat</h2>
              <span className="priority">{detail.nomor}</span>
            </div>
            <div className="detailGrid">
              <DetailItem icon="doc" label="Nomor Pengajuan" value={detail.nomor} />
              <DetailItem icon="doc" label="Nomor Surat" value={detail.nomorFinal || "-"} />
              <DetailItem icon="info" label="Jenis Surat" value={detail.jenis} />
              <DetailItem icon="calendar" label="Tanggal Ajuan" value={detail.tanggal} />
              <DetailItem icon="user" label="Pembuat" value={detail.pembuat || "Rina Operator"} />
              <DetailItem icon="bank" label="Tujuan Surat" value={detail.tujuan || "-"} wide />
              <DetailItem icon="mail" label="Perihal" value={detail.perihal} wide />
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="edit" /> Keterangan</h2>
            <div className="dispositionNoteBox">
              <small>Isi surat</small>
              <strong>{detail.perihal}</strong>
              <p>{detail.ringkasan || "Belum ada keterangan."}</p>
            </div>
          </article>

          {isRejected && (
            <article className="dispositionFormCard rejectedDecisionCard">
              <h2><LineIcon name="refresh" /> Keterangan Revisi</h2>
              <div className="requestMessage">
                <LineIcon name="info" />
                <div>
                  <h3>{detail.diputuskanOleh || "Pimpinan"} mengembalikan surat ini</h3>
                  <p>{rejectionNote || "Catatan revisi belum tersedia. Silakan perbarui dokumen surat keluar."}</p>
                  {detail.diputuskanPada && <small>Dikembalikan pada {detail.diputuskanPada}</small>}
                </div>
              </div>
            </article>
          )}

          {finalAttachments.length > 0 && (
            <article className="dispositionFormCard">
              <h2><LineIcon name="check" /> Surat Final</h2>
              <div className="dispositionNoteBox">
                <small>Surat keluar selesai</small>
                <strong>{detail.nomorFinal || detail.nomor}</strong>
                <p>Surat final yang sudah diberi nomor oleh operator dapat dipratinjau atau diunduh.</p>
              </div>
              <div className="attachmentList">
                {finalAttachments.map((attachment) => {
                  const [name, size, meta] = attachment;
                  return (
                    <div className="requestAttachment" key={`${name}-${meta}`}>
                      <span><LineIcon name="doc" /></span>
                      <div>
                        <strong>{name}</strong>
                        <small>{size} - {meta}</small>
                      </div>
                      <div className="requestAttachmentActions">
                        <button type="button" className="softBtn" onClick={() => setPreviewDocument(attachment)}><LineIcon name="eye" /> Pratinjau</button>
                        <button type="button" className="primaryBtn" onClick={() => downloadAttachment(attachment, detail)}><LineIcon name="upload" /> Unduh</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          )}

          <article className="dispositionFormCard">
            <h2><LineIcon name="upload" /> Lampiran</h2>
            <div className="attachmentList">
              {attachments.map((attachment) => {
                const [name, size, meta] = attachment;
                return (
                  <div className="requestAttachment" key={`${name}-${meta}`}>
                    <span><LineIcon name="doc" /></span>
                    <div>
                      <strong>{name}</strong>
                      <small>{size} - {meta}</small>
                    </div>
                    <div className="requestAttachmentActions">
                      <button type="button" className="softBtn" onClick={() => setPreviewDocument(attachment)}><LineIcon name="eye" /> Pratinjau</button>
                      <button type="button" className="primaryBtn" onClick={() => downloadAttachment(attachment, detail)}><LineIcon name="upload" /> Unduh</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>

        <aside className="dispositionPreview">
          <div className="dispositionFlow">
            <h3>Status Surat</h3>
            {["Draft", "Dikirim", "Approval", "Penomoran Surat", "Selesai"].map((item, index) => (
              <p key={item} className={index <= detailStageIndex ? "active" : ""}><b>{index + 1}</b>{item}</p>
            ))}
          </div>
          {isRejected && (
            <div className="dispositionSubmitBar">
              <button type="button" className="primaryBtn" onClick={onRevise}><LineIcon name="refresh" /> Revisi Surat</button>
            </div>
          )}
          {needsNumbering && (
            <div className="dispositionSubmitBar">
              <button type="button" className="primaryBtn" onClick={onNumbering}><LineIcon name="edit" /> Penomoran Surat</button>
            </div>
          )}
        </aside>
      </section>
      {previewDocument && <AttachmentPreviewModal attachment={previewDocument} detail={detail} onClose={() => setPreviewDocument(null)} />}
    </section>
  );
}

function ApprovalLetterProcess({ detail, onBack, setConfirm, onUpdateOutgoing }) {
  const [previewDocument, setPreviewDocument] = useState(null);
  const [decisionMode, setDecisionMode] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [approvalFile, setApprovalFile] = useState(null);
  const [approvalFileError, setApprovalFileError] = useState("");
  const decisionTime = () => new Date().toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta"
  });

  function handleApprovalFileChange(event) {
    const file = event.target.files?.[0] || null;
    const fileError = validateUploadFile(file);
    setApprovalFileError(fileError);
    setApprovalFile(fileError ? null : file);
    if (fileError) event.target.value = "";
  }

  function selectDecision(mode) {
    setDecisionMode(mode);
    setNoteError("");
    setApprovalFileError("");
  }

  async function decideOutgoingLetter(nextStatus) {
    const note = approvalNote.trim();
    const rejected = nextStatus === "Ditolak";
    if (rejected && !note) {
      setNoteError("Catatan penolakan wajib diisi sebelum surat dikembalikan ke operator.");
      return;
    }
    if (!rejected && !approvalFile) {
      setApprovalFileError("Upload surat approval wajib diunggah sebelum menyetujui surat keluar.");
      return;
    }
    setNoteError("");
    setApprovalFileError("");
    const approvedAttachment = !rejected && approvalFile
      ? [
          approvalFile.name,
          formatFileSize(approvalFile.size),
          `Diunggah pimpinan ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`,
          await readFileAsDataUrl(approvalFile),
          approvalFile.type,
          makeAttachmentKey("outgoing-approval", detail.nomor, approvalFile)
        ]
      : null;
    if (approvedAttachment) await saveAttachmentPayload(approvedAttachment[5], approvedAttachment[3]);
    setConfirm({
      title: rejected ? "Tolak surat keluar?" : "Setujui surat keluar?",
      body: rejected
        ? `${detail.nomor} akan dikembalikan ke operator dengan catatan: ${note}`
        : `${detail.nomor} akan berubah menjadi Disetujui dan surat approval ${approvalFile.name} tersimpan untuk diproses operator.`,
      onConfirm: () => {
        onUpdateOutgoing?.(detail.nomor, {
          status: nextStatus,
          catatanPimpinan: note,
          dokumenApprovalPimpinan: approvedAttachment,
          lampiranApproval: approvedAttachment ? [approvedAttachment] : detail.lampiranApproval,
          diputuskanOleh: "Dewi Pimpinan",
          diputuskanPada: decisionTime(),
          riwayat: [[decisionTime(), rejected ? `Pimpinan menolak surat: ${note}` : (note ? `Pimpinan menyetujui dan mengunggah surat approval: ${note}` : "Pimpinan menyetujui dan mengunggah surat approval")]]
        });
        onBack();
      }
    });
  }

  const attachments = detail.lampiran?.length
    ? detail.lampiran
    : [[`${safeFilename(detail.nomor)}_${safeFilename(detail.jenis)}.pdf`, "210 KB", "Dokumen surat keluar dari operator"]];

  return (
    <section className="requestDetailPage">
      <header className="requestDetailTop">
        <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Approval</button>
        <h1>Approval Surat Keluar</h1>
        <div className="requestMeta">
          <Status text={detail.status} />
          <span />
          <div><small>Nomor Surat</small><strong>{detail.nomor}</strong></div>
          <b><LineIcon name="check" /></b>
        </div>
      </header>

      <section className="ajuanDetailGrid requestLayout">
        <div className="requestDetailMain">
          <article className="requestCard">
            <h2><LineIcon name="clipboard" /> Ringkasan Surat</h2>
            <div className="requestRows">
              <DetailItem icon="user" label="Dibuat Oleh" value={detail.pembuat || "Rina Operator"} />
              <DetailItem icon="briefcase" label="Tujuan Surat" value={detail.tujuan} />
              <DetailItem icon="doc" label="Jenis Surat" value={detail.jenis} />
              <DetailItem icon="calendar" label="Tanggal" value={detail.tanggal} />
              <DetailItem icon="edit" label="Perihal" value={detail.perihal} wide />
            </div>
          </article>

          <article className="requestCard">
            <h2><LineIcon name="upload" /> Dokumen Surat</h2>
            <div className="attachmentList">
              {attachments.map((attachment) => {
                const [name, size, meta] = attachment;
                return (
                  <div className="requestAttachment" key={name}>
                    <span><LineIcon name="doc" /></span>
                    <div>
                      <strong>{name}</strong>
                      <small>{size} - {meta}</small>
                    </div>
                    <div className="requestAttachmentActions">
                      <button type="button" className="softBtn" onClick={() => setPreviewDocument(attachment)}><LineIcon name="eye" /> Pratinjau</button>
                      <button type="button" className="primaryBtn" onClick={() => downloadAttachment(attachment, detail)}><LineIcon name="upload" /> Unduh</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>

        <aside className="requestSide">
          <article className="requestActionCard verificationActive">
            <h2><LineIcon name="shield" /> Keputusan Pimpinan</h2>
            <p>Pilih keputusan terlebih dahulu. Form catatan dan dokumen akan muncul sesuai keputusan.</p>
            <div className="verificationActions">
              <button type="button" className={decisionMode === "reject" ? "dangerBtn activeDecision" : "dangerBtn"} onClick={() => selectDecision("reject")}><LineIcon name="x" /> Tolak</button>
              <button type="button" className={decisionMode === "approve" ? "primaryBtn activeDecision" : "primaryBtn"} onClick={() => selectDecision("approve")}><LineIcon name="check" /> Setujui</button>
            </div>
            {decisionMode === "approve" && (
              <div className="verificationFields approvalDecisionForm">
                <label>
                  Catatan Approval
                  <textarea rows={5} value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Tambahkan catatan persetujuan jika diperlukan." />
                </label>
                <div className="approvalUploadField">
                  <span className="fieldLabelInline">Upload Surat Approval <span className="requiredMark">*</span></span>
                  <label className={approvalFile ? "approvalUploadBox hasFile" : "approvalUploadBox"}>
                    <input type="file" accept=".pdf,application/pdf" onChange={handleApprovalFileChange} />
                    <span><LineIcon name="upload" /></span>
                    <b>{approvalFile ? approvalFile.name : "Pilih surat approval"}</b>
                    <small>{approvalFile ? `${formatFileSize(approvalFile.size)} - siap diunggah` : "PDF. Maksimal 10 MB."}</small>
                  </label>
                  {approvalFileError && <small className="fieldError">{approvalFileError}</small>}
                </div>
                <div className="verificationActions singleAction">
                  <button type="button" className="primaryBtn" onClick={() => decideOutgoingLetter("Disetujui")}><LineIcon name="check" /> Kirim Persetujuan</button>
                </div>
              </div>
            )}
            {decisionMode === "reject" && (
              <div className="verificationFields approvalDecisionForm">
                <label>
                  <span className="fieldLabelInline">Catatan Penolakan <span className="requiredMark">*</span></span>
                  <textarea rows={5} value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Tuliskan alasan penolakan agar operator dapat memperbaiki surat." />
                  {noteError && <small className="fieldError">{noteError}</small>}
                </label>
                <div className="verificationActions singleAction">
                  <button type="button" className="dangerBtn" onClick={() => decideOutgoingLetter("Ditolak")}><LineIcon name="x" /> Kirim Penolakan</button>
                </div>
              </div>
            )}
          </article>
        </aside>
      </section>
      {previewDocument && <AttachmentPreviewModal attachment={previewDocument} detail={detail} onClose={() => setPreviewDocument(null)} />}
    </section>
  );
}

function OutgoingLetterProcess({ detail, onBack, setConfirm, onUpdateOutgoing }) {
  const [previewDocument, setPreviewDocument] = useState(null);
  const canSubmitApproval = !["Dikirim", "Menunggu Approval", "Disetujui"].includes(detail.status);
  const isRejected = detail.status === "Ditolak";
  const isApproved = detail.status === "Disetujui";
  const [finalNumber, setFinalNumber] = useState(detail.nomorFinal || "");
  const [processNote, setProcessNote] = useState(detail.catatanOperator || "");
  const [processError, setProcessError] = useState("");
  const [numberingErrors, setNumberingErrors] = useState({});
  const savedRevisionAttachment = detail.dokumenPendukungRevisi || detail.lampiranRevisiDraft?.[0] || null;
  const attachments = detail.lampiran?.length ? detail.lampiran : [["Dokumen_Surat_Keluar.pdf", "512 KB", "Diunggah operator"]];
  const processTime = () => new Date().toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta"
  });

  async function buildRevisionAttachment(file) {
    const storageKey = makeAttachmentKey("outgoing-revision", detail.nomor, file);
    const dataUrl = await readFileAsDataUrl(file);
    await saveAttachmentPayload(storageKey, dataUrl);
    return [file.name, formatFileSize(file.size), `Dokumen pendukung revisi ${processTime()}`, dataUrl, file.type, storageKey];
  }

  async function reviseRejectedLetter(form) {
    const formData = new FormData(form);
    const file = formData.get("revisionDocument");
    const fileError = file?.name ? validateUploadFile(file) : "";
    if (fileError) {
      setProcessError(fileError);
      return;
    }
    if (!file?.name && !savedRevisionAttachment) {
      setProcessError("Upload dokumen pendukung wajib diisi untuk surat keluar yang ditolak.");
      return;
    }

    setProcessError("");
    const attachment = file?.name ? await buildRevisionAttachment(file) : savedRevisionAttachment;
    setConfirm({
      title: "Kirim ulang ke approval?",
      body: `${detail.nomor} akan diperbarui dengan dokumen revisi dan dikirim kembali ke pimpinan.`,
      onConfirm: () => {
        onUpdateOutgoing?.(detail.nomor, {
          status: "Menunggu Approval",
          catatanOperator: processNote.trim(),
          dokumenPendukungRevisi: attachment,
          lampiranRevisiDraft: attachment ? [attachment] : [],
          lampiran: [attachment],
          riwayat: [[processTime(), processNote.trim() ? `Operator mengunggah dokumen pendukung dan mengirim ulang: ${processNote.trim()}` : "Operator mengunggah dokumen pendukung dan mengirim ulang ke approval"]]
        });
        onBack();
      }
    });
  }

  function saveOutgoingProcess(event) {
    event?.preventDefault?.();
    const form = event.currentTarget.form || event.currentTarget;
    if (!form) return;
    if (isRejected) {
      reviseRejectedLetter(form);
      return;
    }
    if (isApproved) {
      finalizeApprovedOutgoing(form);
      return;
    }
    setConfirm({
      title: "Simpan perubahan proses?",
      body: `Catatan proses ${detail.nomor} akan disimpan untuk riwayat operator.`,
      onConfirm: () => {
        onUpdateOutgoing?.(detail.nomor, {
          catatanOperator: processNote.trim(),
          riwayat: processNote.trim() ? [[processTime(), `Operator menyimpan catatan proses: ${processNote.trim()}`]] : []
        });
        onBack();
      }
    });
  }

  async function finalizeApprovedOutgoing(form) {
    const formData = new FormData(form);
    const finalFile = formData.get("finalDocument");
    const trimmedNumber = finalNumber.trim();
    const nextErrors = {};
    if (!trimmedNumber) nextErrors.nomorSurat = "Nomor surat wajib diisi untuk keabsahan surat.";
    const fileError = finalFile?.name ? validateUploadFile(finalFile) : "Upload dokumen final wajib diisi.";
    if (fileError) nextErrors.file = fileError;
    setNumberingErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setProcessError("");
    const storageKey = makeAttachmentKey("outgoing-final", detail.nomor, finalFile);
    const dataUrl = await readFileAsDataUrl(finalFile);
    await saveAttachmentPayload(storageKey, dataUrl);
    const finalAttachment = [finalFile.name, formatFileSize(finalFile.size), `Diunggah operator ${processTime()}`, dataUrl, finalFile.type, storageKey];
    setConfirm({
      title: "Simpan surat keluar final?",
      body: `${detail.nomor} akan diberi nomor ${trimmedNumber}, dokumen final tersimpan, dan status menjadi Dikirim.`,
      onConfirm: () => {
        onUpdateOutgoing?.(detail.nomor, {
          status: "Dikirim",
          nomorFinal: trimmedNumber,
          suratFinalOperator: finalAttachment,
          lampiranFinal: [finalAttachment],
          catatanOperator: processNote.trim(),
          riwayat: [[processTime(), processNote.trim() ? `Operator memberi nomor, upload surat final, dan mengirim: ${processNote.trim()}` : "Operator memberi nomor, upload surat final, dan mengirim surat keluar"]]
        });
        setNumberingErrors({});
        onBack();
      }
    });
  }

  function submitApprovalAgain(event) {
    const form = event.currentTarget.form;
    if (!form) return;
    if (isRejected) {
      reviseRejectedLetter(form);
      return;
    }
    setConfirm({
      title: "Ajukan approval?",
      body: `${detail.nomor} akan dikirim ke pimpinan untuk approval dan notifikasi dibuat.`,
      onConfirm: () => {
        onUpdateOutgoing?.(detail.nomor, {
          status: "Menunggu Approval",
          catatanOperator: processNote.trim(),
          riwayat: [[processTime(), "Operator mengajukan surat keluar ke pimpinan untuk approval"]]
        });
        onBack();
      }
    });
  }

  return (
    <section className="incomingPage dispositionDetailPage outgoingProcessPage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Surat Keluar</button>
          <h1>{isRejected ? "Revisi Surat Keluar" : isApproved ? "Penomoran Surat Keluar" : "Proses Surat Keluar"}</h1>
          <p>{isRejected ? "Unggah ulang dokumen surat keluar yang sudah diperbaiki, lalu kirim kembali ke approval pimpinan." : isApproved ? "Input nomor surat dan unggah dokumen final setelah surat disetujui pimpinan." : "Ajukan approval, unggah revisi jika ditolak, atau beri nomor dan upload dokumen final setelah disetujui pimpinan."}</p>
        </div>
        <Status text={detail.status} />
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="doc" /> Surat yang Diproses</h2>
              <span className={detail.sifat === "Segera" ? "priority high" : "priority"}>{detail.sifat}</span>
            </div>
            <div className="dispositionSourceRows">
              <DetailItem icon="doc" label="Nomor Surat" value={detail.nomor} />
              <DetailItem icon="info" label="Jenis Surat" value={detail.jenis} />
              <DetailItem icon="bank" label="Tujuan" value={detail.tujuan} />
              <DetailItem icon="mail" label="Perihal" value={detail.perihal} />
            </div>
          </article>

          {isApproved && (
            <>
              <article className="dispositionFormCard">
                <h2><LineIcon name="edit" /> Keterangan</h2>
                <div className="dispositionNoteBox">
                  <small>Isi surat</small>
                  <strong>{detail.perihal}</strong>
                  <p>{detail.ringkasan || "Belum ada keterangan."}</p>
                </div>
              </article>

              <article className="dispositionFormCard">
                <h2><LineIcon name="upload" /> Lampiran</h2>
                <div className="attachmentList">
                  {attachments.map((attachment) => {
                    const [name, size, meta] = attachment;
                    return (
                      <div className="requestAttachment" key={`${name}-${meta}`}>
                        <span><LineIcon name="doc" /></span>
                        <div>
                          <strong>{name}</strong>
                          <small>{size} - {meta}</small>
                        </div>
                        <div className="requestAttachmentActions">
                          <button type="button" className="softBtn" onClick={() => setPreviewDocument(attachment)}><LineIcon name="eye" /> Pratinjau</button>
                          <button type="button" className="primaryBtn" onClick={() => downloadAttachment(attachment, detail)}><LineIcon name="upload" /> Unduh</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            </>
          )}

          <form className="dispositionForm" onSubmit={(event) => event.preventDefault()}>
            {!isApproved && <section className="dispositionFormCard">
              <h2><LineIcon name="clipboard" /> {isRejected ? "Form Surat Keluar" : "Catatan Proses"}</h2>
              {isRejected && (
                <div className="requestMessage">
                  <LineIcon name="info" />
                  <div>
                    <h3>Surat ditolak pimpinan</h3>
                    <p>{detail.catatanPimpinan || "Pimpinan belum menuliskan catatan penolakan."}</p>
                    {detail.diputuskanPada && <small>Ditolak pada {detail.diputuskanPada}</small>}
                  </div>
                </div>
              )}
              <div className="dispositionNoteBox">
                <small>Ringkasan Surat</small>
                <strong>{detail.perihal}</strong>
                <p>{detail.ringkasan}</p>
              </div>
              <label className="dispositionTextArea">
                {isRejected ? "Keterangan" : "Catatan Operator"}
                <textarea rows={5} value={processNote} onChange={(event) => setProcessNote(event.target.value)} placeholder={isRejected ? "Tuliskan keterangan revisi atau penjelasan perbaikan dokumen." : "Tuliskan catatan pemeriksaan, revisi, nomor resi, atau keterangan pengiriman."} />
              </label>
              {(isRejected || isApproved) && (
                <div className={isRejected ? "uploadField revisionSupportUpload" : "uploadField"}>
                  {!isRejected && <strong>Upload Dokumen</strong>}
                  <UploadDropzone
                    label={isRejected ? <>Upload Dokumen Pendukung <span className="uploadRequiredMark">*</span></> : null}
                    name={isRejected ? "revisionDocument" : "finalDocument"}
                    accept=".pdf,application/pdf"
                    formats={isRejected ? "PDF. Maksimal 10 MB." : "PDF (Maks. 10 MB)"}
                  />
                  {isRejected && savedRevisionAttachment && (
                    <small className="savedDraftFile">Dokumen tersimpan: {savedRevisionAttachment[0]} - {savedRevisionAttachment[1]}</small>
                  )}
                  {processError && <small className="fieldError">{processError}</small>}
                </div>
              )}
            </section>
            }

            {!isApproved && <div className={isRejected ? "dispositionSubmitBar revisionSubmitBar" : "dispositionSubmitBar"}>
              {isRejected ? (
                <>
                  <button type="button" className="ghostBtn" onClick={onBack}>Batal</button>
                  <button type="button" className="primaryBtn" onClick={submitApprovalAgain}><LineIcon name="send" /> Kirim Surat</button>
                </>
              ) : (
                <>
                  <button type="button" className="softBtn" onClick={saveOutgoingProcess}><LineIcon name="check" /> {isApproved ? "Upload & Nomori Surat" : "Simpan Proses"}</button>
                  <button type="button" className="softBtn" disabled={!canSubmitApproval} onClick={submitApprovalAgain}><LineIcon name="send" /> Ajukan Approval</button>
                </>
              )}
            </div>
            }
          </form>
        </div>

        <aside className="dispositionPreview">
          {isApproved ? (
            <article className="requestActionCard verificationActive numberingCard">
              <h2 className="numberingTitle"><span><LineIcon name="doc" /></span> Penomoran Surat</h2>
              <p>Surat sudah disetujui pimpinan. Operator menginput nomor surat dan mengunggah dokumen final agar tersinkron ke portal user.</p>
              <form className="verificationFields operatorFinalForm" onSubmit={saveOutgoingProcess}>
                <label>
                  <span className="fieldLabelInline">Nomor Surat <span className="requiredMark">*</span></span>
                  <input
                    type="text"
                    value={finalNumber}
                    onChange={(event) => setFinalNumber(event.target.value)}
                    placeholder="Contoh: 001/STT-PU/VI/2026"
                  />
                  {numberingErrors.nomorSurat && <small className="fieldError">{numberingErrors.nomorSurat}</small>}
                </label>
                <UploadDropzone label={<>Upload Dokumen <span className="uploadRequiredMark">*</span></>} name="finalDocument" accept=".pdf,application/pdf" formats="PDF. Maksimal 10 MB." />
                <div className="numberingNotice">
                  <LineIcon name="info" />
                  <span>Dokumen final yang diunggah operator akan menjadi file utama di portal user dan arsip.</span>
                  {numberingErrors.file && <small className="fieldError">{numberingErrors.file}</small>}
                  {processError && <small className="fieldError">{processError}</small>}
                </div>
                <button type="submit" className="primaryBtn"><LineIcon name="check" /> Simpan Nomor Surat</button>
              </form>
            </article>
          ) : (
            <>
              <h3>Alur Surat Keluar</h3>
              <div className="dispositionFlow">
                {["Mengajukan surat keluar", "Pimpinan menerima dan memutuskan", "Pimpinan tanda tangan dan upload", "Penomoran surat", "Operator upload dokumen final"].map((item, index) => (
                  <p key={item}><b>{index + 1}</b>{item}</p>
                ))}
              </div>
              <div className="followupResultBox">
                <span><LineIcon name="archive" /></span>
                <strong>Arsip Otomatis</strong>
                <p>Setelah surat dikirim, dokumen final masuk arsip digital dan dapat dicari lewat nomor surat.</p>
              </div>
            </>
          )}
        </aside>
      </section>
      {previewDocument && <AttachmentPreviewModal attachment={previewDocument} detail={detail} onClose={() => setPreviewDocument(null)} />}
    </section>
  );
}

function Approval({ setConfirm, ajuanRequests = [], outgoingLetters = [], onUpdateAjuan, onUpdateOutgoing }) {
  const [approvalAction, setApprovalAction] = useState(null);
  const approvalAjuanRequests = getPimpinanApprovalAjuanRequests(ajuanRequests);
  const ajuanApprovalRows = approvalAjuanRequests
    .map((item) => ({
      row: [item.nomor, item.jenis, item.pemohon, item.judul || item.keterangan || "-", item.status],
      source: item
    }));
  const normalizedOutgoingLetters = normalizeOutgoingWorkflowStatus(outgoingLetters);
  const outgoingApprovalRows = normalizedOutgoingLetters
    .filter((letter) => letter.status === "Menunggu Approval")
    .map((letter) => ({
      row: outgoingLetterToRow(letter),
      source: letter
    }));
  const approvalRows = [...ajuanApprovalRows, ...outgoingApprovalRows]
    .sort((a, b) => getApprovalSortTime(b.source) - getApprovalSortTime(a.source))
    .map((item) => item.row);

  if (approvalAction) {
    if (approvalAction.type === "ajuan") {
      return <AjuanApprovalProcess detail={approvalAction.item} onBack={() => setApprovalAction(null)} setConfirm={setConfirm} onUpdateAjuan={onUpdateAjuan} />;
    }
    const detail = getOutgoingLetterDetail(
      approvalAction.item,
      normalizedOutgoingLetters.find((letter) => letter.nomor === approvalAction.item[0])
    );
    if (approvalAction.mode === "detail") {
      return <OutgoingLetterDetail detail={detail} onBack={() => setApprovalAction(null)} backLabel="Kembali ke Approval" />;
    }
    return <ApprovalLetterProcess detail={detail} onBack={() => setApprovalAction(null)} setConfirm={setConfirm} onUpdateOutgoing={onUpdateOutgoing} />;
  }

  return (
    <section className="previewLayout approvalWideLayout">
      <article className="tableShell">
        <div className="rowBetween"><h3>Daftar Approval</h3><span className="status waiting">{approvalRows.length} item</span></div>
        <ApprovalTable
          data={approvalRows}
          onProcess={(row) => {
            const ajuan = approvalAjuanRequests.find((item) => item.nomor === row[0]);
            setApprovalAction(ajuan ? { type: "ajuan", item: ajuan } : { type: "surat", mode: "process", item: row });
          }}
        />
      </article>
    </section>
  );
}

function ApprovalTable({ data, onProcess }) {
  return (
    <>
      <div className="tableScroll">
        <table>
          <thead>
            <tr>
              {["Nomor", "Jenis", "Pemohon/Tujuan", "Perihal", "Status"].map((head) => <th key={head}>{head}</th>)}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row[0]}>
                <td>{row[0]}</td>
                <td>{row[1]}</td>
                <td>{row[2]}</td>
                <td>{row[3]}</td>
                <td><Status text={row[4]} /></td>
                <td>
                  <button className="softBtn" onClick={() => onProcess(row)}>Proses Approval</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination"><button className="ghostBtn">Sebelumnya</button><span>Halaman 1 dari 4</span><button className="ghostBtn">Berikutnya</button></div>
    </>
  );
}

function getApprovalSortTime(item) {
  const values = [
    item?.createdAt,
    item?.created_at,
    item?.updatedAt,
    item?.updated_at,
    item?.tanggalInput,
    item?.tanggal
  ];
  const draftDate = String(item?.nomor || "").match(/DRAFT\/SK\/(\d{4})(\d{2})(\d{2})/);
  if (draftDate) values.unshift(`${draftDate[1]}-${draftDate[2]}-${draftDate[3]}`);
  for (const value of values) {
    const timestamp = parseApprovalDate(value);
    if (timestamp) return timestamp;
  }
  return parseApprovalNumber(item?.nomor);
}

function parseApprovalDate(value) {
  if (!value) return 0;
  const raw = String(value).trim();
  const direct = Date.parse(raw);
  if (!Number.isNaN(direct)) return direct;
  const match = raw.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!match) return 0;
  const monthMap = {
    januari: 0,
    februari: 1,
    maret: 2,
    april: 3,
    mei: 4,
    juni: 5,
    juli: 6,
    agustus: 7,
    september: 8,
    oktober: 9,
    november: 10,
    desember: 11
  };
  const month = monthMap[match[2]];
  if (month === undefined) return 0;
  return new Date(Number(match[3]), month, Number(match[1])).getTime();
}

function parseApprovalNumber(value) {
  const numbers = String(value || "").match(/\d+/g);
  if (!numbers?.length) return 0;
  return Number(numbers.join("").slice(0, 14)) || 0;
}

function isAjuanReadyForPimpinanApproval(item) {
  if (item.status === "Menunggu Approval") return true;
  return item.status === "Diproses" && Boolean(item.hasilPemeriksaan || item.diperiksaOleh);
}

function getPimpinanApprovalAjuanRequests(ajuanRequests) {
  const forwardedRequests = ajuanRequests
    .filter(isAjuanReadyForPimpinanApproval)
    .map((item) => {
      const applicantProfile = profileDirectory[item.pemohon] || {};
      return {
        ...item,
        unit: applicantProfile.unit || item.unit,
        email: applicantProfile.email || item.email,
        phone: applicantProfile.phone || item.phone,
        status: "Menunggu Approval",
        diteruskanKe: item.diteruskanKe || "Dewi Pimpinan"
      };
    });

  const demoRequests = rows["Ajuan Surat"]
    .filter((row) => row[4] === "Menunggu Approval")
    .map(([nomor, jenis, perihal, pemohon, status]) => ({
      nomor,
      jenis,
      pemohon,
      unit: profileDirectory[pemohon]?.unit || "Akademik",
      tanggal: "20 Mei 2026",
      status,
      tujuan: "Pimpinan STT Pekerjaan Umum Jakarta",
      judul: perihal,
      keterangan: `${pemohon} mengajukan ${jenis.toLowerCase()} melalui portal user untuk approval pimpinan.`,
      hasilPemeriksaan: "Data lengkap dan valid",
      diperiksaOleh: "Rina Operator",
      diteruskanKe: "Dewi Pimpinan",
      lampiran: [[`${safeFilename(nomor)}_${safeFilename(jenis)}.pdf`, "210 KB", "Dokumen ajuan dari portal user"]]
    }));

  const byNumber = new Map();
  [...forwardedRequests, ...demoRequests].forEach((item) => {
    if (!byNumber.has(item.nomor)) byNumber.set(item.nomor, item);
  });
  return [...byNumber.values()];
}

function AjuanApprovalProcess({ detail, onBack, setConfirm, onUpdateAjuan }) {
  const [decisionMode, setDecisionMode] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectionNote, setRejectionNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [approvalFile, setApprovalFile] = useState(null);
  const [approvalFileError, setApprovalFileError] = useState("");
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const attachments = detail.lampiran?.length
    ? detail.lampiran
    : [[`${safeFilename(detail.nomor)}_${safeFilename(detail.jenis)}.pdf`, "210 KB", "Dokumen ajuan dari portal user"]];
  const applicantProfile = profileDirectory[detail.pemohon] || {};
  const approvalSummary = {
    ...detail,
    unit: applicantProfile.unit || detail.unit,
    email: applicantProfile.email || detail.email,
    phone: applicantProfile.phone || detail.phone
  };

  function handleApprovalFileChange(event) {
    const file = event.target.files?.[0] || null;
    const fileError = validateUploadFile(file);
    setApprovalFileError(fileError);
    setApprovalFile(fileError ? null : file);
    if (fileError) event.target.value = "";
  }

  function selectDecision(mode) {
    setDecisionMode(mode);
    setNoteError("");
    setApprovalFileError("");
  }

  async function decide(status) {
    const approved = status === "Disetujui";
    const trimmedApprovalNote = approvalNote.trim();
    const trimmedRejectionNote = rejectionNote.trim();
    if (!approved && !trimmedRejectionNote) {
      setNoteError("Catatan penolakan wajib diisi agar operator dan pemohon mengetahui alasan keputusan.");
      return;
    }
    if (approved && !approvalFile) {
      setApprovalFileError("Upload surat yang sudah di-approval wajib diunggah sebelum menyetujui ajuan.");
      return;
    }
    setNoteError("");
    setApprovalFileError("");
    const approvedAttachment = approved && approvalFile
      ? [
          approvalFile.name,
          formatFileSize(approvalFile.size),
          `Diunggah pimpinan ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`,
          await readFileAsDataUrl(approvalFile),
          approvalFile.type,
          makeAttachmentKey("approval", detail.nomor, approvalFile)
        ]
      : null;
    if (approvedAttachment) await saveAttachmentPayload(approvedAttachment[5], approvedAttachment[3]);
    setConfirm({
      title: approved ? "Setujui ajuan?" : "Tolak ajuan?",
      body: approved
        ? `${detail.nomor} akan berubah menjadi Disetujui dan surat approval ${approvalFile.name} tersimpan. Operator dan pemohon menerima notifikasi.`
        : `${detail.nomor} akan ditolak dengan catatan: ${trimmedRejectionNote}`,
      onConfirm: () => {
        onUpdateAjuan?.(detail.nomor, {
          ...detail,
          status,
          catatanPimpinan: approved ? trimmedApprovalNote : trimmedRejectionNote,
          alasanPenolakanPimpinan: approved ? "" : trimmedRejectionNote,
          dokumenApprovalPimpinan: approvedAttachment,
          lampiranApproval: approvedAttachment ? [approvedAttachment] : detail.lampiranApproval,
          diputuskanOleh: "Dewi Pimpinan",
          diputuskanPada: new Date().toLocaleString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })
        });
        onBack();
      }
    });
  }

  return (
    <section className="requestDetailPage">
      <header className="requestDetailTop">
        <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Approval</button>
        <h1>Approval Ajuan Surat</h1>
        <div className="requestMeta">
          <Status text={detail.status} />
          <span />
          <div><small>Nomor Ajuan</small><strong>{detail.nomor}</strong></div>
          <b><LineIcon name="check" /></b>
        </div>
      </header>

      <section className="ajuanDetailGrid requestLayout">
        <div className="requestDetailMain">
          <article className="requestCard">
            <h2><LineIcon name="clipboard" /> Ringkasan Ajuan</h2>
            <div className="requestRows">
              <DetailItem icon="user" label="Pemohon" value={approvalSummary.pemohon} />
              <DetailItem icon="briefcase" label="Unit Kerja" value={approvalSummary.unit} />
              <DetailItem icon="doc" label="Jenis Surat" value={approvalSummary.jenis} />
              <DetailItem icon="calendar" label="Tanggal" value={approvalSummary.tanggal} />
              <DetailItem icon="edit" label="Judul" value={approvalSummary.judul || "-"} wide />
            </div>
          </article>
          <article className="requestCard">
            <h2><LineIcon name="upload" /> Dokumen Ajuan</h2>
            <div className="attachmentList">
              {attachments.map((attachment) => {
                const [name, size, meta] = attachment;
                return (
                  <div className="requestAttachment" key={name}>
                    <span><LineIcon name="doc" /></span>
                    <div>
                      <strong>{name}</strong>
                      <small>{size} - {meta}</small>
                    </div>
                    <div className="requestAttachmentActions">
                      <button type="button" className="softBtn" onClick={() => setPreviewAttachment(attachment)}><LineIcon name="eye" /> Pratinjau</button>
                      <button type="button" className="primaryBtn" onClick={() => downloadAttachment(attachment, detail)}><LineIcon name="upload" /> Unduh</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
        <aside className="requestSide">
          <article className="requestActionCard verificationActive">
            <h2><LineIcon name="shield" /> Keputusan Pimpinan</h2>
            <p>Pilih keputusan terlebih dahulu. Form catatan dan dokumen akan muncul sesuai keputusan.</p>
            <div className="verificationActions">
              <button type="button" className={decisionMode === "reject" ? "dangerBtn activeDecision" : "dangerBtn"} onClick={() => selectDecision("reject")}><LineIcon name="x" /> Tolak</button>
              <button type="button" className={decisionMode === "approve" ? "primaryBtn activeDecision" : "primaryBtn"} onClick={() => selectDecision("approve")}><LineIcon name="check" /> Setujui</button>
            </div>
            {decisionMode === "approve" && (
              <div className="verificationFields approvalDecisionForm">
                <label>
                  Catatan Approval
                  <textarea rows={5} value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Tambahkan catatan persetujuan jika diperlukan." />
                </label>
                <div className="approvalUploadField">
                  <span className="fieldLabelInline">Upload Surat Approval <span className="requiredMark">*</span></span>
                  <label className={approvalFile ? "approvalUploadBox hasFile" : "approvalUploadBox"}>
                    <input type="file" accept=".pdf,application/pdf" onChange={handleApprovalFileChange} />
                    <span><LineIcon name="upload" /></span>
                    <b>{approvalFile ? approvalFile.name : "Pilih surat approval"}</b>
                    <small>{approvalFile ? `${formatFileSize(approvalFile.size)} - siap diunggah` : "PDF. Maksimal 10 MB."}</small>
                  </label>
                  {approvalFileError && <small className="fieldError">{approvalFileError}</small>}
                </div>
                <div className="verificationActions singleAction">
                  <button type="button" className="primaryBtn" onClick={() => decide("Disetujui")}><LineIcon name="check" /> Kirim Persetujuan</button>
                </div>
              </div>
            )}
            {decisionMode === "reject" && (
              <div className="verificationFields approvalDecisionForm">
                <label>
                  <span className="fieldLabelInline">Catatan Penolakan <span className="requiredMark">*</span></span>
                  <textarea
                    rows={5}
                    value={rejectionNote}
                    onChange={(event) => setRejectionNote(event.target.value)}
                    placeholder="Tuliskan alasan penolakan agar operator dapat memperbaiki surat."
                  />
                  {noteError && <small className="fieldError">{noteError}</small>}
                </label>
                <div className="verificationActions singleAction">
                  <button type="button" className="dangerBtn" onClick={() => decide("Ditolak")}><LineIcon name="x" /> Kirim Penolakan</button>
                </div>
              </div>
            )}
          </article>
        </aside>
      </section>
      {previewAttachment && <AttachmentPreviewModal attachment={previewAttachment} detail={detail} onClose={() => setPreviewAttachment(null)} />}
    </section>
  );
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapePdfText(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createSimplePdf(title, lines) {
  const textLines = [title, "", ...lines].slice(0, 34);
  const content = [
    "BT",
    "/F1 16 Tf",
    "50 790 Td",
    `(${escapePdfText(textLines[0])}) Tj`,
    "/F1 10 Tf",
    ...textLines.slice(1).flatMap((line) => ["0 -18 Td", `(${escapePdfText(line)}) Tj`]),
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function buildReportData(filters) {
  const sourceRows = {
    "Surat Masuk": rows["Surat Masuk"].map(([agenda, nomor, pengirim, perihal, status]) => [agenda, nomor, pengirim, perihal, status]),
    "Surat Keluar": rows["Surat Keluar"].map(([nomor, jenis, tujuan, perihal, status]) => [nomor, jenis, tujuan, perihal, status]),
    "Ajuan Surat": rows["Ajuan Surat"].map(([nomor, jenis, perihal, pengaju, status]) => [nomor, jenis, pengaju, perihal, status]),
    Disposisi: rows.Disposisi.map(([id, nomor, tujuan, instruksi, status]) => [id, nomor, tujuan, instruksi, status])
  };
  const heads = {
    "Surat Masuk": ["Agenda", "Nomor Surat", "Pengirim", "Perihal", "Status"],
    "Surat Keluar": ["Nomor", "Jenis", "Tujuan", "Perihal", "Status"],
    "Ajuan Surat": ["Nomor", "Jenis", "Pengaju", "Perihal", "Status"],
    Disposisi: ["ID", "Nomor Surat", "Tujuan", "Instruksi", "Status"]
  };
  const selectedRows = sourceRows[filters.type] || sourceRows["Surat Masuk"];
  const filteredRows = filters.status === "Semua Status"
    ? selectedRows
    : selectedRows.filter((row) => row[row.length - 1] === filters.status);
  return { heads: heads[filters.type] || heads["Surat Masuk"], rows: filteredRows };
}

function Reports({ setConfirm }) {
  const [filters, setFilters] = useState({
    start: "2026-05-01",
    end: "2026-05-04",
    type: "Surat Masuk",
    status: "Semua Status"
  });
  const reportData = buildReportData(filters);
  const total = reportData.rows.length;
  const completed = reportData.rows.filter((row) => ["Selesai", "Disetujui", "Dikirim", "Didisposisikan"].includes(row[row.length - 1])).length;
  const inProgress = reportData.rows.filter((row) => ["Diproses", "Diteruskan", "Menunggu Approval"].includes(row[row.length - 1])).length;
  const rejected = reportData.rows.filter((row) => ["Ditolak", "Dikembalikan"].includes(row[row.length - 1])).length;
  const updateFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const filenameBase = `laporan-${filters.type.toLowerCase().replaceAll(" ", "-")}-${filters.start}-${filters.end}`;
  const exportExcel = () => {
    const tableRows = [
      reportData.heads,
      ...reportData.rows
    ].map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
    const html = `<html><head><meta charset="utf-8" /></head><body><h2>Laporan Operasional</h2><p>Periode: ${escapeHtml(filters.start)} s/d ${escapeHtml(filters.end)}</p><p>Jenis: ${escapeHtml(filters.type)} | Status: ${escapeHtml(filters.status)}</p><table border="1">${tableRows}</table></body></html>`;
    downloadBlob(`${filenameBase}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
  };
  const exportPdf = () => {
    const lines = [
      `Periode: ${filters.start} s/d ${filters.end}`,
      `Jenis: ${filters.type}`,
      `Status: ${filters.status}`,
      `Total Dokumen: ${total}`,
      `Selesai: ${completed}`,
      `Diproses: ${inProgress}`,
      `Ditolak: ${rejected}`,
      "",
      reportData.heads.join(" | "),
      ...reportData.rows.map((row) => row.join(" | "))
    ];
    downloadBlob(`${filenameBase}.pdf`, createSimplePdf("Laporan Operasional E-Office", lines), "application/pdf");
  };

  return (
    <section className="tableShell">
      <div className="rowBetween"><h3>Laporan Operasional</h3><div className="actions"><button className="softBtn" onClick={exportPdf}>Export PDF</button><button className="softBtn" onClick={exportExcel}>Export Excel</button></div></div>
      <div className="formGrid">
        <label>Periode Mulai<input type="date" value={filters.start} onChange={updateFilter("start")} /></label>
        <label>Periode Selesai<input type="date" value={filters.end} onChange={updateFilter("end")} /></label>
        <label>Jenis Laporan<select value={filters.type} onChange={updateFilter("type")}><option>Surat Masuk</option><option>Surat Keluar</option><option>Ajuan Surat</option><option>Disposisi</option></select></label>
        <label>Status<select value={filters.status} onChange={updateFilter("status")}><option>Semua Status</option><option>Diproses</option><option>Diteruskan</option><option>Menunggu Approval</option><option>Disetujui</option><option>Dikirim</option><option>Selesai</option><option>Ditolak</option></select></label>
      </div>
      <div className="statsGrid compact"><article className="statCard"><span>Total Dokumen</span><strong>{total}</strong></article><article className="statCard"><span>Selesai</span><strong>{completed}</strong></article><article className="statCard"><span>Diproses</span><strong>{inProgress}</strong></article><article className="statCard"><span>Ditolak</span><strong>{rejected}</strong></article></div>
    </section>
  );
}

function AdminBackup({ setConfirm }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);

  const fetchBackups = useCallback(async () => {
    try {
      const data = await apiFetch("/backups?perPage=10");
      if (data && data.backups) {
        setBackups(data.backups);
        if (data.backups.length > 0) {
          const successBackups = data.backups.filter(b => b.status === "success");
          if (successBackups.length > 0) {
            setLastBackup(successBackups[0]);
          }
        }
      }
    } catch (e) {
      console.error("Gagal mengambil data backup", e);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleDownload = async (id, filename) => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/backups/${id}/download`, {
        headers: { Authorization: `Bearer ${getStoredToken()}` }
      }, 15000);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Gagal mengunduh backup.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `backup-${id}.dump`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Gagal mengunduh file backup: " + e.message);
    }
  };

  const triggerBackup = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/backups", { method: "POST" });
      await fetchBackups();
      setConfirm({
        title: "Backup Selesai",
        body: `Backup dengan ID ${res.backup?.id} berhasil dijalankan.`
      });
    } catch (e) {
      setConfirm({
        title: "Backup Gagal",
        body: `Gagal menjalankan backup: ${e.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmBackup = () => {
    setConfirm({
      title: "Jalankan backup sekarang?",
      body: "Database akan dibuatkan file backup, aktivitas dicatat di audit trail, dan status backup diperbarui.",
      onConfirm: triggerBackup
    });
  };

  const formatSize = (bytes) => {
    if (!bytes) return "-";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <section className="adminBackupPage">
      <header className="ajuanHeader">
        <div>
          <h1>Backup Data</h1>
          <p>Kelola backup database dan pastikan data penting tetap aman.</p>
        </div>
        <button className="newAjuanBtn" onClick={confirmBackup} disabled={loading}>
          <span><LineIcon name="upload" /></span>
          {loading ? "Memproses..." : "Backup Sekarang"}
        </button>
      </header>

      <section className="adminBackupGrid">
        <article className="dashPanel adminBackupStatus">
          <h3>Status Backup</h3>
          <div className="backupHeroIcon"><LineIcon name="shield" /></div>
          <strong>{lastBackup ? "Backup terakhir berhasil" : "Belum ada backup"}</strong>
          <p>
            {lastBackup
              ? `${new Date(lastBackup.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB. File tersimpan di storage lokal.`
              : "Silakan lakukan backup manual pertama Anda."}
          </p>
          <div className="backupStatusRows">
            <span>Jadwal otomatis <b>03:00 WIB</b></span>
            <span>Retensi file <b>30 hari</b></span>
            <span>Ukuran terakhir <b>{lastBackup ? formatSize(lastBackup.file_size) : "-"}</b></span>
          </div>
        </article>

        <article className="dashPanel adminBackupHistory">
          <PanelHeader
            title="Riwayat Backup"
            action="Export log"
            onClick={() => setConfirm({ title: "Export log backup?", body: "Riwayat backup akan diekspor sesuai filter aktif." })}
          />
          <table className="dashboardTable">
            <thead>
              <tr>
                <th>ID Backup</th>
                <th>Waktu</th>
                <th>Pelaksana</th>
                <th>Ukuran</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((bkp) => {
                const timeStr = new Date(bkp.created_at).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta"
                }) + " WIB";
                return (
                  <tr key={bkp.id}>
                    <td>{bkp.id.substring(0, 18)}...</td>
                    <td>{timeStr}</td>
                    <td>{bkp.created_by_name || "Sistem"}</td>
                    <td>{formatSize(bkp.file_size)}</td>
                    <td>
                      <Status text={bkp.status === "success" ? "Berhasil" : "Gagal"} />
                    </td>
                    <td>
                      {bkp.status === "success" && (
                        <button
                          className="viewBtn"
                          aria-label={`Download ${bkp.id}`}
                          onClick={() => handleDownload(bkp.id, bkp.filename)}
                        >
                          <LineIcon name="upload" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {backups.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                    Belum ada riwayat backup.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      </section>
    </section>
  );
}

function Notifications() {
  return <section className="gridTwo"><article className="panel"><div className="rowBetween"><h3>Notifikasi Internal</h3><span className="status waiting">4 pesan</span></div><NoticeList /></article><article className="panel"><h3>Riwayat Status</h3><div className="timeline">{["Login berhasil", "Ajuan surat dikirim", "Surat diteruskan", "Disposisi dibuat"].map((item) => <div className="timelineItem" key={item}><i /><div><strong>{item}</strong><span>Tercatat di audit trail Asia/Jakarta</span></div></div>)}</div></article></section>;
}

function ProfileSettings({ config, profile, role, setConfirm }) {
  return (
    <section className="profileSettingsPage">
      <header className="dashboardTitle">
        <h1>Pengaturan Profil</h1>
        <p>Kelola informasi akun dan preferensi notifikasi internal.</p>
      </header>

      <section className="profileSettingsGrid">
        <article className="dashPanel profileSummaryCard">
          <span className="avatarFace large" />
          <strong>{config.name}</strong>
          <small>{role}</small>
          <div className="profileMetaRows">
            <span>Unit Kerja <b>{profile.unit}</b></span>
            <span>Status Akun <b>Aktif</b></span>
            <span>Zona Waktu <b>Asia/Jakarta</b></span>
          </div>
        </article>

        <article className="dashPanel profileFormCard">
          <h3>Informasi Profil</h3>
          <form className="profileForm" onSubmit={(event) => {
            event.preventDefault();
            setConfirm({ title: "Simpan perubahan profil?", body: "Perubahan profil akan disimpan dan dicatat pada audit trail." });
          }}>
            <div className="formGrid">
              <label>Nama Lengkap<input name="name" defaultValue={config.name} /></label>
              <label>Role<input name="role" defaultValue={role} readOnly /></label>
              <label>Email<input name="email" type="email" defaultValue={profile.email} /></label>
              <label>Nomor HP<input name="phone" defaultValue={profile.phone} /></label>
              <label>Unit Kerja<input name="unit" defaultValue={profile.unit} /></label>
              <label>Preferensi Notifikasi<select name="notification"><option>Email dan aplikasi</option><option>Aplikasi saja</option><option>Email saja</option></select></label>
            </div>
            <label className="profileFullField">Alamat<textarea name="address" defaultValue={profile.address} /></label>
            <div className="actions">
              <button type="submit" className="primaryBtn">Simpan Perubahan</button>
            </div>
          </form>
        </article>
      </section>
    </section>
  );
}

function NoticeList() {
  return <div className="noticeList">{notifications.map(([title, body, unread]) => <div className={unread ? "notice unread" : "notice"} key={title}><strong>{title}</strong><span>{body}</span></div>)}</div>;
}

function Status({ text }) {
  const key = String(text).toLowerCase();
  const statusClassMap = {
    draft: "draft",
    baru: "new",
    "ajuan baru": "new",
    "perlu periksa": "needsCheck",
    "perlu verifikasi": "review",
    diproses: "process",
    diverifikasi: "verified",
    "menunggu approval": "approval",
    disetujui: "done",
    "siap dikirim": "ready",
    dikirim: "sent",
    terkirim: "sent",
    diteruskan: "sent",
    diterima: "received",
    selesai: "done",
    aktif: "done",
    ditolak: "rejected",
    "perlu revisi": "rejected",
    dikembalikan: "rejected",
    rahasia: "rejected",
    berhasil: "done",
    gagal: "rejected"
  };
  const kind = statusClassMap[key] || "waiting";
  return <span className={`status ${kind}`}>{text}</span>;
}

function Field({ label, error, children }) {
  return <label>{label}{children}{error && <small className="fieldError">{error}</small>}</label>;
}

function LoginField({ label, error, icon, action, actionLabel, actionPressed, onAction, children }) {
  return (
    <label className="loginField">
      {label}
      <span className="inputWrap">
        <span className={`inputIcon ${icon}`} aria-hidden="true"><LineIcon name={icon} /></span>
        {children}
        {action && (
          <button
            type="button"
            className={`inputAction ${action}`}
            aria-label={actionLabel || "Aksi input"}
            aria-pressed={actionPressed}
            onClick={onAction}
          >
            <LineIcon name={action} />
          </button>
        )}
      </span>
      {error && <small className="fieldError">{error}</small>}
    </label>
  );
}

function ConfirmModal({ confirm, setConfirm }) {
  const confirmAction = () => {
    confirm.onConfirm?.();
    setConfirm(null);
  };

  return (
    <div className="modalBackdrop" role="presentation" onClick={() => setConfirm(null)}>
      <section className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h3>{confirm.title}</h3>
        <p>{confirm.body}</p>
        <div className="actions end"><button className="ghostBtn" onClick={() => setConfirm(null)}>Batal</button><button className="primaryBtn" onClick={confirmAction}>Ya, lanjutkan</button></div>
      </section>
    </div>
  );
}
