import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRemote,
  launchProtocol,
  desktopProtocol,
} from "../shared/launch.js";
import { entrySchema } from "../server/security.js";

test("Telnet entries validate switch targets and keep credentials out of launch URLs", () => {
  const base = { name: "Switch", category: "Network", method: "telnet" };
  for (const address of [
    "switch.example",
    "192.168.1.1:2323",
    "[2001:db8::1]:23",
  ]) {
    assert.equal(entrySchema.safeParse({ ...base, address }).success, true);
    const uri = desktopProtocol({ ...base, address });
    assert.equal(
      Buffer.from(uri.split("/").at(-1), "base64url").toString(),
      address,
    );
    assert.match(uri, /^zaddesh:\/\/telnet\//);
  }
  assert.equal(parseRemote("switch", "telnet").port, 23);
  assert.equal(parseRemote("switch:2323", "telnet").port, 2323);
  assert.equal(
    launchProtocol({ ...base, address: "[2001:db8::1]" }),
    "telnet://[2001:db8::1]:23",
  );
  for (const address of [
    "admin@switch",
    "switch:0",
    "switch:65536",
    "switch;calc",
    "switch\nwhoami",
    "-f",
    "$(calc)",
  ]) {
    assert.equal(
      entrySchema.safeParse({ ...base, address }).success,
      false,
      address,
    );
    assert.throws(() => desktopProtocol({ ...base, address }));
  }
});
