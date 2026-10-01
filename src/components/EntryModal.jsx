import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  KeyRound,
  Globe,
  Terminal,
  Monitor,
  Radio,
  Shield,
  Check,
  Lock,
} from "lucide-react";
import IconPicker from "./IconPicker.jsx";
import offlineIcons from "../data/icons.json";

const CATEGORIES = [
  "Hosting & Cloud",
  "Network & Security",
  "Monitoring",
  "Virtualization & Storage",
  "Remote Access",
  "Database",
  "Operating Systems",
  "General",
];

export default function EntryModal({
  entry,
  onClose,
  onSave,
  apiFetch,
  users,
}) {
  const isEditing = Boolean(entry?.id);

  const [name, setName] = useState(entry?.name || "");
  const [address, setAddress] = useState(entry?.address || "");
  const [category, setCategory] = useState(
    entry?.category && !CATEGORIES.includes(entry.category)
      ? "__custom__"
      : entry?.category || "Hosting & Cloud",
  );
  const [customCategory, setCustomCategory] = useState(entry?.category || "");
  const [icon, setIcon] = useState(entry?.icon || "server");
  const [description, setDescription] = useState(entry?.description || "");
  const [method, setMethod] = useState(entry?.method || "web");
  const [access, setAccess] = useState(entry?.access || []);

  // Credentials Vault
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clearCredentials, setClearCredentials] = useState(false);

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Quick helper: if method changes, suggest common address formats
  const handleMethodChange = (newMethod) => {
    setMethod(newMethod);
    if (!address) {
      if (newMethod === "ssh") setAddress("root@192.168.1.50:22");
      else if (newMethod === "rdp") setAddress("192.168.1.100:3389");
      else if (newMethod === "web") setAddress("https://");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const finalCategory =
      category === "__custom__" ? customCategory.trim() : category;
    if (!finalCategory) {
      setError("Please provide a category.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        category: finalCategory,
        icon,
        description: description.trim(),
        method,
        access,
        clearCredentials,
      };

      if (username || password) {
        payload.credentials = { username, password };
      }

      await onSave(payload, entry?.id);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  };

  // Find icon SVG
  const selectedIconData = offlineIcons.find((i) => i.id === icon);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 24, maxWidth: 640 }}
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
              <Globe size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                {isEditing ? "Edit resource" : "Add resource"}
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Configure shortcut, open method & vault credentials
              </p>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-icon"
            aria-label="Close resource form"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #ef4444",
              color: "#f87171",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 16,
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {/* Method Selector */}
          <div>
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: 8,
                display: "block",
              }}
            >
              Launch & Open Method
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))",
                gap: 8,
              }}
            >
              {[
                { id: "web", label: "Web URL", icon: Globe },
                { id: "ssh", label: "SSH CLI", icon: Terminal },
                { id: "rdp", label: "RDP Remote", icon: Monitor },
                { id: "anydesk", label: "AnyDesk", icon: Radio },
                { id: "rustdesk", label: "RustDesk", icon: Shield },
              ].map((m) => {
                const IconComp = m.icon;
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleMethodChange(m.id)}
                    className="badge"
                    style={{
                      background: active
                        ? "var(--accent)"
                        : "rgba(255, 255, 255, 0.04)",
                      color: active ? "#000" : "var(--text-main)",
                      border: `1px solid ${active ? "var(--accent)" : "var(--border-glass)"}`,
                      padding: "8px 10px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <IconComp size={16} />
                    <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name & Address */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                Entry Name *
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. cPanel Master, pfSense Core"
                aria-label="Resource name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                {method === "web"
                  ? "HTTP(S) URL *"
                  : method === "ssh"
                    ? "SSH Host/Address *"
                    : method === "rdp"
                      ? "RDP Host[:port] *"
                      : "Device ID / Code *"}
              </label>
              <input
                type="text"
                className="glass-input font-mono"
                aria-label="Resource address"
                placeholder={
                  method === "web"
                    ? "https://cpanel.example.com:2083"
                    : method === "ssh"
                      ? "root@10.0.0.5:22"
                      : method === "rdp"
                        ? "192.168.1.10:3389"
                        : "987 654 321"
                }
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Category & Icon Picker */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: 12,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                Category / Group
              </label>
              <select
                className="glass-input"
                value={category}
                aria-label="Category"
                onChange={(e) => setCategory(e.target.value)}
                style={{ cursor: "pointer" }}
              >
                {CATEGORIES.map((c) => (
                  <option
                    key={c}
                    value={c}
                    style={{ background: "#0f172a", color: "#fff" }}
                  >
                    {c}
                  </option>
                ))}
                <option
                  value="__custom__"
                  style={{ background: "#0f172a", color: "#fff" }}
                >
                  + Create New Category...
                </option>
              </select>
              {category === "__custom__" && (
                <input
                  type="text"
                  className="glass-input"
                  style={{ marginTop: 8 }}
                  placeholder="Enter custom category name"
                  aria-label="Custom category name"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                Icon
              </label>
              <button
                type="button"
                onClick={() => setShowIconPicker(true)}
                className="glass-input"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {icon.startsWith("data:") ? (
                    <img
                      src={icon}
                      alt="custom"
                      style={{ width: 20, height: 20, objectFit: "contain" }}
                    />
                  ) : selectedIconData ? (
                    <img
                      src={`/icons/${selectedIconData.id}.svg`}
                      alt=""
                      width="20"
                      height="20"
                    />
                  ) : (
                    <Globe size={18} />
                  )}
                  <span style={{ fontSize: "0.85rem" }}>
                    {icon.startsWith("data:") ? "Custom Icon" : icon}
                  </span>
                </div>
                <Sparkles size={16} color="var(--accent)" />
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: 6,
                display: "block",
              }}
            >
              Description / Notes (Optional)
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder="e.g. Primary cluster node, SSL expires Dec 2026"
              aria-label="Resource description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Encrypted Vault Credentials */}
          <div
            className="glass-panel"
            style={{ padding: 14, border: "1px solid rgba(0, 242, 254, 0.2)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Lock size={16} color="var(--accent)" />
              <h4
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: "var(--accent)",
                }}
              >
                Encrypted Credentials Vault (AES-256-GCM)
              </h4>
            </div>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginBottom: 12,
              }}
            >
              Credentials are private to your account. Leave both fields empty
              to keep existing credentials. Filling either field replaces the
              saved pair.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="Username / Login ID"
                  aria-label="Saved username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <input
                  type="password"
                  className="glass-input"
                  placeholder={
                    entry?.hasCredentials
                      ? "New credential password"
                      : "Password"
                  }
                  aria-label="Saved password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {isEditing && entry?.hasCredentials && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 10,
                  fontSize: "0.8rem",
                  color: "#f87171",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={clearCredentials}
                  onChange={(e) => setClearCredentials(e.target.checked)}
                />
                Remove stored credentials from vault
              </label>
            )}
          </div>

          {/* Form Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 10,
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Entry"}
            </button>
          </div>
        </form>

        {showIconPicker && (
          <IconPicker
            selected={icon}
            onSelect={(newIcon) => setIcon(newIcon)}
            onClose={() => setShowIconPicker(false)}
            apiFetch={apiFetch}
          />
        )}
      </div>
    </div>
  );
}
