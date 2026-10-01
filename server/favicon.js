import https from "node:https";
import { resolvePublic, pinnedLookup } from "./network.js";
import { validCustomIcon } from "./security.js";
export async function fetchFavicon(target) {
  try {
    const url = new URL(target);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    )
      return null;
    const address = await resolvePublic(url.hostname);
    return await new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (!done) {
          done = true;
          resolve(value);
        }
      };
      const req = https.get(
        new URL("/favicon.png", url),
        { lookup: pinnedLookup(address), timeout: 4000 },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            finish(null);
            return;
          }
          const chunks = [];
          let bytes = 0;
          res.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > 200000) {
              req.destroy();
              finish(null);
            } else chunks.push(chunk);
          });
          res.on("error", () => finish(null));
          res.on("end", () => {
            const value =
              "data:image/png;base64," +
              Buffer.concat(chunks).toString("base64");
            finish(validCustomIcon(value) ? value : null);
          });
        },
      );
      req.on("timeout", () => {
        req.destroy();
        finish(null);
      });
      req.on("error", () => finish(null));
    });
  } catch {
    return null;
  }
}
