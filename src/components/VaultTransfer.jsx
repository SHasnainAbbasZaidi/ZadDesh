import React, { useState } from "react";
export default function VaultTransfer({ json, role, load, notify }) {
  const [password, setPassword] = useState(""),
    [archivePassword, setArchivePassword] = useState(""),
    [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(importing) {
    setBusy(true);
    setError("");
    try {
      if (importing && (!file || file.size > 3900000))
        throw Error("Choose a vault file smaller than 3.9 MB.");
      const result = await json(
        `/api/vault/${importing ? "import" : "export"}`,
        {
          password,
          archivePassword,
          ...(importing ? { archive: JSON.parse(await file.text()) } : {}),
        },
      );
      if (importing) {
        await load();
        notify(
          `${result.imported} resources and their credentials imported into your account.`,
        );
      } else {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(result)], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "zaddesh-personal.zdvault";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify("Encrypted personal vault exported.");
      }
      setPassword("");
      setArchivePassword("");
      setFile(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack settings-section">
      <h3>Encrypted personal vault</h3>
      <p>
        Includes only your entries and saved credentials. Imports add new
        entries; existing entries stay intact. Keep the archive password
        separately.
      </p>
      <label className="field">
        Your account password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label className="field">
        Archive password
        <input
          type="password"
          autoComplete="off"
          value={archivePassword}
          onChange={(e) => setArchivePassword(e.target.value)}
        />
      </label>
      <p className="muted">
        Use at least 14 characters with uppercase, lowercase and a number.
      </p>
      <button
        className="btn btn-secondary"
        disabled={busy || !password || !archivePassword}
        onClick={() => run(false)}
      >
        Export encrypted vault
      </button>
      {role !== "Viewer" && (
        <>
          <label className="field">
            Encrypted vault file
            <input
              type="file"
              accept=".zdvault,application/json"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </label>
          <button
            className="btn btn-secondary"
            disabled={busy || !file || !password || !archivePassword}
            onClick={() => run(true)}
          >
            Import encrypted vault
          </button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
