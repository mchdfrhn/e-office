import { spawn } from "node:child_process";
import net from "node:net";

const rootDir = new URL("../", import.meta.url);
const backendDir = new URL("../backend/", import.meta.url);
const frontendDir = new URL("../frontend/", import.meta.url);
const children = [];

function runNpm(args, cwd, name) {
  console.log(`[E-Office] Menjalankan ${name}...`);
  const child = spawn("npm", args, {
    cwd,
    shell: true,
    stdio: "inherit",
    windowsHide: true
  });

  child.serviceName = name;
  children.push(child);
  child.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[E-Office] ${name} berhenti (${signal || `kode ${code}`}).`);
      shutdown(1);
    }
  });
  return child;
}

function canConnect(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.setTimeout(750);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    const fail = () => {
      socket.destroy();
      resolve(false);
    };
    socket.once("error", fail);
    socket.once("timeout", fail);
  });
}

async function backendReady() {
  try {
    const response = await fetch("http://127.0.0.1:8000/api/health", {
      signal: AbortSignal.timeout(1000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function frontendReady() {
  // Next.js dapat membutuhkan waktu cukup lama untuk kompilasi halaman pertama.
  // Port yang sudah listening cukup untuk mencegah instance dev duplikat.
  return canConnect(3000);
}

async function waitUntil(check, label, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} tidak siap dalam ${Math.ceil(timeoutMs / 1000)} detik.`);
}

let shuttingDown = false;
function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n[E-Office] Menghentikan layanan yang dijalankan dari terminal ini...");
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 1000).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  console.log(`[E-Office] Root proyek: ${rootDir.pathname}`);

  if (await canConnect(5432)) {
    console.log("[E-Office] PostgreSQL sudah aktif di port 5432.");
  } else {
    runNpm(["run", "db:start"], backendDir, "PostgreSQL");
    await waitUntil(() => canConnect(5432), "PostgreSQL", 30000);
    console.log("[E-Office] PostgreSQL siap.");
  }

  if (await canConnect(8000)) {
    console.log("[E-Office] Backend sudah aktif di http://127.0.0.1:8000.");
  } else {
    runNpm(["run", "dev"], backendDir, "backend");
    await waitUntil(backendReady, "Backend", 30000);
    console.log("[E-Office] Backend siap di http://127.0.0.1:8000.");
  }

  if (await frontendReady()) {
    console.log("[E-Office] Frontend sudah aktif di http://localhost:3000.");
  } else {
    runNpm(["run", "dev"], frontendDir, "frontend");
    await waitUntil(frontendReady, "Frontend", 60000);
    console.log("[E-Office] Frontend siap di http://localhost:3000.");
  }

  console.log("\n[E-Office] Semua layanan siap. Tekan Ctrl+C untuk menghentikannya.");

  if (children.length === 0) {
    console.log("[E-Office] Semua layanan sebelumnya sudah berjalan; tidak ada proses baru yang dibuat.");
  } else {
    await new Promise(() => {});
  }
}

main().catch((error) => {
  console.error(`[E-Office] Gagal: ${error.message}`);
  shutdown(1);
});
