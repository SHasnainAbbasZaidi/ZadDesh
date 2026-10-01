import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Edit2,
  Trash2,
  X,
  Check,
  Lock,
  Ban,
} from "lucide-react";

export default function UserManagementModal({
  onClose,
  apiFetch,
  currentUser,
  addToast,
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("Editor");
  const [error, setError] = useState("");

  // Editing User state
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState("Editor");
  const [adminPassword, setAdminPassword] = useState("");
  const confirmAdmin = async () => {
    const response = await apiFetch("/api/auth/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    });
    setAdminPassword("");
    if (!response.ok) {
      addToast(
        "Enter your own password to confirm this account change.",
        "error",
      );
      return false;
    }
    return true;
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/users");
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
    } catch {
      addToast("Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (!(await confirmAdmin())) return;
      const res = await apiFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(`User ${newUsername} created successfully.`, "success");
        setNewUsername("");
        setNewPassword("");
        setShowAddForm(false);
        loadUsers();
      } else {
        setError(data.error || "Failed to create user");
      }
    } catch {
      setError("Connection failed.");
    }
  };

  const handleToggleDisable = async (u) => {
    try {
      if (!(await confirmAdmin())) return;
      const res = await apiFetch(`/api/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !u.disabled }),
      });
      if (res.ok) {
        addToast(
          `User ${u.username} ${u.disabled ? "enabled" : "disabled"}.`,
          "success",
        );
        loadUsers();
      }
    } catch {
      addToast("Failed to update user status.", "error");
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const body = { role: editRole };
      if (!(await confirmAdmin())) return;
      const res = await apiFetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        addToast("User updated successfully.", "success");
        setEditingUser(null);
        loadUsers();
      } else {
        addToast(data.error || "Update failed", "error");
      }
    } catch {
      addToast("Update failed", "error");
    }
  };

  const handleDeleteUser = async (u) => {
    if (
      !window.confirm(`Are you sure you want to delete user "${u.username}"?`)
    )
      return;
    try {
      if (!(await confirmAdmin())) return;
      const res = await apiFetch(`/api/users/${u.id}`, { method: "DELETE" });
      if (res.ok) {
        addToast(`User ${u.username} deleted.`, "success");
        loadUsers();
      }
    } catch {
      addToast("Failed to delete user", "error");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 24, maxWidth: 740 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--accent-glow)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                User Management & RBAC
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Manage team access, roles, and permissions
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ fontSize: "0.85rem" }}
            >
              <UserPlus size={16} /> Add User
            </button>
            <button className="btn btn-secondary btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <label className="field" style={{ marginBottom: 16 }}>
          Confirm with your password before each account change
          <input
            type="password"
            autoComplete="current-password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
        </label>
        <p style={{ marginBottom: 16, color: "var(--text-muted)" }}>
          Each workspace is private. Administrators cannot read another user’s
          entries, credentials, layout, or activity, or reset their password.
        </p>
        {/* Add User Form */}
        {showAddForm && (
          <div
            className="glass-panel"
            style={{
              padding: 16,
              marginBottom: 20,
              border: "1px solid var(--border-glass-hover)",
            }}
          >
            <h4
              style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}
            >
              Create New User Account
            </h4>
            {error && (
              <p
                style={{
                  color: "#f87171",
                  fontSize: "0.8rem",
                  marginBottom: 10,
                }}
              >
                {error}
              </p>
            )}
            <form
              onSubmit={handleCreateUser}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <input
                type="text"
                className="glass-input"
                placeholder="Username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
              <input
                type="password"
                className="glass-input"
                placeholder="Initial Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <select
                className="glass-input"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="Admin" style={{ background: "#0f172a" }}>
                  Admin (Account Management)
                </option>
                <option value="Editor" style={{ background: "#0f172a" }}>
                  Editor (Manage Shortcuts)
                </option>
                <option value="Viewer" style={{ background: "#0f172a" }}>
                  Viewer (Read Only)
                </option>
              </select>
              <button type="submit" className="btn btn-primary">
                Create
              </button>
            </form>
          </div>
        )}

        {/* Edit User Form */}
        {editingUser && (
          <div
            className="glass-panel"
            style={{
              padding: 16,
              marginBottom: 20,
              border: "1px solid var(--border-glass-hover)",
            }}
          >
            <h4
              style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12 }}
            >
              Edit User: {editingUser.username}
            </h4>
            <form
              onSubmit={handleSaveEdit}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr auto auto",
                gap: 10,
                alignItems: "center",
              }}
            >
              <select
                className="glass-input"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              >
                <option value="Admin" style={{ background: "#0f172a" }}>
                  Admin
                </option>
                <option value="Editor" style={{ background: "#0f172a" }}>
                  Editor
                </option>
                <option value="Viewer" style={{ background: "#0f172a" }}>
                  Viewer
                </option>
              </select>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Users Table */}
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border-glass)",
                  color: "var(--text-muted)",
                }}
              >
                <th style={{ padding: "10px 8px" }}>User</th>
                <th style={{ padding: "10px 8px" }}>Role</th>
                <th style={{ padding: "10px 8px" }}>2FA Status</th>
                <th style={{ padding: "10px 8px" }}>Status</th>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: "1px solid var(--border-glass)" }}
                >
                  <td style={{ padding: "12px 8px", fontWeight: 600 }}>
                    {u.username}{" "}
                    {u.id === currentUser.id && (
                      <span
                        style={{ color: "var(--accent)", fontSize: "0.75rem" }}
                      >
                        (You)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <span
                      className="badge"
                      style={{
                        background:
                          u.role === "Admin"
                            ? "rgba(0, 242, 254, 0.15)"
                            : "rgba(255, 255, 255, 0.05)",
                        color:
                          u.role === "Admin"
                            ? "var(--accent)"
                            : "var(--text-muted)",
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <span
                      style={{
                        color: u.has_totp
                          ? "var(--status-online)"
                          : "var(--text-dim)",
                      }}
                    >
                      {u.has_totp ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <span
                      style={{
                        color: u.disabled ? "#f87171" : "var(--status-online)",
                      }}
                    >
                      {u.disabled ? "Disabled" : "Active"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 6,
                      }}
                    >
                      <button
                        className="btn btn-secondary btn-icon"
                        style={{ width: 28, height: 28 }}
                        onClick={() => {
                          setEditingUser(u);
                          setEditRole(u.role);
                        }}
                        title="Edit Role"
                      >
                        <Edit2 size={13} />
                      </button>
                      {u.id !== currentUser.id && (
                        <>
                          <button
                            className="btn btn-secondary btn-icon"
                            style={{
                              width: 28,
                              height: 28,
                              color: u.disabled
                                ? "var(--status-online)"
                                : "#f87171",
                            }}
                            onClick={() => handleToggleDisable(u)}
                            title={
                              u.disabled ? "Enable Account" : "Disable Account"
                            }
                          >
                            <Ban size={13} />
                          </button>
                          <button
                            className="btn btn-secondary btn-icon"
                            style={{ width: 28, height: 28, color: "#f87171" }}
                            onClick={() => handleDeleteUser(u)}
                            title="Delete User"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
