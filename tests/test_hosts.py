import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import stand_ins

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "setup" / "hosts.py"
SPEC = ROOT / "setup" / "family.spec.json"
sys.path.insert(0, str(ROOT / "setup"))

import hosts  # noqa: E402


def run(*args):
    return subprocess.run([sys.executable, "-I", str(SCRIPT), *args], cwd=ROOT, capture_output=True, text=True)


class Hosts(unittest.TestCase):
    def test_check_is_clean(self):
        got = run("--family", str(SPEC), "--check")
        self.assertEqual(got.returncode, 0, got.stdout + got.stderr)
        self.assertEqual(got.stdout, "")

    def test_unreadable_spec(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp) / "bad.json"
            bad.write_text('{"format": "x"}', encoding="utf-8")
            self.assertEqual(run("--family", str(bad), "--check").returncode, 2)
            self.assertEqual(run("--family", str(Path(tmp) / "missing.json"), "--check").returncode, 2)

    def test_private_host_is_left_out(self):
        spec = json.loads(SPEC.read_text(encoding="utf-8"))
        spec["apps"] = [{"id": a["id"], "public": False} if a["id"] == "formtray" else a for a in spec["apps"]]
        before = {p: p.read_bytes() for p in (hosts.HOSTS_JSON, hosts.HOSTS_MD, SPEC)}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "spec.json"
            path.write_text(json.dumps(spec), encoding="utf-8")
            got = run("--family", str(path), "--check")
        self.assertEqual(got.returncode, 1)
        self.assertEqual(sorted(got.stdout.split()), sorted(["setup/hosts.json", ".claude/skills/HOSTS.md"]))
        self.assertEqual(before, {p: p.read_bytes() for p in before})
        doc, _ = hosts.build(spec, hosts.read_side(hosts.SIDE))
        self.assertNotIn("formtray", [h["id"] for h in doc["hosts"]])

    def test_same_spec_same_bytes(self):
        spec, side = hosts.read_spec(SPEC), hosts.read_side(hosts.SIDE)
        self.assertEqual(hosts.outputs(spec, side)[0], hosts.outputs(spec, side)[0])

    def test_a_release_that_shows_nothing_new_is_in_step(self):
        spec = json.loads(SPEC.read_text(encoding="utf-8"))
        spec["source"]["registry_version"] = "99.98.7"
        spec["generated"] = "2099-01-02T03:04:05Z"
        spec["content_sha256"] = "f" * 64
        spec["apps"].append({"id": "formunseen", "public": False})
        before = {p: p.read_bytes() for p in (hosts.HOSTS_JSON, hosts.HOSTS_MD, SPEC)}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "spec.json"
            path.write_text(json.dumps(spec), encoding="utf-8")
            got = run("--family", str(path), "--check")
        self.assertEqual(got.returncode, 0, got.stdout + got.stderr)
        self.assertEqual(got.stdout, "")
        self.assertEqual(before, {p: p.read_bytes() for p in before})
        files, _ = hosts.outputs(hosts.read_spec(SPEC), hosts.read_side(hosts.SIDE))
        kept = json.loads(SPEC.read_text(encoding="utf-8"))
        for text in files.values():
            for value in (kept["source"]["registry_version"], kept["generated"], kept["content_sha256"]):
                self.assertNotIn(value, text)

    def test_a_renamed_host_is_written_with_the_spec(self):
        spec = json.loads(SPEC.read_text(encoding="utf-8"))
        for app in spec["apps"]:
            if app["id"] == "formwav":
                app["name"] = "FormWave"
        before = {p: p.read_bytes() for p in (hosts.HOSTS_JSON, hosts.HOSTS_MD, SPEC)}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "spec.json"
            path.write_text(json.dumps(spec), encoding="utf-8")
            got = run("--family", str(path), "--check")
        self.assertEqual(got.returncode, 1)
        self.assertEqual(sorted(got.stdout.split()), sorted(["setup/hosts.json", ".claude/skills/HOSTS.md"]))
        self.assertEqual(before, {p: p.read_bytes() for p in before})
        files, _ = hosts.outputs(spec, hosts.read_side(hosts.SIDE))
        for path, text in files.items():
            self.assertIn("FormWave", text)
            self.assertNotEqual(path.read_text(encoding="utf-8"), text)

    def test_spec_extensions_win(self):
        spec = json.loads(SPEC.read_text(encoding="utf-8"))
        for app in spec["apps"]:
            if app["id"] == "formcut":
                app["manifest"] = {"extensions": {"host_api": "2"}}
        doc, said = hosts.build(spec, hosts.read_side(hosts.SIDE))
        cut = next(h for h in doc["hosts"] if h["id"] == "formcut")
        self.assertEqual((cut["host_api"], cut["host_api_from"]), ("2", "spec"))
        self.assertTrue(any("manifest.extensions: formcut" in line for line in said))


if __name__ == "__main__":
    unittest.main()
