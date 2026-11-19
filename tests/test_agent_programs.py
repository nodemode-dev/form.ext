import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
ENGINE = all(importlib.util.find_spec(name) for name in ("ptyprocess", "fastapi")) and os.name != "nt"
STAND_INS = {"claude": "9.9.9 (Claude Code stand-in)", "codex": "codex-cli 0.99.1", "cursor-agent": "2026.11.01-standin"}


@unittest.skipUnless(ENGINE, "needs the engine's packages (run with the backend's Python) and a POSIX shell")
class AgentPrograms(unittest.TestCase):
    def setUp(self):
        from app.services import agent_programs, terminal

        self.programs, self.terminal = agent_programs, terminal
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

    def test_status_names_the_three_programs_found_with_versions(self):
        self.stand_ins()
        got = self.programs.status(fresh=True)
        self.assertEqual(list(got), ["claude", "codex", "cursor"])
        self.assertEqual(got["codex"], {"title": "Codex", "installed": True, "path": str(self.bin / "codex"), "version": "0.99.1", "signedIn": None, "install": "npm install -g @openai/codex"})
        self.assertEqual((got["cursor"]["path"], got["cursor"]["version"]), (str(self.bin / "cursor-agent"), "2026.11.01-standin"))
        self.assertEqual((got["claude"]["installed"], got["claude"]["version"], got["claude"]["signedIn"]), (True, "9.9.9", True))

    def test_status_says_codex_and_cursor_are_missing_with_the_line_to_install_them(self):
        os.environ["PATH"] = f"/usr/bin{os.pathsep}/bin"
        self.terminal.login_shell = lambda: ["/bin/sh", "-c", "exit 1", "--"]
        got = self.programs.status(fresh=True)
        for kind in ("codex", "cursor"):
            self.assertEqual((got[kind]["installed"], got[kind]["path"], got[kind]["version"]), (False, None, None))
            self.assertTrue(got[kind]["install"])
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
