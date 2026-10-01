import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
export default function SshTerminalModal({ entry, onClose, apiFetch }) {
  const [password, setPassword] = useState(""),
    [ticket, setTicket] = useState(null),
    [error, setError] = useState("");
  const surface = useRef();
  useEffect(() => {
    if (!ticket) return;
    const term = new Terminal({
        cursorBlink: true,
        theme: { background: "#101315", foreground: "#e8efe3" },
        fontSize: 13,
      }),
      fit = new FitAddon();
    term.loadAddon(fit);
    term.open(surface.current);
    fit.fit();
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/ssh?token=${ticket}`,
    );
    ws.onmessage = (e) => {
      const p = JSON.parse(e.data);
      term.write(p.data || p.message || "");
    };
    ws.onclose = () => term.write("\r\n[Disconnected]\r\n");
    ws.onerror = () =>
      setError(
        "Connection failed. Check destination policy and host fingerprint.",
      );
    term.onData((data) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: "data", data }));
    });
    const resize = () => {
      fit.fit();
      if (ws.readyState === 1)
        ws.send(
          JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }),
        );
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      ws.close();
      term.dispose();
    };
  }, [ticket]);
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="dialog-heading">
          <h3>{entry.name} · SSH terminal</h3>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        {!ticket ? (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const r = await apiFetch(
                    `/api/entries/${entry.id}/ssh-connect`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ password }),
                    },
                  ),
                  d = await r.json();
                if (!r.ok) throw Error(d.error);
                setPassword("");
                setTicket(d.token);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <p>
              Re-enter your account password to use the saved SSH credentials.
              The server must have an allowlisted destination and verified
              host-key fingerprint.
            </p>
            <label className="field">
              Account password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="btn btn-primary">Connect securely</button>
          </form>
        ) : (
          <div
            ref={surface}
            style={{ height: "65vh", minHeight: 350, background: "#101315" }}
          />
        )}
      </div>
    </div>
  );
}
