export function generateRdpContent(entry, credentials = {}) {
  if (!/^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(entry.address))
    throw Error("Invalid RDP address.");
  let fullAddress = entry.address;
  if (!fullAddress.includes(":")) {
    fullAddress = `${fullAddress}:3389`;
  }

  const username = (credentials.username || "").replace(/[\r\n\x00]/g, "");

  const lines = [
    `full address:s:${fullAddress}`,
    `username:s:${username}`,
    `screen mode id:i:2`,
    `use multimon:i:0`,
    `desktopwidth:i:1920`,
    `desktopheight:i:1080`,
    `session bpp:i:32`,
    `winposstr:s:0,1,0,0,1920,1080`,
    `compression:i:1`,
    `keyboardhook:i:2`,
    `audiocapturemode:i:0`,
    `videoplaybackmode:i:1`,
    `connection type:i:7`,
    `networkautodetect:i:1`,
    `bandwidthautonetworkdetect:i:1`,
    `displayconnectionbar:i:1`,
    `enableworkspacereconnect:i:0`,
    `disable wallpaper:i:0`,
    `allow font smoothing:i:1`,
    `allow desktop composition:i:1`,
    `disable full window drag:i:1`,
    `disable menu anims:i:1`,
    `disable themes:i:0`,
    `disable cursor setting:i:0`,
    `bitmapcachepersistenable:i:1`,
    `audiomode:i:0`,
    `redirectprinters:i:0`,
    `redirectcomports:i:0`,
    `redirectsmartcards:i:0`,
    `redirectclipboard:i:1`,
    `redirectposdevices:i:0`,
    `autoreconnection enabled:i:1`,
    `authentication level:i:2`,
    `prompt for credentials:i:1`,
    `negotiate security layer:i:1`,
    `remoteapplicationmode:i:0`,
    `alternate shell:s:`,
    `shell working directory:s:`,
    `gatewayhostname:s:`,
    `gatewayusagemethod:i:4`,
    `gatewaycredentialssource:i:4`,
    `gatewayprofileusagemethod:i:0`,
    `promptcredentialonce:i:0`,
    `use redirection server name:i:0`,
    `rdgiskdcproxy:i:0`,
    `kdcproxyname:s:`,
  ];

  return lines.join("\r\n") + "\r\n";
}
