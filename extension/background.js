chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== "login") return;
  (async () => {
    const { dashboard, approvedOrigins = [] } = await chrome.storage.local.get([
      "dashboard",
      "approvedOrigins",
    ]);
    if (
      !sender.tab ||
      sender.frameId !== 0 ||
      new URL(sender.url).origin !== dashboard
    )
      throw Error("Only your configured ZadDesh dashboard may request login.");
    const u = new URL(message.address);
    if (u.protocol !== "https:" || u.username || u.password)
      throw Error("Direct login requires an HTTPS destination.");
    if (
      !approvedOrigins.includes(u.origin) ||
      !(await chrome.permissions.contains({
        origins: [u.protocol + "//" + u.hostname + "/*"],
      }))
    )
      throw Error("Allow this website in the ZadDesh extension popup first.");
    const credentials = message.credentials;
    if (
      typeof credentials?.username !== "string" ||
      typeof credentials?.password !== "string" ||
      credentials.username.length > 256 ||
      credentials.password.length > 4096
    )
      throw Error("Invalid credentials.");
    const tab = await chrome.tabs.create({ url: u.href });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(Error("Website did not finish loading."));
      }, 15000);
      const listener = (id, info) => {
        if (id === tab.id && info.status === "complete") {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs.get(tab.id).then((t) => {
        if (t.status === "complete") listener(tab.id, { status: "complete" });
      });
    });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "ISOLATED",
      func: fill,
      args: [u.origin, credentials],
    });
    if (!results[0]?.result?.ok)
      throw Error(
        results[0]?.result?.error || "No supported login form found.",
      );
    return { ok: true };
  })().then(respond, (e) => respond({ error: e.message }));
  return true;
});
async function fill(origin, credentials) {
  if (location.origin !== origin)
    return {
      error: "Login redirected to another origin; credentials were not filled.",
    };
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.height > 0 &&
      !e.disabled &&
      getComputedStyle(e).visibility !== "hidden"
    );
  };
  for (let i = 0; i < 40; i++) {
    if (location.origin !== origin) return { error: "Website origin changed." };
    const passwords = [
      ...document.querySelectorAll("input[type=password]"),
    ].filter(visible);
    if (passwords.length === 1) {
      const password = passwords[0],
        form = password.form;
      if (
        !form ||
        form.method.toLowerCase() !== "post" ||
        password.autocomplete === "new-password" ||
        new URL(form.action, location.href).origin !== origin
      )
        return {
          error:
            "Unsupported or cross-origin login form; credentials were not filled.",
        };
      const candidates = [...form.querySelectorAll("input")].filter(
        (e) =>
          visible(e) &&
          ["text", "email", "tel"].includes(e.type) &&
          e.autocomplete !== "one-time-code",
      );
      const username =
        candidates.find((e) => e.autocomplete === "username") ||
        candidates.find((e) => /user|email|login/i.test(e.name + " " + e.id)) ||
        (candidates.length === 1 ? candidates[0] : null);
      if (!username)
        return { error: "Could not identify the username field safely." };
      const submit = [
        ...form.querySelectorAll(
          "button[type=submit],input[type=submit],button:not([type])",
        ),
      ].find(visible);
      if (
        (submit?.hasAttribute("formmethod") &&
          submit.formMethod.toLowerCase() !== "post") ||
        (submit?.hasAttribute("formaction") &&
          new URL(submit.formAction, location.href).origin !== origin)
      )
        return { error: "Cross-origin form submission is blocked." };
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      for (const [field, value] of [
        [username, credentials.username],
        [password, credentials.password],
      ]) {
        setter.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
      credentials.password = "";
      credentials.username = "";
      form.requestSubmit(submit);
      return { ok: true };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return {
    error:
      "No standard login form found. This site may use SSO, multi-step login, or a custom form.",
  };
}
