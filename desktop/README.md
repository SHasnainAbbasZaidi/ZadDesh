# Windows native launcher

Run `./desktop/install.ps1` from PowerShell once on each Windows client computer that opens ZadDesh. It compiles the included C# source using the installed .NET Framework compiler and registers only the `zaddesh:` scheme under the current user's registry. No administrator privilege, background service, listening network port, or stored credential is needed. Keep this project folder in place or rerun installation after moving it.

RDP cards invoke `mstsc.exe /v:host:port`. SSH cards open Windows PowerShell with the installed OpenSSH client. Destination values are strictly validated; arbitrary commands and passwords are not accepted. The `--check URL` mode validates a URL without opening a client and returns an exit code for tests. Windows and the browser may ask permission to open the handler. Do not disable their protections.

AnyDesk and RustDesk use their vendor handlers; both were already installed on the development computer. Other machines need the appropriate vendor client installed. Browser automation cannot guarantee an external application opens, particularly inside the Codex in-app browser. Use Chrome or Edge when its external-app prompt is needed.

Only the explicit **Download Remote Desktop profile** link downloads an RDP file. Clicking Connect never downloads a profile or launcher. Downloaded profiles remain a manual alternative on macOS/Linux or machines without this bridge. The current bridge is Windows-only; the dialog retains native vendor/protocol options for other platforms.

To unregister the bridge, run `./desktop/uninstall.ps1`. It removes only the current user's `zaddesh:` registration and retains the source/binary files.

## Telnet switches

Choose **Telnet** when adding a resource and enter `switch-host:23` (or a custom port). The launcher runs Windows Telnet Client in a persistent terminal. Enable **Telnet Client** in Windows Features if it is missing, and rerun `./desktop/install.ps1` after updating this repository. The application reports a missing client rather than downloading anything. On other platforms, use an installed client with a registered `telnet://` handler or enter the host and port manually.

Telnet traffic, including credentials, is unencrypted. Prefer SSH whenever available and restrict legacy Telnet to a trusted management network. Credentials are entered at the switch prompt, never included in launch URLs or process arguments. Browser SSH remains SSH-only.
