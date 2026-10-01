export function parseRemote(address, method = "ssh") {
  const match =
    /^(?:([a-zA-Z0-9_][a-zA-Z0-9_.-]*)@)?(\[[a-fA-F0-9:]+\]|[a-zA-Z0-9][a-zA-Z0-9.-]*)(?::(\d{1,5}))?$/.exec(
      address,
    );
  if (!match || (method === "rdp" && match[1]))
    throw Error("Use a valid hostname or user@host:port.");
  const port = Number(match[3] || (method === "rdp" ? 3389 : 22));
  if (port < 1 || port > 65535)
    throw Error("Port must be between 1 and 65535.");
  return { host: match[2].replace(/^\[|\]$/g, ""), user: match[1] || "", port };
}
export function sshCommand(address) {
  const { host, user, port } = parseRemote(address);
  return `ssh -p ${port}${user ? ` -l "${user}"` : ""} "${host}"`;
}
export function sshLaunchFile(address, platform) {
  const command = sshCommand(address);
  if (platform === "windows")
    return {
      extension: "cmd",
      content: `@echo off\r\ntitle ZadDesh SSH\r\n${command}\r\npause\r\n`,
    };
  if (!["mac", "linux"].includes(platform))
    throw Error("Choose Windows, macOS, or Linux.");
  return {
    extension: platform === "mac" ? "command" : "sh",
    content: `#!/bin/sh\n# ZadDesh SSH launcher: no passwords are stored in this file.\n${command}\nprintf '\\nConnection closed. Press Enter to exit.'\nread answer\n`,
  };
}
export function launchProtocol(entry) {
  if (entry.method === "ssh") {
    const p = parseRemote(entry.address);
    const host = p.host.includes(":") ? `[${p.host}]` : p.host;
    return `ssh://${p.user ? encodeURIComponent(p.user) + "@" : ""}${host}:${p.port}`;
  }
  if (entry.method === "rdp") {
    const p = parseRemote(entry.address, "rdp");
    return `rdp://${p.host}:${p.port}`;
  }
  if (entry.method === "anydesk")
    return `anydesk:${entry.address.replaceAll(" ", "")}`;
  if (entry.method === "rustdesk")
    return `rustdesk://${entry.address.replaceAll(" ", "")}`;
  return entry.address;
}

export function desktopProtocol(entry) {
  if (!["rdp", "ssh"].includes(entry.method)) return launchProtocol(entry);
  parseRemote(entry.address, entry.method);
  const encoded = btoa(entry.address)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  return `zaddesh://${entry.method}/${encoded}`;
}
