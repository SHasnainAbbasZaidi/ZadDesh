const status = document.querySelector("#status");
chrome.storage.local
  .get("dashboard")
  .then(
    (v) =>
      (document.querySelector("#dashboard").value =
        v.dashboard || "http://localhost:8443"),
  );
function origin(value, local = false) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    !(
      u.protocol === "https:" ||
      (local &&
        u.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(u.hostname))
    )
  )
    throw Error("Use HTTPS (or localhost for ZadDesh).");
  return u.origin;
}
document.querySelector("#connect").onclick = async () => {
  try {
    const dashboard = origin(document.querySelector("#dashboard").value, true);
    if (
      !(await chrome.permissions.request({
        origins: [
          new URL(dashboard).protocol +
            "//" +
            new URL(dashboard).hostname +
            "/*",
        ],
      }))
    )
      throw Error("Permission declined.");
    await chrome.scripting.unregisterContentScripts();
    await chrome.storage.local.set({ dashboard });
    await chrome.scripting.registerContentScripts([
      {
        id: "zaddesh",
        matches: [
          new URL(dashboard).protocol +
            "//" +
            new URL(dashboard).hostname +
            "/*",
        ],
        js: ["content.js"],
        runAt: "document_idle",
      },
    ]);
    status.textContent = "Connected. Reload the ZadDesh tab.";
  } catch (e) {
    status.textContent = e.message;
  }
};
document.querySelector("#allow").onclick = async () => {
  try {
    const target = origin(document.querySelector("#target").value);
    if (
      !(await chrome.permissions.request({
        origins: [
          new URL(target).protocol + "//" + new URL(target).hostname + "/*",
        ],
      }))
    )
      throw Error("Permission declined.");
    const stored = await chrome.storage.local.get("approvedOrigins");
    await chrome.storage.local.set({
      approvedOrigins: [
        ...new Set([...(stored.approvedOrigins || []), target]),
      ],
    });
    status.textContent =
      "Website allowed. Return to ZadDesh and choose direct login.";
  } catch (e) {
    status.textContent = e.message;
  }
};
