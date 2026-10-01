import React, { useState, useMemo } from "react";
import offlineIcons from "../data/icons.json";
import { Search, Upload, Globe, Check, X, Sparkles } from "lucide-react";

export default function IconPicker({ selected, onSelect, onClose, apiFetch }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [fetchingFavicon, setFetchingFavicon] = useState(false);
  const [customError, setCustomError] = useState("");

  const categories = useMemo(() => {
    const set = new Set(offlineIcons.map((i) => i.category));
    return ["All", ...Array.from(set).sort()];
  }, []);

  const filteredIcons = useMemo(() => {
    let list = offlineIcons;
    if (activeCategory !== "All") {
      list = list.filter((i) => i.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [activeCategory, query]);

  // Handle File Upload (PNG or SVG)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomError("");

    if (file.size > 200 * 1024) {
      setCustomError("Icon file must be under 200KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onSelect(result);
        onClose();
      }
    };
    reader.onerror = () => setCustomError("Failed to read file.");
    reader.readAsDataURL(file);
  };

  // Fetch site favicon via backend proxy
  const handleFetchFavicon = async () => {
    if (!faviconUrl.trim()) return;
    setFetchingFavicon(true);
    setCustomError("");
    try {
      let target = faviconUrl.trim();
      if (!target.startsWith("http://") && !target.startsWith("https://")) {
        target = `https://${target}`;
      }
      const res = await apiFetch("/api/icons/favicon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      if (data.icon) {
        onSelect(data.icon);
        onClose();
      } else {
        setCustomError("Could not find a valid favicon for this URL.");
      }
    } catch (err) {
      setCustomError("Failed to fetch favicon.");
    } finally {
      setFetchingFavicon(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 780, padding: 24 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
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
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                Icon Library
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Choose from {offlineIcons.length} offline icons or upload your
                own
              </p>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-icon"
            aria-label="Close icon picker"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                left: 14,
                top: 12,
                color: "var(--text-dim)",
              }}
            />
            <input
              type="text"
              className="glass-input"
              style={{ paddingLeft: 42 }}
              placeholder="Search icons (cPanel, Proxmox, pfSense, SSH, Docker...)"
              aria-label="Search icons"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Categories Bar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 10,
            marginBottom: 14,
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="badge"
              style={{
                background:
                  activeCategory === cat
                    ? "var(--accent)"
                    : "rgba(255, 255, 255, 0.05)",
                color: activeCategory === cat ? "#000" : "var(--text-muted)",
                cursor: "pointer",
                border: "1px solid var(--border-glass)",
                padding: "6px 14px",
                whiteSpace: "nowrap",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Custom Upload & Favicon Grabber */}
        <div
          style={{
            background: "rgba(0,0,0,0.2)",
            borderRadius: "var(--radius-sm)",
            padding: 12,
            marginBottom: 16,
            border: "1px dashed var(--border-glass)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <label
              className="btn btn-secondary"
              style={{ cursor: "pointer", fontSize: "0.85rem" }}
            >
              <Upload size={16} /> Upload Custom SVG / PNG
              <input
                type="file"
                accept=".svg,.png"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>

            <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 260 }}>
              <input
                type="text"
                className="glass-input"
                style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                placeholder="Extract favicon from URL (e.g. google.com)"
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFetchFavicon()}
              />
              <button
                className="btn btn-secondary"
                onClick={handleFetchFavicon}
                disabled={fetchingFavicon}
                style={{ fontSize: "0.85rem" }}
              >
                <Globe size={15} /> {fetchingFavicon ? "Fetching..." : "Grab"}
              </button>
            </div>
          </div>
          {customError && (
            <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: 8 }}>
              {customError}
            </p>
          )}
        </div>

        {/* Icon Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
            gap: 12,
            maxHeight: 360,
            overflowY: "auto",
            padding: 4,
          }}
        >
          {filteredIcons.map((icon) => {
            const isSelected = selected === icon.id;
            return (
              <button
                key={icon.id}
                onClick={() => {
                  onSelect(icon.id);
                  onClose();
                }}
                className="glass-panel-hover"
                style={{
                  background: isSelected
                    ? "var(--accent-glow)"
                    : "rgba(255, 255, 255, 0.03)",
                  borderColor: isSelected
                    ? "var(--accent)"
                    : "var(--border-glass)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 6px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  border: "1px solid",
                  color: "inherit",
                }}
                title={icon.title}
              >
                <img
                  src={`/icons/${icon.id}.svg`}
                  alt=""
                  style={{
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: isSelected ? "var(--accent)" : "var(--text-muted)",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    width: "100%",
                  }}
                >
                  {icon.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
