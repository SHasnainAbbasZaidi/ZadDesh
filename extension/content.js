window.addEventListener("message", async (e) => {
  if (e.source !== window || e.origin !== location.origin) return;
  const { dashboard } = await chrome.storage.local.get("dashboard");
  if (location.origin !== dashboard) return;
  if (e.data?.type === "ZD_EXTENSION_PING")
    window.postMessage({ type: "ZD_EXTENSION_READY" }, location.origin);
  if (e.data?.type !== "ZD_DIRECT_LOGIN") return;
  const { id, address, credentials } = e.data;
  if (
    typeof id !== "string" ||
    typeof address !== "string" ||
    typeof credentials?.username !== "string" ||
    typeof credentials?.password !== "string"
  )
    return;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "login",
      address,
      credentials,
    });
    window.postMessage(
      { type: "ZD_LOGIN_RESULT", id, ...result },
      location.origin,
    );
  } catch {
    window.postMessage(
      {
        type: "ZD_LOGIN_RESULT",
        id,
        error: "The extension could not complete the request.",
      },
      location.origin,
    );
  }
});
