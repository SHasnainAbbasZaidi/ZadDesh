import React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  Edit2,
  KeyRound,
  Server,
  Star,
  Trash2,
} from "lucide-react";
import icons from "../data/icons.json";
export default function ResourceCard({
  entry,
  expanded,
  onExpand,
  onLaunch,
  onEdit,
  onDelete,
  onFavorite,
  onVault,
  onMove,
  onPing,
  ping,
  canEdit,
}) {
  const icon = entry.icon.startsWith("data:")
    ? entry.icon
    : icons.some((i) => i.id === entry.icon)
      ? `/icons/${entry.icon}.svg`
      : null;
  const status = ping?.checking
    ? "Checking…"
    : ping?.online === true
      ? `${ping.latency} ms`
      : ping?.online === false
        ? "Offline"
        : ping?.error
          ? "Not checked"
          : "Ping";
  return (
    <article
      className={`resource-card ${expanded ? "is-expanded" : "is-compact"}`}
    >
      <div className="resource-summary">
        <span className="app-icon">
          {icon ? <img src={icon} alt="" /> : <Server size={23} />}
        </span>
        <div className="summary-title">
          <h3>
            <button onClick={() => onLaunch(entry)}>
              {entry.name}
              <ArrowUpRight size={15} />
            </button>
          </h3>
          <div className="summary-meta">
            <span className={`method ${entry.method}`}>
              {entry.method === "web" ? "WEB APP" : entry.method.toUpperCase()}
            </span>
            <button
              className={`ping-pill ${ping?.online === true ? "online" : ping?.online === false ? "offline" : ""}`}
              onClick={() => onPing(entry)}
              disabled={ping?.checking}
              title={
                ping?.error ||
                "TCP port reachability from the ZadDesh server, not application health."
              }
              aria-label={`Ping ${entry.name}: ${status}`}
            >
              <span />
              {status}
            </button>
          </div>
        </div>
        <button
          className={`icon-button star ${entry.isFavorite ? "selected" : ""}`}
          aria-label={`${entry.isFavorite ? "Unpin" : "Pin"} ${entry.name}`}
          onClick={() => onFavorite(entry)}
        >
          <Star size={16} fill={entry.isFavorite ? "currentColor" : "none"} />
        </button>
        <button
          className="icon-button expand-card"
          aria-label={`${expanded ? "Collapse" : "Expand"} ${entry.name}`}
          aria-expanded={expanded}
          aria-controls={`details-${entry.id}`}
          onClick={() => onExpand(entry.id)}
        >
          <ChevronDown size={17} />
        </button>
      </div>
      <div
        className="resource-details"
        id={`details-${entry.id}`}
        hidden={!expanded}
      >
        <p className="resource-address">{entry.address}</p>
        <p className="resource-description">
          {entry.description || "Ready when you are."}
        </p>
        {ping?.error && <p className="probe-explanation">{ping.error}</p>}
        <div className="card-bottom">
          <button
            className="btn btn-secondary card-launch"
            onClick={() => onLaunch(entry)}
          >
            <ArrowUpRight size={14} />
            {entry.method === "rdp"
              ? "Connect RDP"
              : entry.method === "ssh"
                ? "Open terminal"
                : "Launch"}
          </button>
          <div className="card-tools">
            {entry.hasCredentials && (
              <button
                className="icon-button"
                aria-label={`Open ${entry.name} credentials`}
                onClick={() => onVault(entry)}
              >
                <KeyRound size={16} />
              </button>
            )}
            {canEdit && (
              <>
                <button
                  className="icon-button"
                  aria-label={`Move ${entry.name} earlier`}
                  onClick={() => onMove(entry.id, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Move ${entry.name} later`}
                  onClick={() => onMove(entry.id, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Edit ${entry.name}`}
                  onClick={() => onEdit(entry)}
                >
                  <Edit2 size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Delete ${entry.name}`}
                  onClick={() => onDelete(entry)}
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
