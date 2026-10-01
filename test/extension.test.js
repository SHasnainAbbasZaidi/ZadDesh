import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
test("direct login extension rejects wrong sender, HTTP and unapproved exact origins before opening tabs", async () => {
  let listener,
    opened = 0;
  const context = {
    URL,
    setTimeout,
    clearTimeout,
    chrome: {
      runtime: { onMessage: { addListener: (f) => (listener = f) } },
      storage: {
        local: {
          get: async () => ({
            dashboard: "http://localhost:8443",
            approvedOrigins: ["https://example.com"],
          }),
        },
      },
      permissions: { contains: async () => true },
      tabs: {
        create: async () => {
          opened++;
          throw Error("unexpected");
        },
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync("extension/background.js", "utf8"),
    context,
  );
  const run = (
    address,
    sender = { tab: { id: 1 }, frameId: 0, url: "http://localhost:8443/" },
  ) =>
    new Promise((resolve) =>
      listener(
        {
          type: "login",
          address,
          credentials: { username: "user", password: "secret" },
        },
        sender,
        resolve,
      ),
    );
  assert.match(
    (
      await run("https://example.com", {
        tab: { id: 1 },
        frameId: 0,
        url: "https://evil.example",
      })
    ).error,
    /configured/,
  );
  assert.match((await run("http://example.com")).error, /HTTPS/);
  assert.match((await run("https://example.com:8443")).error, /Allow/);
  assert.match((await run("https://evil.example")).error, /Allow/);
  assert.equal(opened, 0);
});

test("autofill submits a same-origin POST form and refuses GET, redirects, and cross-origin submit overrides", async () => {
  class Input {
    constructor(type, name) {
      this.type = type;
      this.name = name;
      this.id = name;
      this.autocomplete = "";
      this.disabled = false;
      this.events = [];
    }
    set value(value) {
      this.stored = value;
    }
    get value() {
      return this.stored;
    }
    getBoundingClientRect() {
      return { width: 100, height: 25 };
    }
    dispatchEvent(event) {
      this.events.push(event.type);
    }
  }
  const username = new Input("text", "username"),
    password = new Input("password", "password");
  let submitted = 0,
    override = false;
  const submit = {
    disabled: false,
    getBoundingClientRect: () => ({ width: 100, height: 25 }),
    hasAttribute: (attribute) => override && attribute === "formaction",
    formAction: "https://evil.example/login",
  };
  const form = {
    method: "post",
    action: "https://example.com/login",
    querySelectorAll: (selector) =>
      selector === "input" ? [username, password] : [submit],
    requestSubmit: () => submitted++,
  };
  password.form = form;
  const context = {
    chrome: { runtime: { onMessage: { addListener() {} } } },
    URL,
    location: {
      origin: "https://example.com",
      href: "https://example.com/login",
    },
    document: { querySelectorAll: () => [password] },
    getComputedStyle: () => ({ visibility: "visible" }),
    HTMLInputElement: Input,
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout,
  };
  vm.runInNewContext(
    fs.readFileSync("extension/background.js", "utf8"),
    context,
  );
  const creds = () => ({ username: "alice", password: "saved-secret" });
  assert.ok((await context.fill("https://other.example", creds())).error);
  form.method = "get";
  assert.ok((await context.fill("https://example.com", creds())).error);
  assert.equal(password.value, undefined);
  form.method = "post";
  override = true;
  assert.ok((await context.fill("https://example.com", creds())).error);
  assert.equal(password.value, undefined);
  override = false;
  assert.equal((await context.fill("https://example.com", creds())).ok, true);
  assert.equal(username.value, "alice");
  assert.equal(password.value, "saved-secret");
  assert.equal(submitted, 1);
  assert.deepEqual(password.events, ["input", "change"]);
});
