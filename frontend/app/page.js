"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "./utils/api";

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
    nav: ["Dashboard", "Surat Masuk", "Approval", "Disposisi"],
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
    ["SK-2026-018", "Surat Edaran", "Unit Internal", "Pembaruan SOP arsip", "Menunggu Approval"],
    ["SK-2026-017", "Surat Undangan", "Mitra Kerja", "Rapat evaluasi triwulan", "Disetujui"],
    ["SK-2026-016", "Surat Tugas", "Pegawai", "Kegiatan lapangan", "Dikirim"]
  ],
  Disposisi: [
    ["DSP-2026-021", "SM/109/V/2026", "Bagian Umum", "Segera tindak lanjuti", "Dikirim"],
    ["DSP-2026-020", "SM/106/V/2026", "Keuangan", "Telaah dan laporkan", "Ditindaklanjuti"],
    ["DSP-2026-019", "SM/103/V/2026", "Sekretariat", "Arsipkan setelah selesai", "Selesai"]
  ],
  Arsip: [
    ["ARS-1124", "Surat Masuk", "Permintaan data layanan", "PDF", "Selesai"],
    ["ARS-1123", "Ajuan Surat", "Pendampingan audit internal", "DOCX", "Disetujui"],
    ["ARS-1122", "Disposisi", "Telaah dan laporkan", "PDF", "Selesai"]
  ],
  "Arsip Digital": [
    ["ARS-1124", "Surat Masuk", "Permintaan data layanan", "PDF", "Selesai"],
    ["ARS-1123", "Ajuan Surat", "Pendampingan audit internal", "DOCX", "Disetujui"],
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

const initialAjuanRequests = [
  {
    nomor: "AJ/2025/05/00131",
    jenis: "Surat Izin Penelitian",
    pemohon: "Nadia Putri",
    unit: "Akademik",
    tanggal: "20 Mei 2025",
    status: "Ajuan Baru",
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
  {
    nomor: "AJ/2025/05/00130",
    jenis: "Surat Tugas",
    pemohon: "Budi Santoso",
    unit: "Umum",
    tanggal: "20 Mei 2025",
    status: "Perlu Verifikasi",
    tujuan: "Unit Umum STT Pekerjaan Umum Jakarta",
    judul: "Surat tugas pendampingan kegiatan seminar internal",
    keterangan: "Pemohon mengajukan surat tugas untuk mendampingi pelaksanaan kegiatan seminar internal dan membantu koordinasi administrasi kegiatan.",
    nim: "202102144",
    nik: "3173052208010002",
    email: "budi.santoso@student.ac.id",
    phone: "0812-2201-1440",
    lampiran: [["Term_Of_Reference.pdf", "384 KB", "Diunggah 20 Mei 2025, 11:20 WIB"]]
  },
  { nomor: "AJ/2025/05/00129", jenis: "Surat Permohonan", pemohon: "Sari Pegawai", unit: "Keuangan", tanggal: "19 Mei 2025", status: "Disetujui" },
  { nomor: "AJ/2025/05/00128", jenis: "Surat Keterangan", pemohon: "Andi Wijaya", unit: "Akademik", tanggal: "19 Mei 2025", status: "Perlu Verifikasi" },
  { nomor: "AJ/2025/05/00127", jenis: "Surat Undangan", pemohon: "Rina Lestari", unit: "Kemahasiswaan", tanggal: "19 Mei 2025", status: "Ajuan Baru" },
  { nomor: "AJ/2025/05/00126", jenis: "Surat Izin Penelitian", pemohon: "Fajar Ramadhan", unit: "Akademik", tanggal: "18 Mei 2025", status: "Disetujui" },
  { nomor: "AJ/2025/05/00125", jenis: "Surat Tugas", pemohon: "Luthfi Hakim", unit: "Umum", tanggal: "18 Mei 2025", status: "Ditolak" },
  { nomor: "AJ/2025/05/00124", jenis: "Surat Permohonan", pemohon: "Dewi Kartika", unit: "Keuangan", tanggal: "17 Mei 2025", status: "Perlu Verifikasi" }
];

const initialUsers = [
  ["USR-001", "Rina Operator", "Operator", "Tata Usaha", "Aktif"],
  ["USR-002", "Dewi Pimpinan", "Pimpinan", "Kepala Bagian", "Aktif"],
  ["USR-003", "Budi Santoso", "User", "Kepegawaian", "Aktif"]
];

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState("User");
  const [view, setView] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [ajuanRequests, setAjuanRequests] = useState(initialAjuanRequests);
  const [userRows, setUserRows] = useState(initialUsers);
  const [currentUser, setCurrentUser] = useState(null);
  const [auditRows, setAuditRows] = useState([]);

  function resolveRoleName(roleCode) {
    const map = {
      administrator: "Administrator",
      operator: "Operator",
      pimpinan: "Pimpinan",
      user: "User",
      pegawai: "Pegawai"
    };
    return map[roleCode] || "User";
  }

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getUsers({ perPage: 100 });
      if (data && data.data) {
        const mapped = data.data.map(u => [
          u.id,
          u.full_name,
          u.role,
          u.unit || "-",
          u.status === "aktif" ? "Aktif" : "Nonaktif"
        ]);
        setUserRows(mapped);
      }
    } catch (e) {
      console.error("Gagal memuat pengguna", e);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    try {
      const data = await api.getAuditLogs({ perPage: 100 });
      if (data && data.data) {
        const mapped = data.data.map(log => {
          const dateStr = new Date(log.created_at).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit"
          }) + " WIB";
          
          return [
            dateStr,
            log.user_name || "Sistem",
            log.module,
            log.activity,
            log
          ];
        });
        setAuditRows(mapped);
      }
    } catch (e) {
      console.error("Gagal memuat audit log", e);
    }
  }, []);

  useEffect(() => {
    async function loadMe() {
      try {
        const data = await api.getMe();
        if (data && data.user) {
          setCurrentUser(data.user);
          const mappedRole = resolveRoleName(data.user.role_code);
          setRole(mappedRole);
          setLoggedIn(true);
        }
      } catch (error) {
        localStorage.removeItem("token");
      }
    }
    loadMe();
  }, []);

  useEffect(() => {
    if (loggedIn && role === "Administrator") {
      loadUsers();
      loadAuditLogs();
    }
  }, [loggedIn, role, loadUsers, loadAuditLogs]);

  useEffect(() => {
    function handleUnauthorized() {
      setLoggedIn(false);
      setCurrentUser(null);
      setView("Dashboard");
    }
    window.addEventListener("unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("unauthorized", handleUnauthorized);
    };
  }, []);

  const config = useMemo(() => {
    const base = roleConfig[role] || roleConfig.User;
    return {
      ...base,
      name: currentUser ? currentUser.full_name : base.name
    };
  }, [role, currentUser]);

  const utilityViews = ["Notifikasi", "Pengaturan Profil"];
  const currentView = config.nav.includes(view) || utilityViews.includes(view) ? view : "Dashboard";
  const sidebarNavItems = config.nav;
  const activeNavIndex = Math.max(sidebarNavItems.indexOf(currentView), 0);
  const unreadCount = notifications.filter((item) => item[2]).length;

  async function login(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = form.get("username");
    const password = form.get("password");
    setErrors({});
    try {
      const data = await api.login(username, password);
      if (data && data.user) {
        setCurrentUser(data.user);
        const mappedRole = resolveRoleName(data.user.role_code);
        setRole(mappedRole);
        setLoggedIn(true);
        setView("Dashboard");
      }
    } catch (error) {
      setErrors({ form: error.message || "Login gagal. Username atau password salah." });
    }
  }

  async function logout() {
    setProfileOpen(false);
    try {
      await api.logout();
    } catch (e) {
      console.error("Logout error", e);
    }
    localStorage.removeItem("token");
    setLoggedIn(false);
    setCurrentUser(null);
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
      const ext = file.name.split(".").pop().toLowerCase();
      if (!["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(ext)) nextErrors.file = "Format harus PDF, DOC, DOCX, JPG, JPEG, atau PNG.";
      if (file.size > 10 * 1024 * 1024) nextErrors.file = "Ukuran file maksimal 10 MB.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) setConfirm({ title: "Simpan data?", body: "Data akan disimpan dan aktivitasnya masuk audit trail." });
  }

  function createAjuanRequest(request) {
    setAjuanRequests((current) => [request, ...current]);
    setConfirm({ title: "Ajuan terkirim", body: `${request.nomor} sudah masuk ke portal operator dengan status Ajuan Baru.` });
  }

  async function createUser(user) {
    try {
      const payload = {
        fullName: user.name,
        username: user.username,
        email: user.email,
        password: user.password,
        role: user.role,
        unit: user.unit,
        position: user.jabatan,
        status: user.status === "Aktif" ? "aktif" : "nonaktif"
      };
      await api.createUser(payload);
      loadUsers();
      setConfirm({ title: "User tersimpan", body: `${user.name} sudah ditambahkan ke daftar pengguna.` });
    } catch (error) {
      setConfirm({ title: "Gagal menyimpan", body: error.message });
    }
  }

  const handleDeleteUser = async (id, name) => {
    try {
      await api.deleteUser(id);
      loadUsers();
      setConfirm({ title: "User terhapus", body: `${name} telah berhasil dinonaktifkan.` });
    } catch (error) {
      setConfirm({ title: "Gagal menghapus", body: error.message });
    }
  };

  const handleResetPassword = async (id, name) => {
    try {
      await api.resetPassword(id, "Reset123!");
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
            <h2>Login E-Office</h2>
            <p className="muted">Silakan masuk untuk melanjutkan</p>
            <form onSubmit={login} noValidate>
              <LoginField label="Email / Username" error={errors.username} icon="user">
                <input name="username" placeholder="Masukkan email atau username" />
              </LoginField>
              <LoginField label="Password" error={errors.password} icon="lock" action="eye">
                <input name="password" type="password" placeholder="Masukkan password" />
              </LoginField>
              <label className="roleSelect">Role Demo
                <select value={role} onChange={(event) => setRole(event.target.value)}>
                  {Object.keys(roleConfig).map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <div className="loginOptions">
                <label className="rememberCheck"><input type="checkbox" defaultChecked /> Ingat saya</label>
                <button type="button" className="linkBtn">Lupa password?</button>
              </div>
              <button className="primaryBtn">Login</button>
            </form>
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
          {currentView === "Dashboard" && (role === "Operator" ? <OperatorDashboard setView={setView} /> : role === "Pimpinan" ? <PimpinanDashboard setView={setView} /> : role === "Administrator" ? <AdminDashboard setView={setView} /> : <Dashboard config={config} role={role} setView={setView} />)}
          {currentView === "Pengaturan Profil" && <ProfileSettings config={config} role={role} setConfirm={setConfirm} />}
          {currentView === "Notifikasi" && <Notifications />}
          {currentView === "Laporan" && <Reports setConfirm={setConfirm} />}
          {currentView === "Approval" && <Approval setConfirm={setConfirm} />}
          {currentView === "Ajuan Surat" && <AjuanSuratHome setConfirm={setConfirm} onCreateAjuan={createAjuanRequest} currentUserName={config.name} ajuanRequests={ajuanRequests} />}
          {currentView === "Ajuan Masuk" && <OperatorAjuanMasuk setConfirm={setConfirm} ajuanRequests={ajuanRequests} />}
          {currentView === "Surat Masuk" && <IncomingLetterForm role={role} setConfirm={setConfirm} />}
          {currentView === "Disposisi Masuk" && <DisposisiMasukHome setConfirm={setConfirm} />}
          {currentView === "Arsip" && <ArchiveHome setConfirm={setConfirm} />}
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
              onCreateUser={createUser}
              auditRows={auditRows}
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
  const value = String(username || "").toLowerCase();
  if (value.includes("operator") || value.includes("rina") || value.includes("tu")) return "Operator";
  if (value.includes("pimpinan") || value.includes("dewi")) return "Pimpinan";
  if (value.includes("admin") || value.includes("administrator")) return "Administrator";
  if (value.includes("pegawai")) return "Pegawai";
  if (value.includes("user") || value.includes("budi")) return "User";
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
            <thead><tr><th>Nomor Surat</th><th>Jenis Surat</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
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
    ["Ajuan Masuk", "27", "Butuh verifikasi", "inbox", "blue", "Ajuan Masuk"],
    ["Surat Masuk", "124", "7 belum diteruskan", "mail", "purple", "Surat Masuk"],
    ["Surat Keluar", "76", "9 menunggu approval", "send", "green", "Surat Keluar"],
    ["Perlu Verifikasi", "11", "Prioritas hari ini", "clock", "orange", "Ajuan Masuk"]
  ];
  const verificationRows = [
    ["AJ/2025/05/00131", "Surat Izin Penelitian", "Nadia Putri", "Dokumen lengkap", "Baru"],
    ["AJ/2025/05/00130", "Surat Tugas", "Budi Santoso", "Perlu cek lampiran", "Perlu Periksa"],
    ["AJ/2025/05/00129", "Surat Permohonan", "Andi Wijaya", "Menunggu nomor agenda", "Perlu Verifikasi"],
    ["AJ/2025/05/00128", "Surat Keterangan", "Sari Pegawai", "Siap diteruskan", "Diverifikasi"]
  ];
  const notices = [
    ["inbox", "Ajuan baru perlu diverifikasi", "AJ/2025/05/00131 - Surat Izin Penelitian", "8 menit lalu", "orange"],
    ["mail", "Surat masuk belum diteruskan", "AG/2025/05/00124 menunggu pimpinan", "22 menit lalu", "purple"],
    ["send", "Draft surat keluar siap dicek", "SK/2025/05/00076 perlu nomor surat", "1 jam lalu", "green"]
  ];

  return (
    <section className="dashboardPage">
      <div className="dashboardTitle">
        <h1>Dashboard Operator</h1>
        <p>Ringkasan verifikasi ajuan, surat masuk, dan surat keluar.</p>
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
          <PanelHeader title="Ajuan Perlu Diverifikasi" action="Lihat semua" onClick={() => setView("Ajuan Masuk")} />
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

function PimpinanDashboard({ setView }) {
  const cards = [
    ["Review Masuk", "17", "Surat perlu dibaca", "mail", "blue", "Surat Masuk"],
    ["Approval", "9", "Surat keluar menunggu", "check", "purple", "Approval"],
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
    ["Approval surat edaran SOP", "Cek final draft sebelum disetujui", "check"],
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

function AdminDashboard({ setView }) {
  const [usersCount, setUsersCount] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [auditTodayCount, setAuditTodayCount] = useState(0);
  const [lastBackupText, setLastBackupText] = useState("-");
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentAudits, setRecentAudits] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const usersRes = await api.getUsers({ perPage: 5 });
        if (usersRes && usersRes.data) {
          setRecentUsers(usersRes.data);
          setUsersCount(usersRes.meta?.totalCount || usersRes.data.length);
        }

        const allUsersRes = await api.getUsers({ perPage: 100 });
        if (allUsersRes && allUsersRes.data) {
          const activeCount = allUsersRes.data.filter(u => u.status === "aktif").length;
          setActiveUsersCount(activeCount);
        }

        const auditRes = await api.getAuditLogs({ perPage: 10 });
        if (auditRes && auditRes.data) {
          const today = new Date().toDateString();
          const todayCount = auditRes.data.filter(log => new Date(log.created_at).toDateString() === today).length;
          setAuditTodayCount(todayCount);

          const mappedAudits = auditRes.data.slice(0, 5).map(log => {
            const timeStr = new Date(log.created_at).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
              hour: "2-digit",
              minute: "2-digit"
            }) + " WIB";
            return [timeStr, log.user_name || "Sistem", log.module, log.activity];
          });
          setRecentAudits(mappedAudits);
        }

        const backupsRes = await api.getBackups({ perPage: 5 });
        if (backupsRes && backupsRes.backups) {
          const successBackups = backupsRes.backups.filter(b => b.status === "success");
          if (successBackups.length > 0) {
            const lastTime = new Date(successBackups[0].executed_at).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
              hour: "2-digit",
              minute: "2-digit"
            }) + " WIB";
            setLastBackupText(lastTime);
          }
        }
      } catch (err) {
        console.error("Gagal mengambil data dashboard admin:", err);
      }
    }
    fetchData();
  }, []);

  const resolveRoleLabel = (roleCode) => {
    const map = {
      administrator: "Administrator",
      operator: "Operator",
      pimpinan: "Pimpinan",
      user: "User",
      pegawai: "Pegawai"
    };
    return map[roleCode] || roleCode;
  };

  const cards = [
    ["Total Pengguna", String(usersCount), `${activeUsersCount} akun aktif`, "user", "blue", "Pengguna"],
    ["Role Sistem", "5", "RBAC dasar aktif", "shield", "purple", "Pengguna"],
    ["Audit Hari Ini", String(auditTodayCount), "Aktivitas tercatat", "clock", "orange", "Audit Trail"],
    ["Backup", lastBackupText, "Terakhir berhasil", "upload", "green", "Backup"]
  ];

  return (
    <section className="dashboardPage">
      <div className="dashboardTitle">
        <h1>Dashboard Administrator</h1>
        <p>Ringkasan pengguna, role, audit trail, backup, dan kesehatan sistem.</p>
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
              {recentUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.id.substring(0, 8)}...</td>
                  <td>{u.full_name}</td>
                  <td>{resolveRoleLabel(u.role)}</td>
                  <td>{u.unit || "-"}</td>
                  <td><Status text={u.status === "aktif" ? "Aktif" : "Nonaktif"} /></td>
                  <td><button className="viewBtn" onClick={() => setView("Pengguna")} aria-label={`Detail ${u.full_name}`}><LineIcon name="eye" /></button></td>
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

function OperatorAjuanMasuk({ setConfirm, ajuanRequests }) {
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedAjuan, setSelectedAjuan] = useState(null);
  const [ajuanSearch, setAjuanSearch] = useState("");
  const summary = [
    ["Ajuan Baru", String(ajuanRequests.filter((item) => item.status === "Ajuan Baru").length), "Masuk hari ini", "inbox", "blue"],
    ["Perlu Verifikasi", String(ajuanRequests.filter((item) => item.status === "Perlu Verifikasi").length), "Menunggu pemeriksaan", "clock", "orange"],
    ["Disetujui", String(ajuanRequests.filter((item) => item.status === "Disetujui").length), "Siap diproses", "check", "green"],
    ["Ditolak", String(ajuanRequests.filter((item) => item.status === "Ditolak").length), "Perlu revisi", "x", "red"]
  ];
  const rows = ajuanRequests.map((item) => [item.nomor, item.jenis, item.pemohon, item.unit, item.tanggal, item.status, item]);
  const filteredRows = rows.filter((row) => {
    const matchesStatus = statusFilter ? row[5] === statusFilter : true;
    const matchesSearch = row.join(" ").toLowerCase().includes(ajuanSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (selectedAjuan) {
    return <AjuanMasukDetail ajuan={selectedAjuan} detail={selectedAjuan[6]} onBack={() => setSelectedAjuan(null)} setConfirm={setConfirm} />;
  }

  return (
    <section className="operatorPage">
      <header className="ajuanHeader ajuanMasukHero">
        <div>
          <h1>Ajuan Masuk</h1>
          <p>Periksa kelengkapan data dan dokumen sebelum ajuan diproses lebih lanjut.</p>
        </div>
      </header>

      <section className="ajuanStatusGrid">
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
            <p>Kelola pengajuan berdasarkan status, pemohon, unit, atau jenis surat.</p>
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

function AjuanMasukDetail({ ajuan, detail, onBack, setConfirm }) {
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [nomor, jenis, pemohon, unit, tanggal, status] = ajuan;
  const applicantName = pemohon.toUpperCase();
  const studyProgram = unit === "Akademik" ? "Teknik Sipil" : unit;
  const requestDetail = detail || {
    nim: "202101891",
    nik: "3309190107020006",
    email: `${pemohon.toLowerCase().replace(/\s+/g, ".")}@student.ac.id`,
    phone: "0812-3456-7890",
    tujuan: unit === "Akademik" ? "Bagian Akademik STT Pekerjaan Umum Jakarta" : `Bagian ${unit} STT Pekerjaan Umum Jakarta`,
    judul: jenis,
    keterangan: `Pemohon mengajukan ${jenis.toLowerCase()} melalui portal user untuk diproses oleh operator sesuai alur administrasi e-office.`,
    lampiran: [["Dokumen_Pendukung.pdf", "320 KB", `Diunggah ${tanggal}, 16:05 WIB`]]
  };

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
            <div className="requestInfoGrid">
              <DetailItem icon="user" label="Nama Pemohon" value={applicantName} />
              <DetailItem icon="doc" label="NIM" value={requestDetail.nim} />
              <DetailItem icon="briefcase" label="Program Studi" value={studyProgram} />
              <DetailItem icon="doc" label="NIK" value={requestDetail.nik} />
              <DetailItem icon="mail" label="Email" value={requestDetail.email} />
              <DetailItem icon="phone" label="Nomor Telepon" value={requestDetail.phone} />
            </div>
          </article>

          <article className="requestCard">
            <h2><span className="titleIconBox"><LineIcon name="clipboard" /></span> Detail Pengajuan</h2>
            <div className="requestRows">
              <DetailItem icon="info" label="Nomor Surat" value={nomor} />
              <DetailItem icon="info" label="Jenis Surat" value={jenis} />
              <DetailItem icon="bank" label="Tujuan" value={requestDetail.tujuan} wide />
              <DetailItem icon="edit" label="Judul Surat" value={requestDetail.judul} wide />
              <DetailItem icon="tag" label="Kategori" value={unit || "Akademik"} wide />
              <div className="detailItem wide description">
                <LineIcon name="clipboard" />
                <span>Keterangan Pemohon</span>
                <strong>{requestDetail.keterangan}</strong>
              </div>
            </div>
          </article>

          <article className="requestCard">
            <h2><LineIcon name="upload" /> Lampiran Dokumen</h2>
            <div className="attachmentList">
              {requestDetail.lampiran.map(([name, size, meta]) => (
                <div className="requestAttachment" key={name}>
                  <span><LineIcon name="doc" /></span>
                  <div>
                    <strong>{name}</strong>
                    <small>{size} - {meta}</small>
                  </div>
                  <div className="requestAttachmentActions">
                    <button className="softBtn"><LineIcon name="eye" /> Pratinjau</button>
                    <button className="primaryBtn"><LineIcon name="upload" /> Unduh</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="requestSide">
          <article className={verificationOpen ? "requestActionCard verificationActive" : "requestActionCard"}>
            <h2><LineIcon name="shield" /> Tindakan Verifikasi</h2>
            {!verificationOpen ? (
              <>
                <p>Pilih tindakan untuk pengajuan ini</p>
                <button className="successAction" onClick={() => setVerificationOpen(true)}><LineIcon name="check" /> Proses Verifikasi</button>
                <button className="warningAction" onClick={() => setConfirm({ title: "Minta revisi?", body: "Pemohon akan menerima catatan revisi untuk melengkapi pengajuan." })}><LineIcon name="refresh" /> Minta Revisi</button>
                <button className="rejectAction" onClick={() => setConfirm({ title: "Tolak pengajuan?", body: "Ajuan akan ditolak dan pemohon menerima notifikasi." })}><LineIcon name="x" /> Tolak Pengajuan</button>
              </>
            ) : (
              <VerificationProcessPanel nomor={nomor} setConfirm={setConfirm} onCancel={() => setVerificationOpen(false)} />
            )}
          </article>

        </aside>
      </section>
    </section>
  );
}

function VerificationProcessPanel({ nomor, setConfirm, onCancel }) {
  const checklist = [
    ["Detail Pengajuan", "Jenis surat, tujuan, kategori, dan kebutuhan pengajuan sudah jelas."]
  ];

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
          <select defaultValue="valid">
            <option value="valid">Data lengkap dan valid</option>
            <option value="review">Perlu pemeriksaan lanjutan</option>
          </select>
        </label>
        <label>
          Teruskan ke
          <select defaultValue="akademik">
            <option value="akademik">Bagian Akademik</option>
            <option value="kemahasiswaan">Bagian Kemahasiswaan</option>
            <option value="pimpinan">Pimpinan</option>
          </select>
        </label>
      </div>

      <div className="verificationActions">
        <button type="button" className="ghostBtn" onClick={onCancel}>Batal</button>
        <button type="button" className="primaryBtn" onClick={() => setConfirm({ title: "Kirim proses verifikasi?", body: `${nomor} akan ditandai lengkap dan diteruskan ke tahap berikutnya.` })}><LineIcon name="check" /> Kirim Proses</button>
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

function UploadDropzone({ label, name, accept, formats }) {
  return (
    <label className="uploadDropzone">
      {label && <strong className="uploadDropzoneLabel">{label}</strong>}
      <input name={name} type="file" accept={accept} />
      <span><LineIcon name="upload" /></span>
      <b>Klik untuk unggah <em>atau seret file ke sini</em></b>
      <small>{formats}</small>
    </label>
  );
}

function IncomingLetterForm({ role, setConfirm }) {
  if (role === "Pimpinan") return <PimpinanIncomingReview setConfirm={setConfirm} />;

  const recipients = ["Waket I", "Waket II", "Waket III", "Prodi TS", "Prodi TI", "Prodi TL", "Unit LPPM", "Unit LPMI"];
  const instructions = ["Untuk diketahui", "Teliti dan proses lebih lanjut", "Bicarakan dengan saya", "Minta pendapat saudari", "Siapkan jawaban", "Setuju"];

  return (
    <section className="incomingPage">
      <header className="ajuanHeader">
        <div>
          <h1>Form Surat Masuk</h1>
          <p>Registrasi surat masuk eksternal, buat nomor agenda, dan teruskan kepada pimpinan.</p>
        </div>
      </header>

      <form className="incomingPaper" onSubmit={(event) => event.preventDefault()}>
        <section className="incomingBox incomingTop">
          <div className="incomingTo">
            <span>Kepada Yth.</span>
            {["Ketua", "Waket I", "Waket II", "Waket III"].map((item) => (
              <label key={item}><input type="checkbox" /> {item}</label>
            ))}
          </div>
          <div className="incomingFields">
            <label>Dari <input placeholder="Nama instansi / pengirim" /></label>
            <label>Perihal <input placeholder="Perihal surat" /></label>
            <label>No. / Tgl Surat <input placeholder="Nomor surat dan tanggal surat" /></label>
            <label>Tgl Terima <input type="date" /></label>
          </div>
          <label className="agendaField">No. Agenda <input placeholder="AG-2026-001" /></label>
        </section>

        <section className="incomingMiddle">
          <div className="incomingBox">
            <h3>Kepada Yth.</h3>
            <div className="checkLineList">
              {recipients.map((item) => <label key={item}>{item}<input type="checkbox" /></label>)}
            </div>
          </div>
          <div className="incomingBox">
            <h3>Instruksi</h3>
            <div className="checkLineList">
              {instructions.map((item) => <label key={item}>{item}<input type="checkbox" /></label>)}
            </div>
          </div>
        </section>

        <section className="incomingBox incomingBottom">
          <label>Proses lebih lanjut <textarea rows={2} placeholder="Tuliskan tindak lanjut yang dibutuhkan" /></label>
          <label>Kepada Yth. <input placeholder="Tujuan tindak lanjut" /></label>
          <label>Isi <textarea rows={7} placeholder="Catatan isi surat / disposisi awal" /></label>
        </section>

        <section className="incomingBox incomingUploadInline">
          <div className="rowBetween">
            <div>
              <h3>Upload Dokumen</h3>
              <p>Lampirkan scan surat masuk sebelum diteruskan ke pimpinan.</p>
            </div>
            <span className="status waiting">Maks. 10 MB</span>
          </div>
          <div className="archiveNotice">
            <LineIcon name="info" />
            <span>Format file: <strong>PDF</strong>, <strong>DOC</strong>, <strong>DOCX</strong>, <strong>JPG</strong>, <strong>JPEG</strong>, atau <strong>PNG</strong>. Dokumen akan ikut tersimpan saat surat diteruskan.</span>
          </div>
          <div className="incomingUploadFields">
            <label>Jenis Dokumen
              <select>
                <option>Surat Masuk</option>
                <option>Lampiran Surat Masuk</option>
                <option>Bukti Tindak Lanjut</option>
              </select>
            </label>
            <div className="uploadField">
              <strong>File Dokumen</strong>
              <UploadDropzone accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" formats="PDF, DOC, DOCX, JPG, JPEG, PNG (Maks. 10 MB)" />
            </div>
          </div>
          <div className="incomingPreviewHint">
            <LineIcon name="eye" />
            <span>Preview PDF atau gambar akan ditampilkan setelah file dipilih. DOC/DOCX memakai fallback detail file.</span>
          </div>
        </section>

        <div className="incomingActions">
          <button type="button" className="softBtn" onClick={() => setConfirm({ title: "Simpan draft?", body: "Data surat masuk disimpan sebagai draft registrasi." })}>Simpan Draft</button>
          <button type="button" className="primaryBtn" onClick={() => setConfirm({ title: "Teruskan ke pimpinan?", body: "Data surat masuk dan dokumen otomatis disimpan, status berubah menjadi diteruskan, dan pimpinan menerima notifikasi." })}>Teruskan ke Pimpinan</button>
        </div>
      </form>
    </section>
  );
}

function getIncomingLetterDetail(row) {
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
  const incomingRows = [
    ["AG-2026-041", "SM/109/V/2026", "Dinas Kominfo", "Permintaan data layanan", "Diteruskan"],
    ["AG-2026-040", "SM/108/V/2026", "Bappeda", "Koordinasi program", "Diteruskan"],
    ["AG-2026-039", "SM/107/V/2026", "Inspektorat", "Jadwal audit", "Didisposisikan"]
  ];

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
        <button className="newAjuanBtn" onClick={() => setDispositionSource("manual")}>
          <span><LineIcon name="send" /></span>
          Disposisi Manual
        </button>
      </header>

      <section className="previewLayout">
        <article className="tableShell">
          <div className="rowBetween">
            <h3>Surat Masuk Diteruskan</h3>
            <span className="status waiting">3 perlu review</span>
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

        <aside className="previewPane">
          <h3>Preview Dokumen Surat</h3>
          <div className="documentFrame">
            <div className="documentPage">
              <h4>SURAT MASUK</h4>
              <p>AG-2026-041 | SM/109/V/2026</p>
              <div className="docLines"><i /><i /><i /><i /></div>
            </div>
          </div>
          <p className="muted">Pimpinan memberi komentar setelah membaca dokumen yang dikirim operator.</p>
        </aside>
      </section>
    </section>
  );
}

function PimpinanIncomingDetail({ detail, onBack }) {
  return (
    <section className="incomingPage dispositionDetailPage">
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
              {detail.lampiran.map(([name, size, meta]) => (
                <div key={name}>
                  <span><LineIcon name="doc" /></span>
                  <strong>{name}</strong>
                  <small>{size} - {meta}</small>
                </div>
              ))}
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
        </aside>
      </section>
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

function ArchiveHome({ setConfirm }) {
  const [archiveFilter, setArchiveFilter] = useState(null);
  const archiveSummary = [
    ["Total Arsip", "217", "Semua dokumen otomatis", "folder", "blue"],
    ["Ajuan Selesai", "86", "Masuk dari approval", "check", "green"],
    ["Surat Masuk", "74", "Masuk setelah selesai", "mail", "purple"],
    ["Disposisi", "32", "Tindak lanjut selesai", "clipboard", "orange"]
  ];
  const archiveRows = [
    ["AJ/2025/05/00128", "Ajuan Surat", "Surat Izin Penelitian", "16 Mei 2025", "Otomatis", "Disetujui"],
    ["SM/109/V/2026", "Surat Masuk", "Permintaan data layanan", "15 Mei 2025", "Otomatis", "Selesai"],
    ["SK/2026/018", "Surat Keluar", "Pembaruan SOP arsip", "15 Mei 2025", "Otomatis", "Dikirim"],
    ["DSP/2026/020", "Disposisi", "Telaah dan laporkan", "14 Mei 2025", "Otomatis", "Selesai"],
    ["AJ/2025/05/00124", "Ajuan Surat", "Surat Keterangan Aktif", "14 Mei 2025", "Otomatis", "Disetujui"]
  ];
  const archiveFilterMap = {
    "Ajuan Selesai": "Ajuan Surat",
    "Surat Masuk": "Surat Masuk",
    Disposisi: "Disposisi"
  };
  const filteredArchiveRows = archiveFilter ? archiveRows.filter((row) => row[1] === archiveFilterMap[archiveFilter]) : archiveRows;

  return (
    <section className="archivePage">
      <header className="ajuanHeader">
        <div>
          <h1>Arsip Digital</h1>
          <p>Arsip dibuat otomatis dari surat dan ajuan yang sudah selesai, tanpa upload dokumen ulang.</p>
        </div>
        <button className="newAjuanBtn" onClick={() => setConfirm({ title: "Sinkronkan arsip otomatis?", body: "Sistem akan mengambil data surat/ajuan/disposisi yang sudah selesai untuk masuk arsip." })}>
          <span><LineIcon name="refresh" /></span>
          Sinkron Arsip
        </button>
      </header>

      <section className="ajuanStatusGrid">
        {archiveSummary.map(([label, value, meta, icon, tone]) => (
          <button type="button" className={`ajuanStatusCard clickable ${tone}`} key={label} onClick={() => setArchiveFilter(label === "Total Arsip" ? null : label)} aria-label={`Filter arsip ${label}`}>
            <span className="icon3d">{iconSymbol(icon)}</span>
            <div><small>{label}</small><strong>{value}</strong><p>{meta}</p></div>
          </button>
        ))}
      </section>

      <article className="ajuanHistory">
        <div className="panelHeader">
          <h3>{archiveFilter ? `Daftar Arsip - ${archiveFilter}` : "Daftar Arsip Otomatis"}</h3>
          <button onClick={() => setArchiveFilter(null)}>Semua arsip <span aria-hidden="true">-&gt;</span></button>
        </div>
        <div className="archiveNotice">
          <LineIcon name="info" />
          <span>Dokumen masuk arsip otomatis ketika status proses menjadi <strong>Disetujui</strong>, <strong>Dikirim</strong>, atau <strong>Selesai</strong>. Upload hanya opsional untuk lampiran pendukung.</span>
        </div>
        <table className="dashboardTable ajuanHistoryTable archiveTable">
          <thead><tr><th>Nomor Surat</th><th>Sumber</th><th>Perihal</th><th>Tanggal Arsip</th><th>Metode</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {filteredArchiveRows.map((row) => (
              <tr key={row[0]}>
                <td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td><span className="autoBadge">{row[4]}</span></td><td><Status text={row[5]} /></td>
                <td><button className="viewBtn" aria-label={`Lihat ${row[0]}`}><LineIcon name="eye" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

function AjuanSuratHome({ setConfirm, onCreateAjuan, currentUserName, ajuanRequests }) {
  const [statusFilter, setStatusFilter] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const statusCards = [
    ["Draf", "6", "Belum dikirim", "doc", "blue"],
    ["Diproses", "5", "Sedang berjalan", "clock", "purple"],
    ["Disetujui", "18", "Telah disetujui", "check", "green"],
    ["Ditolak", "2", "Ditolak", "x", "red"]
  ];
  const guideSteps = [
    "Pilih jenis surat yang sesuai dengan kebutuhan Anda.",
    "Lengkapi data dan informasi dengan benar.",
    "Unggah dokumen pendukung (jika diperlukan).",
    "Kirim ajuan dan pantau status hingga selesai."
  ];
  const stages = [
    ["1. Draft Ajuan", "Buat dan lengkapi data ajuan", "send", "purple"],
    ["2. Diperiksa", "Diperiksa oleh Admin", "briefcase", "blue"],
    ["3. Direview", "Direview oleh Pimpinan", "shield", "blue"],
    ["4. Disetujui", "Ajuan disetujui dan selesai", "check", "blue"]
  ];
  const staticHistory = [
    ["1", "AJ/2025/05/00128", "Surat Izin Penelitian", "Permohonan Izin Penelitian", "16 Mei 2025", "Diproses"],
    ["2", "AJ/2025/05/00127", "Surat Tugas", "Penugasan Seminar Internal", "15 Mei 2025", "Disetujui"],
    ["3", "AJ/2025/05/00126", "Surat Permohonan", "Permohonan Sarana Prasarana", "15 Mei 2025", "Diproses"],
    ["4", "AJ/2025/05/00125", "Surat Undangan", "Undangan Rapat Koordinasi", "14 Mei 2025", "Disetujui"],
    ["5", "AJ/2025/05/00124", "Surat Keterangan", "Surat Keterangan Aktif Kuliah", "14 Mei 2025", "Ditolak"]
  ];
  const syncedHistory = ajuanRequests
    .filter((item) => item.pemohon === currentUserName)
    .map((item, index) => [
      String(index + 1),
      item.nomor,
      item.jenis,
      item.judul || item.jenis,
      item.tanggal,
      item.status === "Ditolak" ? "Ditolak" : item.status === "Disetujui" ? "Disetujui" : "Diproses"
    ]);
  const history = syncedHistory.length > 0 ? syncedHistory : staticHistory;
  const statusFilterMap = { Draf: "Draft", Diproses: "Diproses", Disetujui: "Disetujui", Ditolak: "Ditolak" };
  const filteredHistory = statusFilter ? history.filter((row) => row[5] === statusFilterMap[statusFilter]) : history;

  if (createOpen) {
    return <AjuanSuratCreate onCancel={() => setCreateOpen(false)} setConfirm={setConfirm} onCreateAjuan={onCreateAjuan} currentUserName={currentUserName} />;
  }

  return (
    <section className="ajuanPage">
      <header className="ajuanHeader">
        <div>
          <h1>Ajuan Surat</h1>
          <p>Buat pengajuan surat baru dan pantau riwayat pengajuan</p>
        </div>
        <button className="newAjuanBtn createAjuanBtn" onClick={() => setCreateOpen(true)}>
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
          <h2>Tahapan Pengajuan Surat</h2>
          <div className="stageRail">
            {stages.map(([title, body, icon, tone], index) => (
              <div className={`stageItem ${tone}`} key={title}>
                <span className="stageIcon">{iconSymbol(icon)}</span>
                {index < stages.length - 1 && <b aria-hidden="true" />}
                <strong>{title}</strong>
                <small>{body}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="ajuanHistory">
        <div className="panelHeader">
          <h3>{statusFilter ? `Riwayat Pengajuan - ${statusFilter}` : "Riwayat Pengajuan"}</h3>
          <button onClick={() => setStatusFilter(null)}>Lihat semua <span aria-hidden="true">-&gt;</span></button>
        </div>
        <table className="dashboardTable ajuanHistoryTable">
          <thead><tr><th>No.</th><th>Nomor Surat</th><th>Jenis Surat</th><th>Perihal</th><th>Tanggal Ajuan</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {filteredHistory.map((row) => (
              <tr key={row[0]}>
                <td>{row[0]}</td>
                <td>{row[1]}</td>
                <td>{row[2]}</td>
                <td>{row[3]}</td>
                <td>{row[4]}</td>
                <td><Status text={row[5]} /></td>
                <td><button className="viewBtn" aria-label={`Lihat detail ${row[1]}`}><LineIcon name="eye" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ajuanTableFooter">
          <div className="ajuanPages"><button disabled>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div>
          <div className="ajuanRows">Tampilkan <select><option>5</option><option>10</option></select> dari 25 data</div>
        </div>
      </article>
    </section>
  );
}

function AjuanSuratCreate({ onCancel, setConfirm, onCreateAjuan, currentUserName }) {
  function submitAjuan(event) {
    event.preventDefault();
    const submitter = event.nativeEvent.submitter;
    const form = new FormData(event.currentTarget);
    if (submitter?.value === "draft") {
      setConfirm({ title: "Simpan sebagai draft?", body: "Ajuan akan tersimpan sebagai draft dan dapat dilengkapi sebelum dikirim." });
      return;
    }

    const nomor = String(form.get("nomor") || "").trim();
    const jenis = String(form.get("jenis") || "").trim();
    const tujuan = String(form.get("tujuan") || "").trim();
    const judul = String(form.get("judul") || "").trim();
    const keterangan = String(form.get("keterangan") || "").trim();
    const file = form.get("lampiran");
    const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    onCreateAjuan({
      nomor,
      jenis,
      pemohon: currentUserName || "Budi Santoso",
      unit: "Akademik",
      tanggal: today,
      status: "Ajuan Baru",
      tujuan,
      judul,
      keterangan,
      nim: "202101891",
      nik: "3309190107020006",
      email: "budi.santoso@student.ac.id",
      phone: "0812-3456-7890",
      lampiran: file?.name ? [[file.name, `${Math.max(1, Math.round(file.size / 1024))} KB`, `Diunggah ${today}`]] : [["Dokumen pendukung belum diunggah", "-", `Ajuan dikirim ${today}`]]
    });
    onCancel();
  }

  return (
    <section className="ajuanCreatePage">
      <header className="dispositionCreateHeader">
        <div>
          <h1>Buat Ajuan Surat</h1>
          <p>Lengkapi data pengajuan surat, unggah lampiran jika diperlukan, lalu kirim konsep ke operator.</p>
        </div>
      </header>

      <section className="ajuanCreateGrid">
        <form className="ajuanCreateForm" onSubmit={submitAjuan}>
          <article className="dispositionFormCard">
            <h2><span className="createSectionIcon"><LineIcon name="doc" /></span> Data Ajuan</h2>
            <div className="adminUserFields ajuanCreateFields">
              <label>Nomor Surat <span>*</span>
                <input name="nomor" placeholder="Contoh: 001/UNIV/V/2026" required />
              </label>
              <label>Jenis Surat <span>*</span>
                <select name="jenis" defaultValue="" required>
                  <option value="" disabled>Pilih jenis surat</option>
                  <option>Surat Undangan</option>
                  <option>Surat Edaran/Surat Pengumuman</option>
                  <option>Surat Permohonan</option>
                  <option>Surat Keputusan</option>
                  <option>Surat Tugas</option>
                  <option>Surat Keterangan</option>
                  <option>Surat Lainnya</option>
                </select>
              </label>
              <label>Tujuan Surat <span>*</span>
                <input name="tujuan" placeholder="Contoh: Kepala Bagian Akademik" required />
              </label>
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><span className="createSectionIcon"><LineIcon name="edit" /></span> Isi Pengajuan</h2>
            <div className="ajuanCreateStack">
              <label>Judul Surat <span>*</span>
                <input name="judul" placeholder="Contoh: Permohonan Izin Penelitian" required />
              </label>
              <label>Keterangan <span>*</span>
                <textarea name="keterangan" rows={6} placeholder="Tuliskan kebutuhan, latar belakang, atau keterangan singkat ajuan surat." required />
              </label>
              <UploadDropzone label="Upload Dokumen Pendukung" name="lampiran" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" formats="PDF, DOC, DOCX, JPG, JPEG, PNG. Maksimal 10 MB." />
            </div>
          </article>

          <div className="dispositionSubmitBar">
            <button type="button" className="ghostBtn" onClick={onCancel}>Batal</button>
            <button type="submit" name="intent" value="draft" className="softBtn" formNoValidate><LineIcon name="doc" /> Simpan Draft</button>
            <button type="submit" name="intent" value="send" className="primaryBtn"><LineIcon name="send" /> Kirim Ajuan</button>
          </div>
        </form>

        <aside className="ajuanCreateSide">
          <div className="processHero" aria-hidden="true">
            <span><LineIcon name="doc" /></span>
            <b><LineIcon name="check" /></b>
          </div>
          <h3>Ringkasan Proses</h3>
          {[
            ["Draft", "Data ajuan dapat disimpan sebelum dikirim.", "doc"],
            ["Dikirim", "Operator menerima ajuan untuk diperiksa.", "send"],
            ["Approval", "Pimpinan menyetujui atau menolak ajuan.", "user"],
            ["Selesai", "Surat final masuk ke arsip digital.", "check"]
          ].map(([title, body, icon]) => (
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
  const [followupDraft, setFollowupDraft] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
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
  const filteredDispositions = statusFilter ? dispositionItems.filter((row) => row[5] === statusFilterMap[statusFilter]) : dispositionItems;
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
                <UploadDropzone accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" formats="PDF, DOC, DOCX, JPG, JPEG, PNG (Maks. 10 MB)" />
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

function getOutgoingLetterDetail(row) {
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
      tanggal: "15 Mei 2026",
      penerima: tujuan,
      sifat: "Biasa",
      penandatangan: "Pimpinan",
      pembuat: "Operator",
      ringkasan: perihal,
      lampiran: [["Dokumen_Surat_Keluar.pdf", "512 KB", "Diunggah operator"]],
      riwayat: [["15 Mei 2026, 09:00 WIB", "Data surat keluar dibuat"]]
    })
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
  onCreateUser,
  auditRows,
  onUserDelete,
  onUserResetPassword,
  onAuditReviewSuccess
}) {
  const [openForms, setOpenForms] = useState({});
  const [dispositionAction, setDispositionAction] = useState(null);
  const [outgoingAction, setOutgoingAction] = useState(null);
  const [auditAction, setAuditAction] = useState(null);
  const sourceRows = view === "Pengguna" ? userRows : view === "Audit Trail" ? (auditRows || []) : (rows[view] || rows["Ajuan Surat"]);
  
  const data = useMemo(() => {
    return sourceRows.filter((row) => {
      const stringified = row.map(cell => {
        if (typeof cell === "object" && cell !== null) return "";
        return String(cell);
      }).join(" ");
      return stringified.toLowerCase().includes(query.toLowerCase());
    });
  }, [query, sourceRows]);

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
      />
    );
  }

  if (view === "Pengguna" && openForms[view]) {
    return (
      <AdminUserCreate
        onCancel={() => setOpenForms((current) => ({ ...current, [view]: false }))}
        setConfirm={setConfirm}
        onCreateUser={(user) => {
          onCreateUser(user);
          setOpenForms((current) => ({ ...current, [view]: false }));
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
    const detail = getOutgoingLetterDetail(outgoingAction.row);
    if (outgoingAction.mode === "detail") {
      return <OutgoingLetterDetail detail={detail} onBack={() => setOutgoingAction(null)} />;
    }
    return <OutgoingLetterProcess detail={detail} onBack={() => setOutgoingAction(null)} setConfirm={setConfirm} />;
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

  return (
    <section className={formVisible ? "previewLayout" : "previewLayout singleColumn"}>
      <article className="tableShell">
        <div className="rowBetween">
          <h3>{view === "Disposisi" ? "Monitoring Disposisi" : view}</h3>
          {!readOnlyList && <button className="primaryBtn" onClick={handleAddData}>{view === "Pengguna" ? "Add User" : "Tambah Data"}</button>}
        </div>
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

function AdminUserCreate({ onCancel, onCreateUser }) {
  function saveUser(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const role = String(form.get("role") || "").trim();
    const status = String(form.get("status") || "Aktif").trim();
    const unit = String(form.get("unit") || "").trim();
    const username = String(form.get("username") || "").trim();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "").trim();
    const jabatan = String(form.get("jabatan") || "").trim();
    if (!name || !role || !username || !password) return;
    onCreateUser({ name, role, status, unit, username, email, password, jabatan });
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
                  <option>Pegawai</option>
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
            ["User/Pegawai", "Ajuan surat, menerima disposisi, dan akses surat tertentu."]
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
      await api.reviewAuditLog(detail.id, status, notes);
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
        <table>
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
          <UploadDropzone label="Upload Dokumen Pendukung (Opsional)" name="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" formats="PDF, DOC, DOCX, JPG, JPEG, PNG (Maks. 10 MB)" />
          {errors.file && <small className="fieldError">{errors.file}</small>}
        </div>
        <div className="actions">
          {onCancel && <button type="button" className="ghostBtn" onClick={onCancel}>Batal</button>}
          <button className="primaryBtn">{isDisposition ? "Kirim Disposisi" : "Simpan Draft"}</button>
        </div>
      </form>
    </aside>
  );
}

function OutgoingLetterForm({ onCancel, setConfirm }) {
  return (
    <section className="outgoingPage">
      <header className="outgoingTitle">
        <h1>Surat Keluar</h1>
      </header>

      <section className="outgoingGrid">
        <article className="outgoingCard">
          <h2>Form Surat Keluar</h2>
          <form className="outgoingForm" onSubmit={(event) => event.preventDefault()}>
            <label>Nomor Surat <span>*</span>
              <input placeholder="Contoh: SK/2025/05/0088" />
            </label>
            <label>Tanggal Surat <span>*</span>
              <input type="date" defaultValue="2025-05-22" />
            </label>
            <label>Jenis Surat <span>*</span>
              <select defaultValue="">
                <option value="" disabled>Pilih jenis surat</option>
                <option>Surat Undangan</option>
                <option>Surat Tugas</option>
                <option>Surat Edaran</option>
                <option>Surat Permohonan</option>
              </select>
            </label>
            <label>Tujuan Surat <span>*</span>
              <select defaultValue="">
                <option value="" disabled>Pilih tujuan surat</option>
                <option>Instansi Eksternal</option>
                <option>Unit Internal</option>
                <option>Pegawai</option>
                <option>Mitra Kerja</option>
              </select>
            </label>
            <label>Instansi / Penerima <span>*</span>
              <input placeholder="Ketik nama instansi atau penerima" />
            </label>
            <label>Perihal <span>*</span>
              <input placeholder="Ketik perihal surat" />
            </label>
            <label className="wideField">Sifat Surat
              <select defaultValue="">
                <option value="" disabled>Pilih sifat surat</option>
                <option>Biasa</option>
                <option>Penting</option>
                <option>Segera</option>
                <option>Rahasia</option>
              </select>
            </label>
            <label className="wideField">Isi Ringkas / Deskripsi Surat <span>*</span>
              <textarea rows={4} maxLength={1000} placeholder="Tuliskan isi ringkas atau deskripsi surat secara singkat dan jelas..." />
              <small>0 / 1000</small>
            </label>
            <section className="wideField outgoingAttachment">
              <h3>Lampiran / Dokumen</h3>
              <UploadDropzone accept=".pdf,.doc,.docx,.xls,.xlsx" formats="PDF, DOC, DOCX, XLS, XLSX (Maks. 10 MB)" />
            </section>
            <div className="outgoingActions wideField">
              <button type="button" className="outlineBtn" onClick={onCancel}>Batal</button>
              <button type="button" className="draftBtn" onClick={() => setConfirm({ title: "Simpan draft surat keluar?", body: "Surat keluar disimpan sebagai draft dan belum dikirim untuk approval." })}><LineIcon name="doc" /> Simpan Draft</button>
              <button type="button" className="primaryBtn sendBtn" onClick={() => setConfirm({ title: "Kirim surat keluar?", body: "Surat keluar akan disimpan dan masuk proses pemeriksaan/approval." })}><LineIcon name="send" /> Kirim Surat</button>
            </div>
          </form>
        </article>

        <aside className="outgoingGuide">
          <h2><LineIcon name="doc" /> Panduan Surat Keluar</h2>
          <ul>
            <li>Lengkapi seluruh data surat keluaran dengan benar.</li>
            <li>Pastikan nomor surat belum digunakan.</li>
            <li>Unggah lampiran pendukung jika ada.</li>
            <li>Pilih pejabat penandatangan yang sesuai.</li>
            <li>Simpan draft terlebih dahulu sebelum diajukan.</li>
            <li>Ajukan approval untuk proses pemeriksaan.</li>
          </ul>
        </aside>
      </section>
    </section>
  );
}

function OutgoingLetterDetail({ detail, onBack, backLabel = "Kembali ke Surat Keluar" }) {
  return (
    <section className="incomingPage dispositionDetailPage outgoingDetailPage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> {backLabel}</button>
          <h1>Detail Surat Keluar</h1>
          <p>Ringkasan metadata, dokumen, status approval, dan riwayat aktivitas surat keluar.</p>
        </div>
        <Status text={detail.status} />
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="send" /> Informasi Surat</h2>
              <span className={detail.sifat === "Segera" ? "priority high" : "priority"}>{detail.sifat}</span>
            </div>
            <div className="dispositionSourceRows">
              <DetailItem icon="doc" label="Nomor Surat" value={detail.nomor} />
              <DetailItem icon="info" label="Jenis Surat" value={detail.jenis} />
              <DetailItem icon="calendar" label="Tanggal Surat" value={detail.tanggal} />
              <DetailItem icon="bank" label="Tujuan" value={detail.tujuan} />
              <DetailItem icon="user" label="Penerima" value={detail.penerima} />
              <DetailItem icon="shield" label="Penandatangan" value={detail.penandatangan} />
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="clipboard" /> Perihal dan Ringkasan</h2>
            <div className="dispositionNoteBox">
              <small>Perihal</small>
              <strong>{detail.perihal}</strong>
              <p>{detail.ringkasan}</p>
            </div>
          </article>

          <article className="dispositionFormCard">
            <h2><LineIcon name="upload" /> Dokumen</h2>
            <div className="attachmentList">
              {detail.lampiran.map(([name, size, meta]) => (
                <div key={name}>
                  <span><LineIcon name="doc" /></span>
                  <strong>{name}</strong>
                  <small>{size} | {meta}</small>
                </div>
              ))}
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
          <h3>Preview Naskah</h3>
          <div className="documentFrame">
            <div className="documentPage">
              <h4>{detail.jenis.toUpperCase()}</h4>
              <p>Nomor: {detail.nomor}</p>
              <p>Kepada: {detail.penerima}</p>
              <div className="docLines"><i /><i /><i /><i /></div>
            </div>
          </div>
          <div className="dispositionFlow">
            <h3>Status Proses</h3>
            {["Draft", "Menunggu Approval", "Disetujui", "Dikirim"].map((item, index) => (
              <p key={item} className={item === detail.status ? "active" : ""}><b>{index + 1}</b>{item}</p>
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}

function ApprovalLetterProcess({ detail, onBack, setConfirm }) {
  return (
    <section className="incomingPage dispositionDetailPage approvalProcessPage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Approval</button>
          <h1>Proses Approval Surat</h1>
          <p>Periksa naskah surat keluar, beri catatan pimpinan, lalu setujui atau tolak pengajuan.</p>
        </div>
        <Status text={detail.status} />
      </header>

      <section className="dispositionCreateGrid">
        <div className="dispositionMain">
          <article className="dispositionSourceCard">
            <div className="rowBetween">
              <h2><LineIcon name="check" /> Naskah Menunggu Keputusan</h2>
              <span className={detail.sifat === "Segera" ? "priority high" : "priority"}>{detail.sifat}</span>
            </div>
            <div className="dispositionSourceRows">
              <DetailItem icon="doc" label="Nomor Surat" value={detail.nomor} />
              <DetailItem icon="info" label="Jenis Surat" value={detail.jenis} />
              <DetailItem icon="bank" label="Tujuan" value={detail.tujuan} />
              <DetailItem icon="mail" label="Perihal" value={detail.perihal} />
              <DetailItem icon="user" label="Dibuat Oleh" value={detail.pembuat} />
              <DetailItem icon="shield" label="Penandatangan" value={detail.penandatangan} />
            </div>
          </article>

          <form className="dispositionForm" onSubmit={(event) => event.preventDefault()}>
            <section className="dispositionFormCard">
              <h2><LineIcon name="clipboard" /> Review Pimpinan</h2>
              <div className="dispositionNoteBox">
                <small>Ringkasan surat</small>
                <strong>{detail.perihal}</strong>
                <p>{detail.ringkasan}</p>
              </div>
              <label className="dispositionTextArea">
                Catatan Approval
                <textarea rows={5} placeholder="Tuliskan catatan persetujuan, revisi, atau alasan penolakan." />
              </label>
            </section>

            <section className="dispositionFormCard">
              <h2><LineIcon name="clock" /> Riwayat Pengajuan</h2>
              <div className="dispositionTimeline">
                {detail.riwayat.map(([time, activity]) => (
                  <p key={`${time}-${activity}`}><i /><span>{time}</span><strong>{activity}</strong></p>
                ))}
              </div>
            </section>

            <div className="dispositionSubmitBar">
              <button type="button" className="dangerBtn" onClick={() => setConfirm({ title: "Tolak surat keluar?", body: `Catatan penolakan untuk ${detail.nomor} wajib diisi, status menjadi Ditolak, operator menerima notifikasi, dan audit trail dicatat.` })}>Reject</button>
              <button type="button" className="primaryBtn" onClick={() => setConfirm({ title: "Setujui surat keluar?", body: `${detail.nomor} akan berubah menjadi Disetujui, operator menerima notifikasi, dan audit trail dicatat.` })}><LineIcon name="check" /> Approve</button>
            </div>
          </form>
        </div>

        <aside className="dispositionPreview">
          <h3>Preview Naskah</h3>
          <div className="documentFrame">
            <div className="documentPage">
              <h4>{detail.jenis.toUpperCase()}</h4>
              <p>Nomor: {detail.nomor}</p>
              <p>Kepada: {detail.penerima}</p>
              <div className="docLines"><i /><i /><i /><i /></div>
            </div>
          </div>
          <div className="dispositionFlow">
            <h3>Alur Approval</h3>
            {["Baca naskah", "Isi catatan", "Approve atau reject", "Notifikasi operator"].map((item, index) => (
              <p key={item}><b>{index + 1}</b>{item}</p>
            ))}
          </div>
        </aside>
      </section>
    </section>
  );
}

function OutgoingLetterProcess({ detail, onBack, setConfirm }) {
  const canSend = detail.status === "Disetujui";
  const canSubmitApproval = detail.status !== "Dikirim" && detail.status !== "Menunggu Approval";
  return (
    <section className="incomingPage dispositionDetailPage outgoingProcessPage">
      <header className="dispositionCreateHeader">
        <div>
          <button type="button" className="backLink" onClick={onBack}><LineIcon name="arrowLeft" /> Kembali ke Surat Keluar</button>
          <h1>Proses Surat Keluar</h1>
          <p>Perbarui status, unggah dokumen final, ajukan approval, atau kirim surat yang sudah disetujui.</p>
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

          <form className="dispositionForm" onSubmit={(event) => event.preventDefault()}>
            <section className="dispositionFormCard dispositionMetaForm">
              <label>
                Status Proses
                <select defaultValue={detail.status}>
                  <option>Draft</option>
                  <option>Menunggu Approval</option>
                  <option>Disetujui</option>
                  <option>Dikirim</option>
                  <option>Ditolak</option>
                </select>
              </label>
              <label>
                Tanggal Kirim
                <input type="date" defaultValue="2026-05-18" />
              </label>
              <label>
                Metode Pengiriman
                <select defaultValue="Email">
                  <option>Email</option>
                  <option>Ekspedisi</option>
                  <option>Diambil Langsung</option>
                </select>
              </label>
            </section>

            <section className="dispositionFormCard">
              <h2><LineIcon name="clipboard" /> Catatan Proses</h2>
              <div className="dispositionNoteBox">
                <small>Ringkasan surat</small>
                <strong>{detail.perihal}</strong>
                <p>{detail.ringkasan}</p>
              </div>
              <label className="dispositionTextArea">
                Catatan Operator
                <textarea rows={5} placeholder="Tuliskan catatan pemeriksaan, revisi, nomor resi, atau keterangan pengiriman." />
              </label>
              <div className="uploadField">
                <strong>Dokumen Final / Bukti Kirim</strong>
                <UploadDropzone accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" formats="PDF, DOC, DOCX, JPG, JPEG, PNG (Maks. 10 MB)" />
              </div>
            </section>

            <div className="dispositionSubmitBar">
              <button type="button" className="softBtn" onClick={() => setConfirm({ title: "Simpan perubahan proses?", body: `Status, catatan, dan lampiran ${detail.nomor} akan diperbarui serta dicatat di audit trail.` })}><LineIcon name="check" /> Simpan Proses</button>
              <button type="button" className="softBtn" disabled={!canSubmitApproval} onClick={() => setConfirm({ title: "Ajukan approval?", body: `${detail.nomor} akan dikirim ke pimpinan untuk approval dan notifikasi dibuat.` })}><LineIcon name="send" /> Ajukan Approval</button>
              <button type="button" className="primaryBtn" disabled={!canSend} onClick={() => setConfirm({ title: "Kirim surat keluar?", body: `${detail.nomor} akan ditandai dikirim, masuk arsip digital, dan aktivitas tercatat di audit trail.` })}><LineIcon name="send" /> Kirim Surat</button>
            </div>
          </form>
        </div>

        <aside className="dispositionPreview">
          <h3>Alur Surat Keluar</h3>
          <div className="dispositionFlow">
            {["Draft", "Ajukan approval", "Approval pimpinan", "Kirim dan arsipkan"].map((item, index) => (
              <p key={item}><b>{index + 1}</b>{item}</p>
            ))}
          </div>
          <div className="followupResultBox">
            <span><LineIcon name="archive" /></span>
            <strong>Arsip Otomatis</strong>
            <p>Setelah surat dikirim, dokumen final masuk arsip digital dan dapat dicari lewat nomor surat.</p>
          </div>
        </aside>
      </section>
    </section>
  );
}

function Approval({ setConfirm }) {
  const [approvalAction, setApprovalAction] = useState(null);
  const approvalRows = rows["Surat Keluar"].filter((row) => row[4] === "Menunggu Approval" || row[4] === "Disetujui");

  if (approvalAction) {
    const detail = getOutgoingLetterDetail(approvalAction.row);
    if (approvalAction.mode === "detail") {
      return <OutgoingLetterDetail detail={detail} onBack={() => setApprovalAction(null)} backLabel="Kembali ke Approval" />;
    }
    return <ApprovalLetterProcess detail={detail} onBack={() => setApprovalAction(null)} setConfirm={setConfirm} />;
  }

  return (
    <section className="previewLayout">
      <article className="tableShell">
        <div className="rowBetween"><h3>Menunggu Approval</h3><span className="status waiting">{approvalRows.length} item</span></div>
        <DataTable
          heads={tableHeads["Surat Keluar"]}
          data={approvalRows}
          setConfirm={setConfirm}
          view="Approval"
          onDetail={(row) => setApprovalAction({ mode: "detail", row })}
          onProcess={(row) => setApprovalAction({ mode: "process", row })}
        />
      </article>
      <aside className="previewPane">
        <h3>Preview Naskah</h3>
        <div className="documentFrame"><div className="documentPage"><h4>SURAT EDARAN</h4><p>Nomor: SK-2026-018</p><div className="docLines"><i /><i /><i /><i /></div></div></div>
        <div className="actions"><button className="primaryBtn" onClick={() => setConfirm({ title: "Setujui surat?", body: "Surat berubah menjadi disetujui dan operator menerima notifikasi." })}>Approve</button><button className="dangerBtn" onClick={() => setConfirm({ title: "Tolak surat?", body: "Catatan alasan penolakan wajib diisi pada implementasi backend." })}>Reject</button></div>
      </aside>
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
      const data = await api.getBackups();
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
      await api.downloadBackup(id, filename);
    } catch (e) {
      alert("Gagal mengunduh file backup: " + e.message);
    }
  };

  const triggerBackup = async () => {
    setLoading(true);
    try {
      const res = await api.createBackup();
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

function ProfileSettings({ config, role, setConfirm }) {
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
            <span>Unit Kerja <b>{role === "User" ? "Kepegawaian" : role === "Operator" ? "Tata Usaha" : role === "Administrator" ? "Sistem Informasi" : "Pimpinan"}</b></span>
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
              <label>Email<input name="email" type="email" defaultValue={`${config.name.toLowerCase().replaceAll(" ", ".")}@stt-pu.ac.id`} /></label>
              <label>Nomor HP<input name="phone" defaultValue="0812-3456-7890" /></label>
              <label>Unit Kerja<input name="unit" defaultValue={role === "User" ? "Kepegawaian" : "Tata Usaha"} /></label>
              <label>Preferensi Notifikasi<select name="notification"><option>Email dan aplikasi</option><option>Aplikasi saja</option><option>Email saja</option></select></label>
            </div>
            <label className="profileFullField">Alamat<textarea name="address" defaultValue="Jl. D.I. Panjaitan Kav. 24, Jakarta Timur" /></label>
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
    diterima: "received",
    selesai: "done",
    aktif: "done",
    ditolak: "rejected",
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

function LoginField({ label, error, icon, action, children }) {
  return (
    <label className="loginField">
      {label}
      <span className="inputWrap">
        <span className={`inputIcon ${icon}`} aria-hidden="true"><LineIcon name={icon} /></span>
        {children}
        {action && <span className={`inputAction ${action}`} aria-hidden="true"><LineIcon name={action} /></span>}
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
