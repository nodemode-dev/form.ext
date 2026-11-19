import json
import subprocess
import sys
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
