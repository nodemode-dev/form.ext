# Security policy

## Supported versions

Security fixes go into the newest release. Please update before reporting, and check whether the problem is still
there.

| Version | Supported |
| --- | --- |
| 0.2.x (latest release) | Yes |
| Anything older | No |

## Reporting a vulnerability

**Do not open a public issue for a security problem.** Use GitHub's private reporting instead: on the repository's
**Security** tab, choose **Report a vulnerability**. Include what you found, the steps to reproduce it, the version
and platform, and what an attacker could do with it.

You can expect an acknowledgement within a week. We will keep you informed while it is fixed and credit you in the
release notes, unless you would rather not be named.

A problem with a published extension, or with the registry's signing, index or block list, belongs to
[form.ext-registry](https://github.com/nodemode-dev/form.ext-registry/security): report it there, where a harmful
extension can be blocked in every app.

## What counts

form.ext runs on your own machine and runs code that is not yours yet (extensions you are making, importing or
trying), so the things that matter most are the ways that code, or something outside the machine, could get further
than it should:

- **The engine** listens on loopback (127.0.0.1:8640, or `FORMEXT_PORT`). Anything that makes it reachable from
  another machine, or lets a web page on another origin drive it.
- **The terminal and Claude Code**: anything other than form.ext's own window on this computer reaching a shell or
  Claude Code through the Terminal tab or the chat routes.
- **Preview and the simulated hosts**: an extension being previewed reaching the studio, the engine, your files or
  the network beyond what its manifest's permissions and your consent allow, or getting out of the sandboxed frame.
- **Packages**: importing a `.formpkg` or a project in a way that writes outside its project folder, or a package
  that passes Check and Package while breaking the Form Extension Contract's rules (native code, remote scripts,
  dynamic code).
- **Signing keys**: the publisher keys form.ext makes and keeps are private to your user account; anything that
  leaks a private key, or signs with it without you asking.
- **Run in App and Send to FormPortal**: anything that installs or enables an extension in a Form app without you
  asking, or with permissions other than those you were shown.
- **Agents and the MCP server** (`./formext mcp`, Claude Code, Codex and Cursor): a tool reaching beyond the projects
  folder, or acting on an app without the step you would take in the window.

Bugs that need someone to already control your machine, or to run a modified build of form.ext, are ordinary bugs:
please open an issue for those.
