using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;
class Launcher {
  [STAThread] static int Main(string[] args) {
    try {
      bool check = args.Length == 2 && args[0] == "--check";
      if (args.Length != 1 && !check) throw new Exception("One connection URL is required.");
      var uri = Regex.Match(args[check ? 1 : 0], @"^zaddesh://(rdp|ssh|telnet)/([A-Za-z0-9_-]{1,500})/?$");
      if (!uri.Success) throw new Exception("Invalid connection URL.");
      string encoded = uri.Groups[2].Value.Replace('-', '+').Replace('_', '/');
      string address = Encoding.UTF8.GetString(Convert.FromBase64String(encoded.PadRight((encoded.Length + 3) / 4 * 4, '=')));
      var match = Regex.Match(address, @"^(?:([A-Za-z0-9_][A-Za-z0-9_.-]*)@)?(\[[a-fA-F0-9:]+\]|[A-Za-z0-9][A-Za-z0-9.-]*)(?::([0-9]{1,5}))?$");
      if (!match.Success) throw new Exception("Invalid destination.");
      bool rdp = uri.Groups[1].Value == "rdp";
      bool telnet = uri.Groups[1].Value == "telnet";
      if ((rdp || telnet) && match.Groups[1].Success) throw new Exception("Enter the username at the remote login prompt.");
      int port = match.Groups[3].Success ? int.Parse(match.Groups[3].Value) : rdp ? 3389 : telnet ? 23 : 22;
      if (port < 1 || port > 65535) throw new Exception("Invalid port.");
      string host = match.Groups[2].Value;
      string windows = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
      string exe = Path.Combine(windows, rdp ? @"System32\mstsc.exe" : telnet ? @"System32\telnet.exe" : @"System32\OpenSSH\ssh.exe");
      if (check) return 0;
      if (!File.Exists(exe)) throw new Exception(telnet ? "Enable Telnet Client in Windows Features, then try again." : "Install Windows OpenSSH Client / Remote Desktop first.");
      if (rdp) Process.Start(new ProcessStartInfo(exe, "/v:" + host + ":" + port) {UseShellExecute=true});
      else {
        // Only strict alphanumeric host/user values reach this command. Never accept arbitrary commands or passwords.
        string command = "& '" + exe + "' -p " + port + (match.Groups[1].Success ? " -l '" + match.Groups[1].Value + "'" : "") + " '" + host.Trim('[', ']') + "'";
        if (telnet) command = "& '" + exe + "' '" + host.Trim('[', ']') + "' " + port;
        Process.Start(new ProcessStartInfo(Path.Combine(windows,@"System32\WindowsPowerShell\v1.0\powershell.exe"), "-NoProfile -NoExit -Command \"" + command + "\"") {UseShellExecute=true});
      }
      return 0;
    } catch (Exception e) {
      if (args.Length > 0 && args[0] == "--check") return 1;
      MessageBox.Show(e.Message,"ZadDesh Launcher",MessageBoxButtons.OK,MessageBoxIcon.Error);
      return 1;
    }
  }
}
