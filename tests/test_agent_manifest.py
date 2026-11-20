import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import stand_ins

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))


class AgentManifest(unittest.TestCase):
    def test_sync_check_is_clean(self):
        run = subprocess.run([sys.executable, str(ROOT / "setup" / "agents.py"), "sync", "--check"], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertNotIn("agents/manifest.json", run.stdout)

    def test_lists_follow_the_catalogue(self):
        from app.cli import OPS

        mcp = json.loads((ROOT / "agents" / "manifest.json").read_text(encoding="utf-8"))["mcp"]
        tools = [op for op in OPS if op.mcp]
        self.assertEqual(mcp["tools"], [op.name for op in tools])
        self.assertEqual(mcp["read_only"], [op.name for op in tools if op.read_only])
        self.assertEqual(mcp["approval_gated"], [op.name for op in tools if not op.read_only])


class SharedFinder(unittest.TestCase):
    LOOKUP = "backend/app/services/agent_lookup.py"

    def agents(self, root: Path):
        spec = importlib.util.spec_from_file_location("checked_agents", root / "setup" / "agents.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def version(self) -> str:
        return re.search(r'^VERSION = "([^"]+)"$', (ROOT / self.LOOKUP).read_text(encoding="utf-8"), re.M).group(1)

    def test_the_shared_finder_matches_the_hash_recorded_for_its_version(self):
        module = self.agents(ROOT)
        self.assertEqual(module.LOOKUP_HASHES[self.version()], hashlib.sha256((ROOT / self.LOOKUP).read_bytes()).hexdigest())
        self.assertEqual(module.lookup_problems(), [])

    def test_the_check_names_the_shared_finder_edited_in_place_or_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            copy = Path(tmp) / "repo"
            (copy / "backend" / "app" / "services").mkdir(parents=True)
            shutil.copytree(ROOT / "setup", copy / "setup")
            shutil.copy(ROOT / "backend" / "app" / "__init__.py", copy / "backend" / "app" / "__init__.py")
            for name in ("__init__.py", "agents.py", "paths.py", "agent_lookup.py"):
                shutil.copy(ROOT / "backend" / "app" / "services" / name, copy / "backend" / "app" / "services" / name)
            module = self.agents(copy)
            self.assertEqual(module.lookup_problems(), [])
            with open(copy / self.LOOKUP, "a", encoding="utf-8") as f:
                f.write("\n")
            self.assertEqual(module.lookup_problems(), [f"{self.LOOKUP}: does not match the hash recorded for version {self.version()} (the shared finder changes only as a whole new version)"])
            (copy / self.LOOKUP).unlink()
            self.assertEqual(module.lookup_problems(), [f"{self.LOOKUP}: missing (the shared finder for the agent programs)"])

    def test_the_shared_finder_imports_nothing_from_the_app(self):
        imports = set(re.findall(r"^\s*(?:from|import)\s+([\w.]+)", (ROOT / self.LOOKUP).read_text(encoding="utf-8"), re.M))
        self.assertEqual(imports, {"__future__", "dataclasses", "os", "pathlib", "re", "shutil", "signal", "subprocess", "sys", "threading", "time", "winreg"})


if __name__ == "__main__":
    unittest.main()
