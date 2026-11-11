from __future__ import annotations

import hashlib
import importlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import zipfile
from pathlib import Path

from app.services import paths
from app.services.bus import bus
from app.services.keys import SignatureRefused, check_signature, keys
from app.services.validate import validate_folder
from app.services.workspace import NotFound, WorkspaceError, workspace

paths.use_contract()
formpkg = importlib.import_module("formpkg")

SHA_RE = re.compile(r"^[0-9a-f]{64}\Z")
RECORD = "build.json"
CONTRACT_RULES = {"json", "package", "schema", "host", "missing-entry"}
DEFAULT_URL ="https://formai.studio/extensions/packages/{id}-{version}.formpkg"


class Refused(WorkspaceError):
    status = 422

    def __init__(self, message: str, check: dict | None = None) -> None:
        super().__init__(message)
        self.check = check


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _kit_build(folder: Path, out_dir: Path) -> tuple[Path, str, int, dict]:
    try:
        return formpkg.build(folder, out_dir)
    except SystemExit as e:
        text = str(e.code) if e.code is not None else "refused"
        raise Refused(text.replace("refused:\n  ", "refused: ").replace("\n  ", "; ")) from None


def _entries(target: Path) -> list[dict]:
    with zipfile.ZipFile(target) as z:
        return [{"path": i.filename, "size": i.file_size, "packed": i.compress_size, "sha256": _sha(z.read(i.filename))} for i in z.infolist()]


class Packages:
    def __init__(self) -> None:
        self._lock = threading.Lock()

    def _root(self, pid: str) -> Path:
        if not isinstance(pid, str) or not re.match(r"^[a-z0-9][a-z0-9-]{1,63}\Z", pid):
            raise NotFound("no such project")
        folder = paths.builds_dir() / pid
        folder.mkdir(parents=True, exist_ok=True)
        return folder

    def _dir(self, pid: str, sha: str) -> Path:
        if not isinstance(sha, str) or not SHA_RE.match(sha):
            raise NotFound("no such build")
        folder = self._root(pid) / sha
        if not (folder / RECORD).is_file():
            raise NotFound(f"no build {sha[:12]} of {pid}")
        return folder

    def _read(self, folder: Path) -> dict:
        return json.loads((folder / RECORD).read_text(encoding="utf-8"))

    def _write(self, folder: Path, record: dict) -> None:
        tmp = folder / f".{RECORD}.tmp"
        tmp.write_text(json.dumps(record, indent=2), encoding="utf-8")
        os.replace(tmp, folder / RECORD)

    def _public(self, folder: Path, record: dict) -> dict:
        out = dict(record)
        out["path"] = str(folder / record["file"])
        return out

    def get(self, pid: str, sha: str) -> dict:
        folder = self._dir(pid, sha)
        return self._public(folder, self._read(folder))

    def file(self, pid: str, sha: str) -> Path:
        folder = self._dir(pid, sha)
        record = self._read(folder)
        target = folder / record["file"]
        if not target.is_file():
            raise NotFound("the package file of this build is gone")
        return target

    def list(self, pid: str) -> list[dict]:
        out = []
        for folder in self._root(pid).iterdir():
            if folder.is_dir() and SHA_RE.match(folder.name) and (folder / RECORD).is_file():
                try:
                    out.append(self._public(folder, self._read(folder)))
                except (OSError, ValueError):
                    continue
        out.sort(key=lambda r: r.get("last_built_at", 0), reverse=True)
        return out

    def check(self, pid: str) -> dict:
        return validate_folder(workspace.package_dir(pid), workspace.package_prefix(pid))

    def build(self, pid: str, anyway: bool = False) -> dict:
        folder = workspace.package_dir(pid)
        result = self.check(pid)
        counts = result["counts"]
        errors = [p for p in result["problems"] if p["severity"] == "error"]
        blocking = [p for p in errors if p["rule"] in CONTRACT_RULES]
        if blocking:
            n = len(blocking)
            raise Refused(f"{n} contract error{'s' if n != 1 else ''}: every host would refuse this package. Fix {'them' if n != 1 else 'it'} first (Check lists where).", result)
        if errors and not anyway:
            n = len(errors)
            raise Refused(f"Check found {n} code error{'s' if n != 1 else ''} (parts of the extension may not run). Fix {'them' if n != 1 else 'it'}, or package anyway.", result)
        root = self._root(pid)
        with self._lock:
            staging = Path(tempfile.mkdtemp(prefix=".build-", dir=root))
            try:
                target, digest, size, manifest = _kit_build(folder, staging)
                final = root / digest
                now = time.time()
                if (final / RECORD).is_file():
                    record = self._read(final)
                    record["last_built_at"] = now
                    record["times_built"] = int(record.get("times_built", 1)) + 1
                    record["check"] = counts
                    fresh = False
                else:
                    if final.exists():
                        shutil.rmtree(final)
                    final.mkdir()
                    os.replace(target, final / target.name)
                    record = {
                        "format": "formext-build",
                        "format_version": 1,
                        "sha256": digest,
                        "bytes": size,
                        "file": target.name,
                        "project": pid,
                        "id": manifest["id"],
                        "name": manifest["name"],
                        "product": manifest["product"],
                        "version": manifest["version"],
                        "manifest": manifest,
                        "entries": _entries(final / target.name),
                        "built_at": now,
                        "last_built_at": now,
                        "times_built": 1,
                        "check": counts,
                        "signatures": [],
                    }
                    fresh = True
                self._write(final, record)
            finally:
                shutil.rmtree(staging, ignore_errors=True)
        out = self._public(final, record)
        out["fresh"] = fresh
        out["warnings"] = [p for p in result["problems"] if p["severity"] in ("warning", "error")]
        out["anyway"] = bool(errors)
        bus.emit("package.built", {"id": pid, "sha256": digest, "bytes": size, "fresh": fresh, "version": record["version"]})
        return out

    def _kit_command(self, folder: Path, out_dir: Path) -> dict:
        script = paths.contract_dir() / "tools" / "formpkg.py"
        proc = subprocess.run([sys.executable, "-I", str(script), "build", str(folder), "-o", str(out_dir)], capture_output=True, text=True, timeout=120)
        if proc.returncode != 0:
            raise Refused((proc.stdout or proc.stderr or "the kit's formpkg refused the folder").strip().replace("\n  ", "; "))
        line = proc.stdout.strip().splitlines()[0]
        info = json.loads(line)
        return {"how": "kit command line", "command": f"python3 {script} build {folder}", "sha256": info["sha256"], "bytes": info["bytes"], "file": Path(info["file"])}

    def reproduce(self, pid: str) -> dict:
        folder = workspace.package_dir(pid)
        started = time.time()
        with tempfile.TemporaryDirectory(prefix="formext-repro-") as tmp:
            a_dir, b_dir = Path(tmp) / "engine", Path(tmp) / "kit"
            target, digest, size, manifest = _kit_build(folder, a_dir)
            runs = [{"how": "engine (formpkg.build)", "sha256": digest, "bytes": size, "file": target}]
            if getattr(sys, "frozen", False):
                t2, d2, s2, _ = _kit_build(folder, b_dir)
                runs.append({"how": "engine, second run", "sha256": d2, "bytes": s2, "file": t2})
            else:
                runs.append(self._kit_command(folder, b_dir))
            same = all(r["sha256"] == digest and r["bytes"] == size for r in runs)
            differences: list[dict] = []
            if not same:
                left = {e["path"]: e for e in _entries(runs[0]["file"])}
                right = {e["path"]: e for e in _entries(runs[1]["file"])}
                for name in sorted(set(left) | set(right)):
                    if left.get(name, {}).get("sha256") != right.get(name, {}).get("sha256"):
                        differences.append({"path": name, "first": left.get(name, {}).get("sha256"), "second": right.get(name, {}).get("sha256")})
                if not differences:
                    differences.append({"path": "(zip headers)", "first": digest, "second": runs[1]["sha256"]})
            entries = _entries(target)
        builds = [b for b in self.list(pid) if b["version"] == manifest["version"]]
        stored = next((b for b in builds if b["sha256"] == digest), None)
        latest = builds[0] if builds else None
        out = {
            "project": pid,
            "reproducible": same,
            "sha256": digest,
            "bytes": size,
            "version": manifest["version"],
            "runs": [{k: v for k, v in r.items() if k != "file"} for r in runs],
            "differences": differences,
            "entries": entries,
            "matches_build": stored["sha256"] if stored else None,
            "latest_build": latest["sha256"] if latest else None,
            "source_changed": bool(latest and latest["sha256"] != digest),
            "checked_at": started,
            "ms": round((time.time() - started) * 1000),
        }
        if stored:
            with self._lock:
                bfolder = self._dir(pid, digest)
                record = self._read(bfolder)
                record["reproduced_at"] = started
                self._write(bfolder, record)
        bus.emit("package.reproduced", {"id": pid, "reproducible": same, "sha256": digest})
        return out

    def remove(self, pid: str, sha: str) -> dict:
        with self._lock:
            folder = self._dir(pid, sha)
            shutil.rmtree(folder)
        bus.emit("package.removed", {"id": pid, "sha256": sha})
        return {"project": pid, "sha256": sha, "removed": True}

    def sign(self, pid: str, sha: str, kid: str, passphrase: str = "") -> dict:
        target = self.file(pid, sha)
        body = target.read_bytes()
        if _sha(body) != sha:
            raise Refused("the package file no longer matches its SHA-256; build it again")
        block = keys.sign(kid, body, passphrase)
        publisher = keys.export(kid)["publisher"]
        signed_by = check_signature(target, block, [publisher])
        with self._lock:
            folder = self._dir(pid, sha)
            record = self._read(folder)
            sigs = [s for s in record.get("signatures", []) if s.get("publisher") != block["publisher"]]
            sigs.append({**block, "signed_at": time.time(), "fingerprint": keys.get(kid)["fingerprint"]})
            record["signatures"] = sigs
            self._write(folder, record)
        bus.emit("package.signed", {"id": pid, "sha256": sha, "publisher": signed_by})
        return {"project": pid, "sha256": sha, "signature": block, "publisher": publisher, "verified": True, "entry": self.entry(pid, sha, publisher=kid)["entry"]}

    def _publishers(self, record: dict, extra: list[dict] | None = None) -> list[dict]:
        found: list[dict] = list(extra or [])
        for s in record.get("signatures", []):
            if any(p.get("id") == s.get("publisher") for p in found):
                continue
            try:
                found.append(keys.export(s["publisher"])["publisher"])
            except WorkspaceError:
                continue
        return found

    def verify(self, pid: str, sha: str, publishers: list[dict] | None = None) -> dict:
        target = self.file(pid, sha)
        record = self._read(self._dir(pid, sha))
        listed = self._publishers(record, publishers)
        results = []
        for s in record.get("signatures", []):
            block = {"publisher": s.get("publisher"), "algorithm": s.get("algorithm"), "value": s.get("value")}
            try:
                results.append({"publisher": check_signature(target, block, listed), "ok": True, "reason": ""})
            except SignatureRefused as e:
                results.append({"publisher": s.get("publisher"), "ok": False, "reason": e.message})
        return {"project": pid, "sha256": sha, "signed": bool(results), "ok": bool(results) and all(r["ok"] for r in results), "results": results}

    def entry(self, pid: str, sha: str, url: str = "", publisher: str = "") -> dict:
        record = self._read(self._dir(pid, sha))
        manifest = record["manifest"]
        address = (url or "").strip() or DEFAULT_URL.format(id=manifest["id"], version=manifest["version"])
        if not address.startswith("https://"):
            raise WorkspaceError("The package address in the index must start with https://.")
        entry = formpkg.entry(manifest, address, record["sha256"], record["bytes"])
        sigs = record.get("signatures", [])
        chosen = next((s for s in sigs if s.get("publisher") == publisher), None) if publisher else (sigs[-1] if sigs else None)
        if publisher and chosen is None:
            raise NotFound(f"this build is not signed by {publisher}")
        publishers: list[dict] = []
        if chosen:
            entry["signature"] = {"publisher": chosen["publisher"], "algorithm": chosen["algorithm"], "value": chosen["value"]}
            try:
                publishers.append(keys.export(chosen["publisher"])["publisher"])
            except WorkspaceError:
                pass
        return {"project": pid, "sha256": record["sha256"], "entry": entry, "publishers": publishers, "url_default": not (url or "").strip()}


packages = Packages()
