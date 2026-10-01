import React, { useEffect, useState } from "react";
export default function DirectLogin({ entry, json }) {
  const [ready, setReady] = useState(false),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const receive = (e) => {
      if (
        e.source === window &&
        e.origin === location.origin &&
        e.data?.type === "ZD_EXTENSION_READY"
      )
        setReady(true);
    };
    window.addEventListener("message", receive);
    window.postMessage({ type: "ZD_EXTENSION_PING" }, location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);
  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    let listener, timer;
    try {
      const credentials = await json(`/api/entries/${entry.id}/reveal`, {
        password,
      });
      setPassword("");
      const id = crypto.randomUUID();
      await new Promise((resolve, reject) => {
        listener = (event) => {
          if (
            event.source !== window ||
            event.origin !== location.origin ||
            event.data?.type !== "ZD_LOGIN_RESULT" ||
            event.data.id !== id
          )
            return;
          event.data.error ? reject(Error(event.data.error)) : resolve();
        };
        window.addEventListener("message", listener);
        timer = setTimeout(
          () =>
            reject(
              Error(
                "Extension did not complete the login. Check the opened tab.",
              ),
            ),
          35000,
        );
        window.postMessage(
          { type: "ZD_DIRECT_LOGIN", id, address: entry.address, credentials },
          location.origin,
        );
      });
      setMessage(
        "Credentials filled and login submitted. Complete any MFA or CAPTCHA in the opened tab.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      clearTimeout(timer);
      if (listener) window.removeEventListener("message", listener);
      setBusy(false);
    }
  }
  return (
    <form className="stack" onSubmit={login}>
      <p>
        Direct login uses your saved credentials on{" "}
        <strong>{new URL(entry.address).origin}</strong>. It works with standard
        username/password forms. MFA, CAPTCHA, SSO and multi-step forms can
        require your interaction.
      </p>
      {!ready && (
        <div className="info-box">
          Install the included <code>extension/</code> folder as an unpacked
          extension in Chrome or Edge. Configure your ZadDesh address and permit
          the target website using its popup. This feature is unavailable in the
          Codex in-app browser.
        </div>
      )}
      <label className="field">
        Confirm your ZadDesh password
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <button className="btn btn-primary" disabled={!ready || busy}>
        {busy ? "Opening secure login…" : "Log in with saved credentials"}
      </button>
      <a
        className="btn btn-secondary"
        href={entry.address}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open without automatic login
      </a>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
