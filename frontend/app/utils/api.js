const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function getToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

export function setToken(token) {
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle unauthorized globally
  if (response.status === 401) {
    setToken(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("unauthorized"));
    }
  }

  if (!response.ok) {
    let errorMessage = "Terjadi kesalahan pada server.";
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      // JSON parsing failed
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  // Auth endpoints
  async login(username, password) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  async logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      setToken(null);
    }
  },

  async getMe() {
    return request("/auth/me");
  },

  // User Management
  async getUsers({ page = 1, perPage = 10, search = "", role = "", status = "" } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      search,
      role,
      status
    });
    return request(`/users?${params.toString()}`);
  },

  async createUser(userData) {
    return request("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  },

  async updateUser(id, userData) {
    return request(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  },

  async deleteUser(id) {
    return request(`/users/${id}`, {
      method: "DELETE",
    });
  },

  async resetPassword(id, password) {
    return request(`/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  // Audit Logs
  async getAuditLogs({ page = 1, perPage = 20, search = "", module = "", status = "" } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      search,
      module,
      status
    });
    return request(`/audit-logs?${params.toString()}`);
  },

  async reviewAuditLog(id, reviewStatus, reviewNotes) {
    return request(`/audit-logs/${id}/review`, {
      method: "PUT",
      body: JSON.stringify({ status: reviewStatus, notes: reviewNotes }),
    });
  },

  // Database Backups
  async getBackups({ page = 1, perPage = 10 } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage)
    });
    const res = await request(`/backups?${params.toString()}`);
    if (res && res.data) {
      return {
        ...res,
        backups: res.data.map(b => ({
          id: b.id,
          backup_code: b.backup_code,
          status: b.status,
          file_size: b.file_size_bytes,
          notes: b.notes,
          created_at: b.executed_at,
          executed_at: b.executed_at,
          created_by_name: b.executor_name,
          filename: b.original_name
        }))
      };
    }
    return res;
  },

  async createBackup() {
    const res = await request("/backups", {
      method: "POST",
    });
    if (res && res.data) {
      return {
        ...res,
        backup: {
          id: res.data.id,
          backup_code: res.data.backup_code,
          status: res.data.status,
          file_size: res.data.file_size_bytes,
          notes: res.data.notes,
          created_at: res.data.executed_at,
          executed_at: res.data.executed_at,
          created_by_name: res.data.executor_name
        }
      };
    }
    return res;
  },

  async downloadBackup(id, filename) {
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      throw new Error("ID backup tidak valid.");
    }

    const token = getToken();
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/backups/${id}/download`, {
      headers,
    });

    if (!response.ok) {
      let errorMessage = "Gagal mengunduh backup.";
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {}
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeFilename = (filename || `backup-${id}.dump`).replace(/[^a-zA-Z0-9_.-]/g, "_");
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
};
