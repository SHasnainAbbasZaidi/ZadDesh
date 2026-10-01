import React, { useEffect, useRef, useState } from "react";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  Cloud,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  Folder,
  Grid2X2,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Star,
  Sun,
  Terminal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import EntryModal from "./components/EntryModal.jsx";
import UserManagementModal from "./components/UserManagementModal.jsx";
import AuditLogModal from "./components/AuditLogModal.jsx";
import ResourceCard from "./components/ResourceCard.jsx";
import VaultTransfer from "./components/VaultTransfer.jsx";
import DirectLogin from "./components/DirectLogin.jsx";
import {
  launchProtocol as protocol,
  desktopProtocol,
  sshCommand,
} from "../shared/launch.js";
const SshTerminalModal = React.lazy(
  () => import("./components/SshTerminalModal.jsx"),
);

const Brand = () => (
  <span className="brand" aria-label="ZadDesh">
    <img className="brand-mark" src="/brand/mark.svg" alt="" />
    <span className="brand-wordmark">
      Zad_<span className="cursor-blink">_</span>
    </span>
  </span>
);
const Credit = () => (
  <div className="credit">
    <img
      className="company-logo"
      src="/brand/mahzaidex-tech.png"
      alt="Mahzaidex Tech"
      width="160"
      height="38"
    />
    <span>Developed by Hasnain Zaidi</span>
  </div>
);
const Field = ({ label, ...props }) => (
  <label className="field">
    {label}
    <input {...props} />
  </label>
);
function Dialog({ title, onClose, children, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`zd-dialog ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        {onClose && (
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
}
export default function Dashboard() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [entries, setEntries] = useState([]),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All resources"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [mobile, setMobile] = useState(false),
    [collapsed, setCollapsed] = useState({}),
    [theme, setTheme] = useState("dark"),
    [accent, setAccent] = useState("emerald");
  const csrf = useRef(""),
    search = useRef(),
    toastTimer = useRef();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false),
    [cardView, setCardView] = useState("compact"),
    [cardLayout, setCardLayout] = useState("grid"),
    [cardExpanded, setCardExpanded] = useState({}),
    [pingMap, setPingMap] = useState({}),
    [pinging, setPinging] = useState(false);
  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 7000);
  };
  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf.current,
        ...options.headers,
      },
    });
    if (res.status === 401 && !url.includes("/login")) {
      setUser(null);
      setEntries([]);
      setModal(null);
    }
    return res;
  }
  async function json(url, body, method = "POST") {
    const res = await api(url, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      data = await res.json();
    if (!res.ok) throw Error(data.error || "Request failed.");
    if (data.csrf) csrf.current = data.csrf;
    return data;
  }
  async function load() {
    try {
      const r = await api("/api/entries");
      if (!r.ok) throw Error("Unable to load your dashboard.");
      setEntries((await r.json()).entries);
    } catch (e) {
      notify(e.message);
    }
  }
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (r.ok) {
          const d = await r.json();
          csrf.current = d.csrf;
          setUser(d.user);
        }
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (user && !user.mustChange) {
      load();
      setPingMap({});
      setCardExpanded({});
      api("/api/settings")
        .then((r) => r.json())
        .then((s) => {
          setTheme(s.theme || "dark");
          setAccent(s.accent || "emerald");
          setSidebarCollapsed(!!s.sidebarCollapsed);
          setCardView(s.cardView || "compact");
          setCardLayout(s.cardLayout || "grid");
        });
    }
  }, [user?.id, user?.mustChange]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
  }, [theme, accent]);
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  // Accessible behavior for the retained form components, including nested icon dialogs.
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const t = setTimeout(() => {
      const els = document.querySelectorAll(".modal-content");
      const el = els[els.length - 1];
      if (el) {
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-modal", "true");
        el.setAttribute(
          "aria-label",
          el.querySelector("h3")?.textContent || "Settings",
        );
        el.querySelector("input,button,select")?.focus();
      }
    }, 30);
    const handler = (e) => {
      const els = document.querySelectorAll(".modal-content"),
        el = els[els.length - 1];
      if (!el) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (els.length === 1) setModal(null);
        else el.querySelector("button")?.click();
      }
      if (e.key === "Tab") {
        const items = [
          ...el.querySelectorAll("input,button,select,textarea,a[href]"),
        ].filter((n) => !n.disabled && n.offsetParent !== null);
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [modal]);
  async function preference(nextTheme, nextAccent) {
    setTheme(nextTheme);
    setAccent(nextAccent);
    try {
      await json(
        "/api/settings",
        { theme: nextTheme, accent: nextAccent },
        "PUT",
      );
    } catch (e) {
      notify(e.message);
    }
  }
  async function viewPreference(value) {
    if (value.cardLayout) setCardLayout(value.cardLayout);
    if (value.sidebarCollapsed !== undefined)
      setSidebarCollapsed(value.sidebarCollapsed);
    if (value.cardView) {
      setCardView(value.cardView);
      setCardExpanded({});
    }
    try {
      await json("/api/settings", value, "PUT");
    } catch (e) {
      notify(e.message);
    }
  }
  async function pingEntry(entry) {
    setPingMap((p) => ({
      ...p,
      [entry.id]: { ...p[entry.id], checking: true },
    }));
    try {
      const result = await json("/api/ping", { id: entry.id });
      setPingMap((p) => ({ ...p, [entry.id]: { ...result, checking: false } }));
    } catch (e) {
      setPingMap((p) => ({
        ...p,
        [entry.id]: { online: null, checking: false, error: e.message },
      }));
      notify(e.message);
    }
  }
  async function pingAll() {
    setPinging(true);
    try {
      for (let i = 0; i < filtered.length; i += 4)
        await Promise.all(filtered.slice(i, i + 4).map(pingEntry));
      notify("Reachability checks complete. Expand a resource to see details.");
    } finally {
      setPinging(false);
    }
  }
  async function logout() {
    try {
      await json("/api/auth/logout", {});
      setUser(null);
      setEntries([]);
      setModal(null);
      csrf.current = "";
    } catch (e) {
      notify(e.message);
    }
  }
  async function launch(entry) {
    if (entry.method === "web") {
      if (entry.hasCredentials) {
        setModal({ type: "direct-login", entry });
        return;
      }
      window.open(entry.address, "_blank", "noopener,noreferrer");
      return;
    }
    setModal({ type: "launch", entry });
    {
      window.location.href = desktopProtocol(entry);
      notify("Launch requested. If nothing opens, use the setup instructions.");
    }
  }
  async function move(id, direction) {
    const order = entries.map((e) => e.id),
      i = order.indexOf(id),
      j = i + direction;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    try {
      await json("/api/entries/reorder", { order });
      load();
    } catch (e) {
      notify(e.message);
    }
  }
  async function save(payload, id) {
    await json(
      id ? `/api/entries/${id}` : "/api/entries",
      payload,
      id ? "PUT" : "POST",
    );
    load();
    notify("Resource saved to your private dashboard.");
  }
  const categories = [...new Set(entries.map((e) => e.category))].sort(),
    favoriteCount = entries.filter((e) => e.isFavorite).length;
  const filtered = entries.filter(
    (e) =>
      (category === "All resources" ||
        (category === "Favorites" && e.isFavorite) ||
        category === e.category) &&
      `${e.name} ${e.address} ${e.description} ${e.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const groups = [...new Set(filtered.map((e) => e.category))];
  if (loading)
    return (
      <div className="loading">
        <Brand />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!user)
    return (
      <Login
        onLogin={(d) => {
          csrf.current = d.csrf;
          setUser(d.user);
          setCategory("All resources");
          setQuery("");
        }}
        json={json}
      />
    );
  if (user.mustChange)
    return (
      <div className="login-page">
        <div className="first-login">
          <Brand />
          <h1>Make this space yours.</h1>
          <p>
            Replace your temporary password to unlock your private dashboard.
          </p>
          <PasswordForm json={json} onDone={(u) => setUser(u)} />
          <Credit />
        </div>
      </div>
    );
  return (
    <div className={`workspace ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-name">
          <span className="workspace-avatar">
            {user.username[0].toUpperCase()}
          </span>
          <div>
            <strong>My workspace</strong>
            <small>Private infrastructure</small>
          </div>
          <LockKeyhole size={14} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {[
            [Grid2X2, "All resources", entries.length],
            [Star, "Favorites", favoriteCount],
          ].map(([I, label, count]) => (
            <button
              key={label}
              className={category === label ? "nav-item active" : "nav-item"}
              onClick={() => {
                setCategory(label);
                setMobile(false);
              }}
            >
              <I size={18} />
              {label}
              <span>{count}</span>
            </button>
          ))}
          <span className="nav-label">COLLECTIONS</span>
          {categories.length ? (
            categories.map((c) => (
              <button
                key={c}
                className={category === c ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setCategory(c);
                  setMobile(false);
                }}
              >
                <Folder size={17} />
                {c}
                <span>{entries.filter((e) => e.category === c).length}</span>
              </button>
            ))
          ) : (
            <p className="nav-empty">
              Your categories appear here as you add resources.
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => setModal({ type: "security" })}
          >
            <ShieldCheck size={18} />
            Security & account
          </button>
          <button
            className="nav-item"
            onClick={() => setModal({ type: "transfer" })}
          >
            <Database size={18} />
            Import & export
          </button>
          {user.role === "Admin" && (
            <>
              <button
                className="nav-item"
                onClick={() => setModal({ type: "users" })}
              >
                <Users size={18} />
                Manage users
              </button>
            </>
          )}
          <button
            className="nav-item"
            onClick={() => setModal({ type: "audit" })}
          >
            <Activity size={18} />
            My activity
          </button>
          <div className="vault-note">
            <ShieldCheck size={17} />
            <div>
              <strong>Your space. Your access.</strong>
              <small>Credentials encrypted at rest</small>
            </div>
          </div>
          <Credit />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button desktop-sidebar-toggle"
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            aria-expanded={!sidebarCollapsed}
            onClick={() =>
              viewPreference({ sidebarCollapsed: !sidebarCollapsed })
            }
          >
            <Menu size={19} />
          </button>
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{category}</strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              onClick={() =>
                preference(theme === "dark" ? "light" : "dark", accent)
              }
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="top-divider" />
            <button
              className="profile"
              onClick={() => setModal({ type: "security" })}
            >
              <span>{user.username[0].toUpperCase()}</span>
              <strong>{user.username}</strong>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <main className="dashboard">
          <div className="overview">
            <div>
              <span className="stat-icon">
                <Server size={19} />
              </span>
              <span>
                <strong>{entries.length.toString().padStart(2, "0")}</strong>
                <small>Total resources</small>
              </span>
            </div>
            <div>
              <span className="stat-icon">
                <Folder size={19} />
              </span>
              <span>
                <strong>{categories.length.toString().padStart(2, "0")}</strong>
                <small>Collections</small>
              </span>
            </div>
            <div>
              <span className="stat-icon">
                <Star size={19} />
              </span>
              <span>
                <strong>{favoriteCount.toString().padStart(2, "0")}</strong>
                <small>Pinned favorites</small>
              </span>
            </div>
            <div>
              <span className="stat-icon">
                <LockKeyhole size={19} />
              </span>
              <span>
                <strong>
                  {entries
                    .filter((e) => e.hasCredentials)
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
                <small>Saved credentials</small>
              </span>
            </div>
          </div>
          <div className="filterbar">
            <div className="resource-search">
              <Search size={18} />
              <input
                ref={search}
                aria-label="Search resources"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your infrastructure…"
              />
              <kbd>Ctrl K</kbd>
            </div>
            <select
              aria-label="Filter category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["All resources", "Favorites", ...categories].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {user.role !== "Viewer" && (
              <button
                className="btn btn-primary add-resource"
                onClick={() => setModal({ type: "entry" })}
              >
                <Plus size={18} />
                Add resource
              </button>
            )}
            <span className="results-count">{filtered.length} resources</span>
          </div>
          <div className="view-toolbar">
            <span>Display & connectivity</span>
            <select
              aria-label="Card layout"
              value={cardLayout}
              onChange={(e) => viewPreference({ cardLayout: e.target.value })}
            >
              <option value="grid">Compact grid</option>
              <option value="comfortable">Comfortable grid</option>
              <option value="list">List</option>
            </select>
            <button
              className="btn btn-secondary"
              aria-pressed={cardView === "expanded"}
              onClick={() =>
                viewPreference({
                  cardView: cardView === "compact" ? "expanded" : "compact",
                })
              }
            >
              <ChevronDown size={15} />
              {cardView === "compact"
                ? "Expand all cards"
                : "Collapse all cards"}
            </button>
            <button
              className="btn btn-secondary"
              disabled={pinging || !filtered.length}
              onClick={pingAll}
            >
              <Activity size={15} />
              {pinging ? "Checking…" : "Ping visible resources"}
            </button>
          </div>
          {!filtered.length ? (
            <div className="empty-state">
              <div className="empty-orbit">
                <Server size={32} />
                <span className="orbit-lock">
                  <LockKeyhole size={16} />
                </span>
              </div>
              <span className="eyebrow">A SPACE THAT’S ONLY YOURS</span>
              <h2>
                {entries.length
                  ? "No matching resources"
                  : "Your infrastructure starts here."}
              </h2>
              <p>
                {entries.length
                  ? "Try a different search or collection."
                  : "Add your first server, hosting panel, or everyday tool. Your dashboard and credentials stay private to your account."}
              </p>
              {user.role !== "Viewer" && (
                <button
                  className="btn btn-primary"
                  onClick={() => setModal({ type: "entry" })}
                >
                  <Plus size={18} />
                  Add your first resource
                </button>
              )}
              <div className="empty-examples">
                <span>
                  <Cloud size={15} />
                  Hosting
                </span>
                <span>
                  <ShieldCheck size={15} />
                  Firewalls
                </span>
                <span>
                  <Terminal size={15} />
                  Remote access
                </span>
              </div>
            </div>
          ) : (
            <div className={`resource-grid layout-${cardLayout}`}>
              {filtered.map((entry) => (
                <ResourceCard
                  key={entry.id}
                  entry={entry}
                  expanded={cardExpanded[entry.id] ?? cardView === "expanded"}
                  onExpand={(id) =>
                    setCardExpanded((p) => ({
                      ...p,
                      [id]: !(p[id] ?? cardView === "expanded"),
                    }))
                  }
                  onLaunch={launch}
                  onEdit={(entry) => setModal({ type: "entry", entry })}
                  onDelete={(entry) => setModal({ type: "delete", entry })}
                  onVault={(entry) => setModal({ type: "vault", entry })}
                  onMove={move}
                  onPing={pingEntry}
                  ping={pingMap[entry.id]}
                  canEdit={user.role !== "Viewer"}
                  onFavorite={async (e) => {
                    try {
                      await json(`/api/favorites/${e.id}`, {});
                      load();
                    } catch (e) {
                      notify(e.message);
                    }
                  }}
                />
              ))}
            </div>
          )}
          <footer className="dashboard-footer">
            <span>
              <span className="tiny-dot" /> Private workspace · {user.role}
            </span>
            <span>
              ZadDesh <span className="footer-slash">/</span> Built to keep you
              connected.
            </span>
          </footer>
        </main>
      </div>
      {modal?.type === "entry" && (
        <EntryModal
          entry={modal.entry}
          onClose={() => setModal(null)}
          onSave={save}
          apiFetch={api}
        />
      )}
      {modal?.type === "users" && (
        <UserManagementModal
          onClose={() => setModal(null)}
          apiFetch={api}
          currentUser={user}
          addToast={notify}
        />
      )}
      {modal?.type === "audit" && (
        <AuditLogModal
          onClose={() => setModal(null)}
          apiFetch={api}
          addToast={notify}
        />
      )}
      {modal?.type === "ssh" && (
        <React.Suspense
          fallback={<div className="toast">Loading terminal…</div>}
        >
          <SshTerminalModal
            entry={modal.entry}
            apiFetch={api}
            onClose={() => setModal(null)}
          />
        </React.Suspense>
      )}
      {modal?.type === "delete" && (
        <Dialog title="Delete resource?" onClose={() => setModal(null)}>
          <p>
            This removes {modal.entry.name} and its saved credentials from your
            dashboard.
          </p>
          <div className="form-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setModal(null)}
            >
              Keep resource
            </button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                try {
                  await json(
                    `/api/entries/${modal.entry.id}`,
                    undefined,
                    "DELETE",
                  );
                  load();
                  setModal(null);
                } catch (e) {
                  notify(e.message);
                }
              }}
            >
              Delete resource
            </button>
          </div>
        </Dialog>
      )}
      {modal?.type === "vault" && (
        <Vault
          canEdit={user.role !== "Viewer"}
          onEdit={() => setModal({ type: "entry", entry: modal.entry })}
          entry={modal.entry}
          json={json}
          notify={notify}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "security" && (
        <Dialog title="Security & account" onClose={() => setModal(null)}>
          <Security
            user={user}
            json={json}
            api={api}
            setUser={setUser}
            notify={notify}
          />
          <hr />
          <label className="field">
            Accent color
            <select
              value={accent}
              onChange={(e) => preference(theme, e.target.value)}
            >
              {["emerald", "cyan", "cyberpunk", "amber", "sapphire"].map(
                (a) => (
                  <option key={a}>{a}</option>
                ),
              )}
            </select>
          </label>
          <button className="btn btn-secondary" onClick={logout}>
            <LogOut size={16} />
            Sign out
          </button>
        </Dialog>
      )}
      {modal?.type === "transfer" && (
        <Transfer
          json={json}
          api={api}
          load={load}
          role={user.role}
          notify={notify}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "launch" && (
        <LaunchDialog
          entry={modal.entry}
          user={user}
          onClose={() => setModal(null)}
          onBrowserSsh={() => setModal({ type: "ssh", entry: modal.entry })}
          notify={notify}
        />
      )}
      {modal?.type === "direct-login" && (
        <Dialog
          title={`Direct login · ${modal.entry.name}`}
          onClose={() => setModal(null)}
        >
          <DirectLogin entry={modal.entry} json={json} />
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <ShieldCheck size={18} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

const clientUrl = (method) =>
  ({
    rdp: "https://learn.microsoft.com/windows-server/remote/remote-desktop-services/clients/remote-desktop-clients",
    ssh: "https://www.openssh.com/",
    telnet:
      "https://learn.microsoft.com/windows-server/administration/windows-commands/telnet",
    anydesk: "https://anydesk.com/downloads",
    rustdesk: "https://rustdesk.com/",
  })[method];
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function LaunchDialog({ entry, user, onClose, onBrowserSsh, notify }) {
  const [platform, setPlatform] = useState("windows");
  const rdp = entry.method === "rdp",
    ssh = entry.method === "ssh",
    telnet = entry.method === "telnet";
  return (
    <Dialog title={`Connect to ${entry.name}`} onClose={onClose}>
      <div className="info-box">
        {rdp
          ? "Remote Desktop launch requested. Allow your browser to open ZadDesh Launcher. Nothing is downloaded unless you choose Download."
          : ssh
            ? "Terminal launch requested. Allow your browser to open ZadDesh Launcher, or choose the browser terminal or manual options below."
            : "Your browser was asked to open the installed remote client."}
      </div>
      <a className="btn btn-primary" href={desktopProtocol(entry)}>
        Open {rdp ? "Remote Desktop" : ssh ? "terminal" : entry.method}
      </a>
      {(rdp || ssh || telnet) && (
        <p className="muted">
          Windows requires the ZadDesh desktop launcher on this computer. Run
          desktop/install.ps1 from the project folder once. If the in-app
          browser blocks external apps, open ZadDesh in Edge or Chrome.
        </p>
      )}
      {rdp && (
        <>
          <a
            className="btn btn-primary launch-primary"
            href={`/api/entries/${entry.id}/rdp`}
            download
          >
            <Download size={17} />
            Download Remote Desktop profile
          </a>
          <p>
            <strong>Windows:</strong> open the .rdp file with Remote Desktop
            Connection (mstsc). <strong>macOS:</strong> import it into Windows
            App. <strong>Linux:</strong> import it into Remmina or use FreeRDP.
          </p>
        </>
      )}
      {telnet && (
        <div className="stack launch-options">
          <p>
            Telnet sends traffic and credentials without encryption. Use it only
            on a trusted management network; prefer SSH when supported.
          </p>
          <p>
            On Windows, enable Telnet Client in Windows Features and rerun
            desktop/install.ps1 to update the launcher. On other systems,
            install a Telnet client and use the protocol option below or enter
            the switch host and port in your client.
          </p>
          <p>
            Sign in at the switch prompt. Saved passwords are never passed in
            launch URLs or command arguments.
          </p>
        </div>
      )}
      {ssh && (
        <div className="stack launch-options">
          <label className="field">
            Your computer
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option value="windows">Windows · OpenSSH</option>
              <option value="mac">macOS · Terminal</option>
              <option value="linux">Linux · Terminal</option>
            </select>
          </label>
          <a
            className="btn btn-primary"
            href={`/api/entries/${entry.id}/ssh-launch?platform=${platform}`}
            download
          >
            <Download size={17} />
            Download{" "}
            {platform === "windows"
              ? ".cmd"
              : platform === "mac"
                ? ".command"
                : ".sh"}{" "}
            launcher
          </a>
          <p className="muted">
            {platform === "windows"
              ? "Open the downloaded .cmd file to launch Windows OpenSSH. If ssh is missing, enable OpenSSH Client in Windows Optional Features."
              : "Open a terminal in the download folder, run chmod +x on the downloaded file, then run it. On macOS you can then double-click the .command file."}
          </p>
          <label className="field">
            Or run this command
            <div className="credential-row">
              <input readOnly value={sshCommand(entry.address)} />
              <button
                className="icon-button"
                aria-label="Copy SSH command"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      sshCommand(entry.address),
                    );
                    notify("SSH command copied. Paste it into your terminal.");
                  } catch {
                    notify(
                      "Clipboard access blocked. Select and copy the command manually.",
                    );
                  }
                }}
              >
                <Copy size={18} />
              </button>
            </div>
          </label>
          {user.browserSsh && (
            <button className="btn btn-secondary" onClick={onBrowserSsh}>
              <Terminal size={17} />
              Open secure browser terminal
            </button>
          )}
        </div>
      )}
      <details className="settings-section">
        <summary>Protocol handler & client setup</summary>
        <p>
          A protocol link works only when your installed client has registered a
          handler. Browsers cannot reliably detect this.
        </p>
        <div className="form-actions">
          <a className="btn btn-secondary" href={protocol(entry)}>
            Try {entry.method} handler
          </a>
          <a
            className="btn btn-secondary"
            href={clientUrl(entry.method)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Client setup
            <ArrowUpRight size={15} />
          </a>
        </div>
      </details>
      <p className="muted">
        Launch files and URLs never contain passwords. Use your vault’s copy
        button when the client requests credentials.
      </p>
    </Dialog>
  );
}
function Login({ onLogin, json }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [mfa, setMfa] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await json("/api/auth/login", {
        username,
        password,
        totpCode: code || undefined,
      });
      if (d.require2fa) setMfa(true);
      else onLogin(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function passkey() {
    setBusy(true);
    setError("");
    try {
      const options = await json("/api/auth/passkey/login-options", {}),
        response = await startAuthentication({ optionsJSON: options });
      onLogin(await json("/api/auth/passkey/login-verify", { response }));
    } catch (e) {
      setError(
        e.name === "NotAllowedError" ? "Passkey request cancelled." : e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Brand />
        <div className="story-content">
          <div className="eyebrow">ONE WORKSPACE. YOUR ENTIRE WORLD.</div>
          <h1>
            Less searching.
            <br />
            More <em>connected.</em>
          </h1>
          <p>
            Your infrastructure deserves a home.
            <br />
            Bring every tool, server, and service together.
          </p>
          <div className="connection-art" aria-hidden="true">
            <span className="art-line" />
            <div className="art-node">
              <Server />
            </div>
            <div className="art-center">
              <Brand />
            </div>
            <div className="art-node">
              <Cloud />
            </div>
            <div className="art-node lower">
              <Terminal />
            </div>
            <div className="art-node lower">
              <ShieldCheck />
            </div>
          </div>
          <div className="story-badges">
            <span>
              <LockKeyhole size={15} />
              Private by design
            </span>
            <span>
              <Server size={15} />
              Self-hosted
            </span>
          </div>
        </div>
        <Credit />
      </div>
      <div className="login-form-side">
        <div className="login-box">
          <div className="login-symbol">
            <Terminal size={26} />
          </div>
          <span className="eyebrow">WELCOME TO ZADDESH</span>
          <h2>Your workspace awaits.</h2>
          <p>Sign in to your private infrastructure dashboard.</p>
          <form onSubmit={submit}>
            <Field
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
              placeholder="Enter your username"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="Enter your password"
            />
            {mfa && (
              <Field
                label="Authenticator code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                required
              />
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary login-submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to workspace"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <div className="or-divider">or continue with</div>
          <button
            className="btn btn-secondary passkey-button"
            onClick={passkey}
            disabled={busy}
          >
            <Fingerprint size={19} />
            Use a passkey
          </button>
          <p className="login-help">
            <LockKeyhole size={13} />
            First time here? Use your administrator-provided temporary password.
          </p>
          <Credit />
        </div>
      </div>
    </div>
  );
}
function PasswordForm({ json, onDone }) {
  const [old, setOld] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (next !== confirm) {
          setError("Passwords do not match.");
          return;
        }
        setBusy(true);
        try {
          const d = await json("/api/auth/change-password", {
            currentPassword: old,
            newPassword: next,
          });
          onDone(d.user);
          setOld("");
          setNext("");
          setConfirm("");
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field
        label="Current or temporary password"
        type="password"
        value={old}
        onChange={(e) => setOld(e.target.value)}
        autoComplete="current-password"
        required
      />
      <Field
        label="New password"
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        minLength={14}
        autoComplete="new-password"
        required
      />
      <Field
        label="Confirm new password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        required
      />
      <p className="muted">
        At least 14 characters, including uppercase, lowercase, and a number.
        Changing your password re-encrypts your saved credentials.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Securing your vault…" : "Save password"}
      </button>
    </form>
  );
}
function Vault({ entry, json, notify, onClose, canEdit, onEdit }) {
  const [password, setPassword] = useState(""),
    [creds, setCreds] = useState(null),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCreds(null), 30000);
    const hide = () => {
      if (document.hidden) setCreds(null);
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [creds]);
  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      notify(
        "Copied. Clearing will be attempted in 30 seconds; clipboard history may retain it.",
      );
      setTimeout(async () => {
        try {
          if ((await navigator.clipboard.readText()) === value)
            await navigator.clipboard.writeText("");
        } catch {}
      }, 30000);
    } catch {
      notify(
        "Clipboard blocked. Allow clipboard access or copy the revealed value manually.",
      );
    }
  }
  return (
    <Dialog title={`${entry.name} · Credentials`} onClose={onClose}>
      {!creds ? (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setCreds(
                await json(`/api/entries/${entry.id}/reveal`, { password }),
              );
              setPassword("");
              setError("");
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <p>
            Re-enter your account password to unlock these credentials for 30
            seconds.
          </p>
          <Field
            label="Account password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary">Unlock credentials</button>
        </form>
      ) : (
        <div className="stack">
          <label className="field">
            Username
            <div className="credential-row">
              <input readOnly value={creds.username} />
              <button
                className="icon-button"
                aria-label="Copy username"
                onClick={() => copy(creds.username)}
              >
                <Copy size={18} />
              </button>
            </div>
          </label>
          <label className="field">
            Password
            <div className="credential-row">
              <input
                readOnly
                type={show ? "text" : "password"}
                value={creds.password}
              />
              <button
                className="icon-button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button
                className="icon-button"
                aria-label="Copy password"
                onClick={() => copy(creds.password)}
              >
                <Copy size={18} />
              </button>
            </div>
          </label>
          <p className="muted">
            Web cards with saved credentials offer direct login through the
            ZadDesh browser extension on websites you approve.
          </p>
          {canEdit && (
            <button className="btn btn-secondary" onClick={onEdit}>
              Edit saved credentials
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setCreds(null)}>
            Lock now
          </button>
        </div>
      )}
    </Dialog>
  );
}
function Security({ user, json, api, setUser, notify }) {
  const [password, setPassword] = useState(""),
    [unlocked, setUnlocked] = useState(false),
    [setup, setSetup] = useState(null),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [passkeys, setPasskeys] = useState([]);
  async function keys() {
    const r = await api("/api/auth/passkeys");
    if (r.ok) setPasskeys((await r.json()).passkeys);
  }
  useEffect(() => {
    keys();
  }, []);
  async function run(fn) {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="stack">
      <p>
        Signed in as <strong>{user.username}</strong> · {user.role}
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await json("/api/auth/reauth", { password });
            setUnlocked(true);
            setPassword("");
            notify(
              "Vault unlocked. Security changes authorized for 60 seconds.",
            );
          });
        }}
      >
        <Field
          label="Confirm password to manage security or unlock vault"
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button className="btn btn-secondary">Confirm password</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="settings-section">
        <h3>Authenticator app</h3>
        <p className="muted">
          {user.has2fa
            ? "Two-factor authentication is enabled."
            : "Protect password sign-ins with a time-based verification code."}
        </p>
        {!user.has2fa ? (
          <>
            <button
              className="btn btn-secondary"
              disabled={!unlocked}
              onClick={() =>
                run(async () =>
                  setSetup(await json("/api/auth/totp/setup", {})),
                )
              }
            >
              Set up authenticator
            </button>
            {setup && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await json("/api/auth/totp/verify", { token: code });
                    setSetup(null);
                    setUser({ ...user, has2fa: true });
                    notify("Authenticator enabled.");
                  });
                }}
              >
                <p>Add this secret manually to your authenticator:</p>
                <code className="secret-code">{setup.secret}</code>
                <Field
                  label="Six-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                />
                <button className="btn btn-primary">
                  Enable authenticator
                </button>
              </form>
            )}
          </>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await json("/api/auth/totp/disable", {
                  password,
                  totpCode: code,
                });
                setUser({ ...user, has2fa: false });
                setPassword("");
                notify("Authenticator disabled.");
              });
            }}
          >
            <Field
              label="Password to disable authenticator"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Field
              label="Current authenticator code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
            />
            <button className="btn btn-danger">Disable authenticator</button>
          </form>
        )}
      </div>
      <div className="settings-section">
        <h3>Passkeys</h3>
        <p className="muted">
          Use your device PIN, biometrics, or security key to sign in. Your
          password is still required to unlock credentials.
        </p>
        <button
          className="btn btn-secondary"
          disabled={!unlocked}
          onClick={() =>
            run(async () => {
              const options = await json(
                  "/api/auth/passkey/register-options",
                  {},
                ),
                response = await startRegistration({ optionsJSON: options });
              await json("/api/auth/passkey/register-verify", { response });
              keys();
              notify("Passkey registered.");
            })
          }
        >
          <Fingerprint size={18} />
          Add passkey
        </button>
        {passkeys.map((p, i) => (
          <div className="credential-row" key={p.id}>
            <span>
              Passkey {i + 1} · {p.id.slice(0, 12)}
            </span>
            <button
              className="icon-button"
              disabled={!unlocked}
              aria-label={`Remove passkey ${i + 1}`}
              onClick={() =>
                run(async () => {
                  await json(
                    `/api/auth/passkeys/${encodeURIComponent(p.id)}`,
                    undefined,
                    "DELETE",
                  );
                  keys();
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <details className="settings-section">
        <summary>Change account password</summary>
        <PasswordForm
          json={json}
          onDone={(u) => {
            setUser(u);
            notify("Password changed. Other sessions have been signed out.");
          }}
        />
      </details>
    </div>
  );
}
function Transfer({ json, api, load, role, notify, onClose }) {
  const [error, setError] = useState("");
  return (
    <Dialog title="Import & export" onClose={onClose}>
      <div className="stack">
        <p>
          JSON exports contain only your shortcut definitions and custom icons.
          Credentials are excluded. Use the encrypted personal vault below to
          include saved passwords.
        </p>
        <button
          className="btn btn-primary"
          onClick={async () => {
            try {
              const r = await api("/api/backup/export");
              if (!r.ok) throw Error("Export failed.");
              download(await r.blob(), "zaddesh-shortcuts.json");
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <Download size={17} />
          Export my shortcuts
        </button>
        {role !== "Viewer" && (
          <label className="field">
            Import shortcut JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                try {
                  const f = e.target.files[0];
                  if (!f) return;
                  if (f.size > 4000000)
                    throw Error("File must be smaller than 4 MB.");
                  const d = JSON.parse(await f.text());
                  const result = await json("/api/backup/import", d);
                  load();
                  notify(`${result.imported} shortcuts imported.`);
                  onClose();
                } catch (e) {
                  setError(e.message);
                }
              }}
            />
          </label>
        )}
        <VaultTransfer json={json} role={role} load={load} notify={notify} />
        {error && <p className="error">{error}</p>}
        <div className="info-box">
          Host administrators: <code>npm run backup</code> creates an encrypted,
          consistent database snapshot. Keep the backup password and
          VAULT_SECRET in a separate password manager.
        </div>
      </div>
    </Dialog>
  );
}
