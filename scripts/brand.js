import fs from "node:fs";
import sharp from "sharp";
fs.mkdirSync("public/brand", { recursive: true });
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>ZadDesh</title><defs><linearGradient id="surface" x2="1" y2="1"><stop stop-color="#293e38"/><stop offset="1" stop-color="#101c1b"/></linearGradient><linearGradient id="ink" x2="1" y2="1"><stop stop-color="#e5ffd1"/><stop offset="1" stop-color="#a6e674"/></linearGradient></defs><rect x="1" y="1" width="62" height="62" rx="17" fill="url(#surface)" stroke="#577466" stroke-width="1.5"/><path d="M17 18h31v6L25 42h16v7H15v-7l23-17H17z" fill="url(#ink)"/><rect x="44" y="43" width="8" height="6" rx="1" fill="#e5ffd1"/></svg>`;
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80"><title>ZadDesh</title>${mark.replace('viewBox="0 0 64 64"', 'x="8" y="8" width="64" height="64" viewBox="0 0 64 64"')}<g transform="translate(86 0)" fill="none" stroke="#6eab4b" stroke-width="6" stroke-linecap="square" stroke-linejoin="round"><path d="M15 18h42L15 60h42M95 37c0-18-30-18-30 4v5c0 24 30 16 30 3V30v30M137 17v43-20c0-17-29-17-29 3v4c0 21 29 17 29-4M150 62h24M188 62h24"/></g></svg>`;
fs.writeFileSync("public/favicon.svg", mark);
fs.writeFileSync("public/brand/mark.svg", mark);
fs.writeFileSync("public/brand/logo.svg", logo);
await sharp(Buffer.from(logo))
  .resize(1280, 320)
  .png()
  .toFile("public/brand/logo.png");
for (const size of [16, 32, 180, 192, 512])
  await sharp(Buffer.from(mark))
    .resize(size, size)
    .png()
    .toFile(`public/brand/icon-${size}.png`);
fs.copyFileSync("public/brand/icon-180.png", "public/apple-touch-icon.png");
const png = fs.readFileSync("public/brand/icon-32.png"),
  header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 32;
header[7] = 32;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
fs.writeFileSync("public/favicon.ico", Buffer.concat([header, png]));
fs.writeFileSync(
  "public/site.webmanifest",
  JSON.stringify(
    {
      name: "ZadDesh",
      short_name: "ZadDesh",
      start_url: "/",
      display: "standalone",
      background_color: "#101315",
      theme_color: "#101315",
      icons: [192, 512].map((size) => ({
        src: `/brand/icon-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
      })),
    },
    null,
    2,
  ),
);
console.log("Generated SVG, ICO, PNG and web manifest branding.");
