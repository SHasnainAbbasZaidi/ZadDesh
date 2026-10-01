import fs from "node:fs";
import path from "node:path";
import * as simpleIcons from "simple-icons";

const customSVGs = {
  server:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
  router:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6.01 18H6"/><path d="M10.01 18H10"/><path d="M15 10v4"/><path d="M17.8 8A6 6 0 0 0 6.2 8"/><path d="M20.6 5A10 10 0 0 0 3.4 5"/></svg>',
  firewall:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  database:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>',
  rdp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/><path d="m10 9 2 2 2-2"/></svg>',
  ssh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>',
  terminal:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>',
  whm: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  network:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M5 16v-4h14v4"/><path d="M12 8v8"/></svg>',
  storage:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 8h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z"/><circle cx="6" cy="9" r="1"/><circle cx="6" cy="17" r="1"/></svg>',
  cloud:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
  activity:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  globe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.86a10 10 0 0 1 14 0"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  layers:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  "hard-drive":
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/></svg>',
  power:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" x2="12" y1="2" y2="12"/></svg>',
  radio:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
};

// Target list of names to look for in simple-icons
const simpleIconNames = [
  "cpanel",
  "namecheap",
  "hostinger",
  "godaddy",
  "cloudflare",
  "amazonwebservices",
  "amazonaws",
  "microsoftazure",
  "googlecloud",
  "microsoft",
  "windows",
  "linux",
  "ubuntu",
  "debian",
  "redhat",
  "centos",
  "archlinux",
  "alpinelinux",
  "anydesk",
  "rustdesk",
  "teamviewer",
  "proxmox",
  "vmware",
  "docker",
  "podman",
  "pfsense",
  "fortinet",
  "mikrotik",
  "sophos",
  "zabbix",
  "grafana",
  "uptimekuma",
  "nagios",
  "portainer",
  "github",
  "gitlab",
  "bitbucket",
  "kubernetes",
  "helm",
  "nginx",
  "apache",
  "traefik",
  "caddy",
  "pihole",
  "adguard",
  "nextcloud",
  "vaultwarden",
  "bitwarden",
  "plex",
  "jellyfin",
  "homeassistant",
  "wireguard",
  "openvpn",
  "tailscale",
  "netdata",
  "prometheus",
  "graylog",
  "splunk",
  "minio",
  "rabbitmq",
  "elasticsearch",
  "opensearch",
  "jenkins",
  "sonarqube",
  "postgresql",
  "mysql",
  "mariadb",
  "redis",
  "mongodb",
  "sqlite",
  "influxdb",
  "cockroachlabs",
  "truenas",
  "synology",
  "qnap",
  "openmediavault",
  "unraid",
  "hetzner",
  "digitalocean",
  "linode",
  "vultr",
  "ovh",
  "scaleway",
  "render",
  "vercel",
  "netlify",
  "supabase",
  "firebase",
  "appwrite",
  "directus",
  "strapi",
  "ghost",
  "wordpress",
  "drupal",
  "joomla",
  "phpmyadmin",
  "adminer",
  "dbeaver",
  "ansible",
  "terraform",
  "puppet",
  "vagrant",
  "packer",
  "consul",
  "nomad",
  "vault",
  "argo",
  "datadog",
  "newrelic",
  "sentry",
  "postman",
  "insomnia",
  "wireshark",
  "openwrt",
  "ubiquiti",
  "cisco",
  "junipernetworks",
  "checkpoint",
  "tailscale",
  "zerotier",
  "authentik",
  "keycloak",
];

const icons = [];

// 1. Add custom SVGs
for (const [key, svg] of Object.entries(customSVGs)) {
  icons.push({
    id: key,
    title: key.charAt(0).toUpperCase() + key.slice(1).replace("-", " "),
    category: ["rdp", "ssh", "terminal"].includes(key)
      ? "Remote & CLI"
      : [
            "server",
            "router",
            "firewall",
            "database",
            "network",
            "storage",
            "hard-drive",
          ].includes(key)
        ? "Infrastructure"
        : "General",
    hex: "00d4aa",
    svg: svg.startsWith("<svg")
      ? svg
      : `<svg viewBox="0 0 24 24" fill="currentColor">${svg}</svg>`,
  });
}

// 2. Add simple-icons
for (const [key, item] of Object.entries(simpleIcons)) {
  if (!item || typeof item !== "object" || !item.slug) continue;
  const slug = item.slug.toLowerCase();
  const title = item.title;

  if (
    simpleIconNames.includes(slug) ||
    simpleIconNames.some(
      (target) =>
        slug.includes(target) || item.title.toLowerCase().includes(target),
    )
  ) {
    if (!icons.some((i) => i.id === slug)) {
      let category = "Services";
      const low = (title + " " + slug).toLowerCase();
      if (
        [
          "cpanel",
          "whm",
          "namecheap",
          "hostinger",
          "godaddy",
          "cloudflare",
          "hetzner",
          "digitalocean",
          "linode",
          "vultr",
          "ovh",
        ].some((s) => low.includes(s))
      )
        category = "Hosting & Cloud";
      else if (
        [
          "aws",
          "azure",
          "google",
          "cloud",
          "render",
          "vercel",
          "netlify",
          "supabase",
          "firebase",
        ].some((s) => low.includes(s))
      )
        category = "Hosting & Cloud";
      else if (
        [
          "pfsense",
          "fortinet",
          "mikrotik",
          "sophos",
          "firewall",
          "cisco",
          "juniper",
          "ubiquiti",
          "openwrt",
          "wireguard",
          "openvpn",
          "tailscale",
          "zerotier",
        ].some((s) => low.includes(s))
      )
        category = "Network & Security";
      else if (
        [
          "zabbix",
          "grafana",
          "uptime",
          "nagios",
          "netdata",
          "prometheus",
          "graylog",
          "splunk",
          "datadog",
          "newrelic",
          "sentry",
        ].some((s) => low.includes(s))
      )
        category = "Monitoring";
      else if (
        [
          "proxmox",
          "vmware",
          "docker",
          "podman",
          "portainer",
          "kubernetes",
          "helm",
          "ansible",
          "terraform",
          "truenas",
          "synology",
          "qnap",
          "unraid",
        ].some((s) => low.includes(s))
      )
        category = "Virtualization & Storage";
      else if (
        ["rdp", "ssh", "anydesk", "rustdesk", "teamviewer"].some((s) =>
          low.includes(s),
        )
      )
        category = "Remote Access";
      else if (
        [
          "postgres",
          "mysql",
          "mariadb",
          "redis",
          "mongo",
          "sqlite",
          "database",
          "influxdb",
          "phpmyadmin",
          "adminer",
        ].some((s) => low.includes(s))
      )
        category = "Database";
      else if (
        [
          "linux",
          "ubuntu",
          "debian",
          "redhat",
          "centos",
          "arch",
          "alpine",
          "windows",
        ].some((s) => low.includes(s))
      )
        category = "Operating Systems";

      icons.push({
        id: slug,
        title: item.title,
        category,
        hex: item.hex || "3b82f6",
        svg: `<svg viewBox="0 0 24 24" fill="currentColor">${item.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</svg>`,
      });
    }
  }
}

// Ensure required icons explicitly exist:
const mustHaves = [
  {
    id: "amazonwebservices",
    title: "AWS",
    category: "Hosting & Cloud",
    hex: "FF9900",
  },
  {
    id: "microsoftazure",
    title: "Microsoft Azure",
    category: "Hosting & Cloud",
    hex: "0089D6",
  },
  { id: "microsoft", title: "Microsoft", category: "Services", hex: "5E5E5E" },
  {
    id: "windows",
    title: "Windows",
    category: "Operating Systems",
    hex: "0078D4",
  },
  { id: "cpanel", title: "cPanel", category: "Hosting & Cloud", hex: "FF6C2C" },
  {
    id: "godaddy",
    title: "GoDaddy",
    category: "Hosting & Cloud",
    hex: "1BDBDB",
  },
  {
    id: "hostinger",
    title: "Hostinger",
    category: "Hosting & Cloud",
    hex: "673DE6",
  },
  {
    id: "namecheap",
    title: "Namecheap",
    category: "Hosting & Cloud",
    hex: "DE3723",
  },
  {
    id: "pfsense",
    title: "pfSense",
    category: "Network & Security",
    hex: "000000",
  },
  {
    id: "fortinet",
    title: "Fortinet",
    category: "Network & Security",
    hex: "EE3124",
  },
  {
    id: "mikrotik",
    title: "MikroTik",
    category: "Network & Security",
    hex: "221E1F",
  },
  {
    id: "sophos",
    title: "Sophos",
    category: "Network & Security",
    hex: "002B49",
  },
  { id: "zabbix", title: "Zabbix", category: "Monitoring", hex: "D40000" },
  {
    id: "uptimekuma",
    title: "Uptime Kuma",
    category: "Monitoring",
    hex: "5CDD8B",
  },
  { id: "nagios", title: "Nagios", category: "Monitoring", hex: "000000" },
  {
    id: "portainer",
    title: "Portainer",
    category: "Virtualization & Storage",
    hex: "13BEF9",
  },
  { id: "anydesk", title: "AnyDesk", category: "Remote Access", hex: "EF443B" },
  {
    id: "rustdesk",
    title: "RustDesk",
    category: "Remote Access",
    hex: "38B6FF",
  },
  {
    id: "teamviewer",
    title: "TeamViewer",
    category: "Remote Access",
    hex: "0E80EB",
  },
  {
    id: "proxmox",
    title: "Proxmox",
    category: "Virtualization & Storage",
    hex: "E57000",
  },
  {
    id: "vmware",
    title: "VMware",
    category: "Virtualization & Storage",
    hex: "607078",
  },
];

for (const m of mustHaves) {
  if (!icons.some((i) => i.id === m.id)) {
    icons.push({
      id: m.id,
      title: m.title,
      category: m.category,
      hex: m.hex,
      svg: `<svg viewBox="0 0 32 32" fill="none"><rect x="1" y="1" width="30" height="30" rx="6" stroke="currentColor"/><text x="16" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="currentColor">${m.title === "Microsoft Azure" ? "AZ" : m.title.slice(0, 2).toUpperCase()}</text></svg>`,
    });
  }
}

// Sort alphabetically by title
icons.sort((a, b) => a.title.localeCompare(b.title));

console.log(`Generated ${icons.length} offline icons!`);

// Save to server and src directories
fs.mkdirSync(path.resolve("server"), { recursive: true });
fs.mkdirSync(path.resolve("src/data"), { recursive: true });
fs.mkdirSync(path.resolve("public/icons"), { recursive: true });
for (const icon of icons) {
  const svg = icon.svg
    .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replaceAll("currentColor", "#a8bf96");
  fs.writeFileSync(path.resolve("public/icons", icon.id + ".svg"), svg);
}
const catalog = icons.map(({ svg, ...metadata }) => metadata);
fs.writeFileSync(
  path.resolve("server/icons.json"),
  JSON.stringify(catalog, null, 2),
);
fs.writeFileSync(
  path.resolve("src/data/icons.json"),
  JSON.stringify(catalog, null, 2),
);
console.log("Saved icons to server/icons.json and src/data/icons.json");
