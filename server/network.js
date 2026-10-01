import dns from "node:dns/promises";
import net from "node:net";
import ipaddr from "ipaddr.js";
export async function resolveAddresses(host) {
  if (net.isIP(host)) return [{ address: host, family: net.isIP(host) }];
  let timer;
  try {
    const answers = await Promise.race([
      dns.lookup(host, { all: true }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error("Target DNS lookup timed out.")),
          3000,
        );
      }),
    ]);
    if (!answers.length) throw Error("Unable to resolve target.");
    return answers;
  } finally {
    clearTimeout(timer);
  }
}
export async function resolvePublic(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "");
  const answers = await resolveAddresses(host);
  if (
    !answers.length ||
    answers.some((a) => ipaddr.process(a.address).range() !== "unicast")
  )
    throw Error("Private, reserved, and link-local targets are blocked.");
  return answers[0];
}
export const pinnedLookup = (address) => (_host, options, callback) =>
  options.all
    ? callback(null, [address])
    : callback(null, address.address, address.family);

export async function resolveProbe(hostname) {
  const answers = await resolveAddresses(hostname);
  const allowed = (
    process.env.PING_ALLOWED_CIDRS ??
    "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7"
  )
    .split(",")
    .filter(Boolean)
    .map((s) => ipaddr.parseCIDR(s.trim()));
  if (
    !answers.length ||
    answers.some((a) => {
      const ip = ipaddr.process(a.address);
      if (
        [
          "loopback",
          "linkLocal",
          "multicast",
          "unspecified",
          "broadcast",
          "reserved",
        ].includes(ip.range())
      )
        return true;
      return (
        ip.range() !== "unicast" &&
        !allowed.some(
          ([subnet, bits]) =>
            ip.kind() === subnet.kind() && ip.match(subnet, bits),
        )
      );
    })
  )
    throw Error("Target blocked by probe network policy.");
  return answers[0];
}
