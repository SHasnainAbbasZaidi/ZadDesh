import { configuration } from "./config.js";
import { createApp } from "./app.js";
import { attachSshProxy } from "./ssh-proxy.js";
const config = configuration();
const runtime = await createApp(config);
const server = runtime.app.listen(config.port, config.host, () =>
  console.log(`ZadDesh running at ${config.origin}`),
);
const wss = attachSshProxy(server, config, runtime.db);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    for (const ws of wss.clients) ws.close();
    server.close(() => {
      runtime.close();
      process.exit(0);
    });
  });
