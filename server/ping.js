import net from "node:net";
import { resolveProbe } from "./network.js";
import { parseRemote } from "../shared/launch.js";
export async function pingEntry(address, method) {
  if (!["web", "rdp", "ssh"].includes(method))
    return {
      online: null,
      latency: null,
      error:
        "A remote ID cannot be pinged directly; use the client to check availability.",
    };
  try {
    let host, port;
    if (method === "web") {
      const url = new URL(address);
      host = url.hostname.replace(/^\[|\]$/g, "");
      port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    } else {
      const parsed = parseRemote(address, method);
      host = parsed.host;
      port = parsed.port;
    }
    const ip = await resolveProbe(host),
      start = performance.now();
    return await new Promise((resolve) => {
      const socket = new net.Socket();
      let done = false;
      const finish = (online, error) => {
        if (done) return;
        done = true;
        socket.destroy();
        resolve({
          online,
          latency: online ? Math.round(performance.now() - start) : null,
          error,
          checkedAt: new Date().toISOString(),
          probe: "tcp",
        });
      };
      socket.setTimeout(3000);
      socket.once("connect", () => finish(true, null));
      socket.once("timeout", () => finish(false, "Connection timed out."));
      socket.once("error", () =>
        finish(false, "Port is unreachable from the ZadDesh server."),
      );
      socket.connect(port, ip.address);
    });
  } catch (e) {
    return {
      online: null,
      latency: null,
      error:
        e.message === "Target blocked by probe network policy."
          ? e.message
          : "Unable to resolve target.",
      probe: "tcp",
    };
  }
}
