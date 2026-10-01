import React, { useState, useEffect } from "react";
import { Shield, X, RefreshCw, Clock, User, Globe } from "lucide-react";

export default function AuditLogModal({ onClose, apiFetch, addToast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/audit?limit=100");
      const data = await res.json();
      if (res.ok) setLogs(data.logs || []);
    } catch {
      addToast("Failed to load audit logs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 24, maxWidth: 840 }}
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
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                My Activity
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Your logins, changes, and credential access only. Host
                administrators can modify the underlying database.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="btn btn-secondary btn-icon"
              onClick={loadAuditLogs}
              title="Refresh logs"
            >
              <RefreshCw size={16} />
            </button>
            <button className="btn btn-secondary btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ maxHeight: 460, overflowY: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.8rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border-glass)",
                  color: "var(--text-muted)",
                }}
              >
                <th style={{ padding: "8px" }}>Timestamp</th>
                <th style={{ padding: "8px" }}>Actor</th>
                <th style={{ padding: "8px" }}>Action</th>
                <th style={{ padding: "8px" }}>Target</th>
                <th style={{ padding: "8px" }}>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isFailed =
                  log.action.includes("FAIL") || log.action.includes("DENIED");
                const isVault =
                  log.action.includes("CREDENTIAL") ||
                  log.action.includes("VAULT");
                return (
                  <tr
                    key={log.id}
                    style={{ borderBottom: "1px solid var(--border-glass)" }}
                  >
                    <td
                      style={{ padding: "10px 8px", color: "var(--text-dim)" }}
                      className="font-mono"
                    >
                      {new Date(log.at).toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 8px", fontWeight: 600 }}>
                      {log.actor}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <span
                        className="badge"
                        style={{
                          background: isFailed
                            ? "rgba(239, 68, 68, 0.15)"
                            : isVault
                              ? "rgba(0, 242, 254, 0.15)"
                              : "rgba(255, 255, 255, 0.05)",
                          color: isFailed
                            ? "#f87171"
                            : isVault
                              ? "var(--accent)"
                              : "var(--text-main)",
                          fontSize: "0.7rem",
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {log.target}
                    </td>
                    <td
                      style={{ padding: "10px 8px", color: "var(--text-dim)" }}
                      className="font-mono"
                    >
                      {log.ip}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
