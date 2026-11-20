import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import stand_ins

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))


def setup_agents():
    spec = importlib.util.spec_from_file_location("formext_setup_agents", ROOT / "setup" / "agents.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class DockModule(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.agents = setup_agents()
        except ImportError as err:
            raise unittest.SkipTest(f"the engine's packages are needed: {err}")

    def copy(self) -> Path:
        folder = Path(tempfile.mkdtemp(prefix="formext-dock-")) / "dock"
        shutil.copytree(self.agents.DOCK_DIR, folder)
        self.addCleanup(shutil.rmtree, folder.parent, True)
        return folder

    def test_the_folder_matches_its_manifest(self):
        self.assertEqual(self.agents.dock_problems(), [])
        manifest = json.loads((self.agents.DOCK_DIR / "MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["version"], self.agents.DOCK_VERSION)
        self.assertEqual(len(manifest["files"]), 14)

    def test_a_changed_file_is_named(self):
        folder = self.copy()
        with open(folder / "keys.ts", "a", encoding="utf-8") as f:
            f.write("\n")
        self.assertEqual(self.agents.dock_problems(folder), ["frontend/src/dock/keys.ts differs from MANIFEST.json"])

    def test_a_missing_and_an_extra_file_are_named(self):
        folder = self.copy()
        (folder / "tour.ts").unlink()
        (folder / "notes.txt").write_text("x", encoding="utf-8")
        self.assertEqual(self.agents.dock_problems(folder), ["frontend/src/dock/notes.txt is extra", "frontend/src/dock/tour.ts is missing"])

    def test_an_import_from_the_app_is_named(self):
        folder = self.copy()
        (folder / "extra.ts").write_text("import { api } from '../shell';\n", encoding="utf-8")
        problems = self.agents.dock_problems(folder)
        self.assertIn("frontend/src/dock/extra.ts imports ../shell from outside the dock folder", problems)

    def test_the_sync_check_reports_the_folder(self):
        run = subprocess.run([sys.executable, str(ROOT / "setup" / "agents.py"), "sync", "--check"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertNotIn("dock module", run.stdout)

    def test_the_manifest_lists_the_tabs_the_panel_offers(self):
        dock = json.loads((ROOT / "agents" / "manifest.json").read_text(encoding="utf-8"))["dock"]
        self.assertEqual(dock, {"present": True, "positions": ["bottom"], "tabs": ["shell", "claude", "codex", "cursor", "chat"]})


class TabEntry(unittest.TestCase):
    def test_the_entry_written_for_a_tab_is_formext_tab(self):
        try:
            from app.cli import allowed_tools
            from app.services import claude_code, consent
        except ImportError as err:
            raise unittest.SkipTest(f"the engine's packages are needed: {err}")
        home = tempfile.mkdtemp(prefix="formext-home-")
        self.addCleanup(shutil.rmtree, home, True)
        saved = os.environ.get("FORMEXT_HOME")
        os.environ["FORMEXT_HOME"] = home
        try:
            token, path = claude_code.tab_config(8640)
        finally:
            if saved is None:
                del os.environ["FORMEXT_HOME"]
            else:
                os.environ["FORMEXT_HOME"] = saved
        try:
            servers = json.loads(Path(path).read_text(encoding="utf-8"))["mcpServers"]
            self.assertIn("formext_tab", servers)
            self.assertNotIn("formext", servers)
            self.assertEqual(servers["formext_tab"]["env"]["FORMEXT_INAPP_TOKEN"], token)
            self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
            self.assertTrue(consent.is_tab(token))
        finally:
            consent.close_tab(token)
        self.assertFalse(consent.is_tab(token))
        self.assertTrue(all(name.startswith("mcp__formext_tab__") for name in allowed_tools("formext_tab") if "formext" in name))
        self.assertTrue(any(name.startswith("mcp__formext__") for name in allowed_tools()))


if __name__ == "__main__":
    unittest.main()
