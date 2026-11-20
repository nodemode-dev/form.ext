import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path

import stand_ins

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
ENGINE = all(importlib.util.find_spec(name) for name in ("ptyprocess", "fastapi")) and os.name != "nt"
STAND_INS = {"claude": "9.9.9 (Claude Code stand-in)", "codex": "codex-cli 0.99.1", "cursor-agent": "2026.11.01-standin", "agy": "agy 1.2.3-standin"}


@unittest.skipUnless(ENGINE, "needs the engine's packages (run with the backend's Python) and a POSIX shell")
class AgentPrograms(unittest.TestCase):
    def setUp(self):
        from app.services import agent_lookup, agent_programs, terminal

        self.programs, self.terminal = agent_programs, terminal
        agent_lookup.forget()
        self.addCleanup(agent_lookup.forget)
        self.tmp = tempfile.TemporaryDirectory()
        self.bin = Path(self.tmp.name) / "bin"
        self.bin.mkdir()
        self.saved = (os.environ.get("PATH"), os.environ.get("FORMEXT_CLAUDE_BIN"), terminal.login_shell, os.environ.get("FORMEXT_HOME"))
        os.environ.pop("FORMEXT_CLAUDE_BIN", None)
        os.environ["FORMEXT_HOME"] = str(Path(self.tmp.name) / "home")

    def tearDown(self):
        self.terminal.close_all()
        self.terminal.login_shell = self.saved[2]
        for name, value in (("PATH", self.saved[0]), ("FORMEXT_CLAUDE_BIN", self.saved[1]), ("FORMEXT_HOME", self.saved[3])):
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value
        self.tmp.cleanup()

    def stand_ins(self):
        for name, line in STAND_INS.items():
            script = self.bin / name
            script.write_text(f'#!/bin/sh\nif [ "$1" = "--version" ]; then echo "{line}"; exit 0; fi\nif [ "$1" = "auth" ]; then echo \'{{"loggedIn": true}}\'; exit 0; fi\necho started\nwhile read line; do :; done\n')
            script.chmod(0o755)
        os.environ["PATH"] = f"{self.bin}{os.pathsep}/usr/bin{os.pathsep}/bin"

    def test_status_names_the_four_programs_found_with_versions(self):
        self.stand_ins()
        got = self.programs.status(fresh=True)
        self.assertEqual(list(got), ["claude", "codex", "cursor", "antigravity"])
        codex = got["codex"]
        self.assertEqual((codex["title"], codex["installed"], codex["path"], codex["version"], codex["signedIn"], codex["install"]),
                         ("Codex", True, str(self.bin / "codex"), "0.99.1", None, "npm install -g @openai/codex"))
        self.assertEqual((codex["finding"], codex["how"], codex["looked"], codex["error"]), ("runs", "path", [], ""))
        self.assertEqual((got["cursor"]["path"], got["cursor"]["version"]), (str(self.bin / "cursor-agent"), "2026.11.01-standin"))
        self.assertEqual((got["antigravity"]["title"], got["antigravity"]["path"], got["antigravity"]["version"], got["antigravity"]["signedIn"]),
                         ("Antigravity", str(self.bin / "agy"), "1.2.3-standin", None))
        self.assertEqual((got["claude"]["installed"], got["claude"]["version"], got["claude"]["signedIn"]), (True, "9.9.9", True))
        self.assertNotIn("formmcp", got["claude"])

    def test_status_says_a_program_is_missing_with_where_it_looked_and_the_line_to_install_it(self):
        os.environ["PATH"] = f"/usr/bin{os.pathsep}/bin"
        got = self.programs.status(fresh=True)
        for kind in ("claude", "codex", "cursor", "antigravity"):
            self.assertEqual((got[kind]["installed"], got[kind]["path"], got[kind]["version"], got[kind]["finding"]), (False, None, None, "missing"))
            self.assertTrue(got[kind]["install"])
            self.assertIn("was not found. Looked in: PATH (/usr/bin:/bin); ~/.local/bin", got[kind]["said"])
            self.assertIn(got[kind]["install"], got[kind]["said"])
        with self.assertRaises(LookupError) as refused:
            self.programs.open_terminal("codex", 34099)
        self.assertEqual(str(refused.exception), got["codex"]["said"])

    def test_a_program_that_is_there_but_does_not_start_is_not_installed_and_says_why(self):
        self.stand_ins()
        (self.bin / "codex").write_text("#!/bin/sh\necho 'codex: cannot find node' >&2\nexit 3\n")
        got = self.programs.status(fresh=True)["codex"]
        self.assertEqual((got["installed"], got["path"], got["finding"], got["error"]), (False, str(self.bin / "codex"), "broken", "codex: cannot find node"))
        with self.assertRaises(LookupError):
            self.programs.open_terminal("codex", 34099)

    def test_a_program_tab_gets_its_own_token_in_its_environment_and_loses_it_when_it_closes(self):
        from app.services import consent

        self.stand_ins()
        for kind, title in (("codex", "Codex"), ("cursor", "Cursor")):
            info = self.programs.open_terminal(kind, 34099, 80, 20)
            self.assertEqual((info["kind"], info["title"], info["alive"]), (kind, title, True))
            session = self.terminal.SESSIONS[info["id"]]
            token = session.env["FORMEXT_INAPP_TOKEN"]
            self.assertTrue(consent.is_tab(token))
            self.assertTrue(all(token not in part for part in session.argv))
            self.assertEqual(session.env["FORMEXT_MCP_URL"], "http://127.0.0.1:34099/mcp")
            self.assertNotIn("FORMEXT_INAPP_TOKEN", self.terminal.base_env(34099))
            self.terminal.close(info["id"])
            self.assertFalse(consent.is_tab(token))

    def test_an_antigravity_tab_gets_its_entry_in_its_own_folder_and_loses_it_when_it_closes(self):
        import json

        from app.services import consent, paths

        self.stand_ins()
        folder = paths.home() / "agent-tabs" / "antigravity"
        held = folder / ".agents" / "mcp_config.json"
        held.parent.mkdir(parents=True)
        held.write_text(json.dumps({"mcpServers": {"other": {"command": "/bin/true"}}, "theme": "kept"}), encoding="utf-8")
        info = self.programs.open_terminal("antigravity", 34099, 80, 20, "some-project")
        self.assertEqual((info["kind"], info["title"], info["alive"], info["cwd"]), ("antigravity", "Antigravity", True, str(folder)))
        token = self.terminal.SESSIONS[info["id"]].env["FORMEXT_INAPP_TOKEN"]
        during = json.loads(held.read_text(encoding="utf-8"))
        self.assertEqual(during["mcpServers"]["formext_tab"], {"serverUrl": "http://127.0.0.1:34099/mcp", "headers": {"X-Formext-Inapp": token}})
        self.assertEqual((during["mcpServers"]["other"], during["theme"], held.stat().st_mode & 0o777), ({"command": "/bin/true"}, "kept", 0o600))
        self.assertTrue(consent.is_tab(token))
        self.terminal.close(info["id"])
        self.assertEqual(json.loads(held.read_text(encoding="utf-8")), {"mcpServers": {"other": {"command": "/bin/true"}}, "theme": "kept"})
        self.assertFalse(consent.is_tab(token))

    def test_status_and_starting_a_program_are_for_the_window_only(self):
        import formext_engine
        from app.main import app
        from app.services import window_key

        self.assertEqual(formext_engine._asgi(app, "GET", "/api/agents/status", []), 403)
        self.assertEqual(formext_engine._asgi(app, "POST", "/api/terminal/agent", []), 403)
        self.stand_ins()
        self.assertEqual(formext_engine._asgi(app, "GET", "/api/agents/status", [(window_key.HEADER.encode(), window_key.KEY.encode())]), 200)


if __name__ == "__main__":
    unittest.main()
