from __future__ import annotations

import hashlib
import json
import os
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from app.services import paths, settings
from app.services.keys import SignatureRefused, check_signature, fingerprint, unb64, verify
from app.services.workspace import NotFound, WorkspaceError

REPO = "nodemode-dev/form.ext-registry"
RELEASES = f"https://github.com/{REPO}/releases/download/"
DEFAULT_URL = RELEASES + "index/extensions.json"
SOURCE_URL = f"https://github.com/{REPO}/tree/main/extensions/{{id}}"
KEYS_FILE = Path(__file__).resolve().parents[1] / "registry_keys.txt"
MAX_INDEX = 8 * 1024 * 1024
MAX_PACKAGE = 20 * 1024 * 1024
TIMEOUT = 20
FRESH = 300

PERMISSION_WORDS = {
    "document": "Read and change the open document",
    "files-read": "Open files you choose",
    "files-write": "Save files where you choose",
    "network": "Reach the internet",
    "models": "Use local models",
    "native-code": "Run native code",
}


class RegistryError(WorkspaceError):
    status = 502

    def __init__(self, message: str, problem: str, status: int | None = None) -> None:
        super().__init__(message)
        self.problem = problem
        if status is not None:
            self.status = status


def index_url() -> str:
    env = os.environ.get("FORMEXT_REGISTRY_URL", "").strip()
    if env:
        return env
    configured = settings.value("registry.url")
    return configured.strip() if isinstance(configured, str) and configured.strip() else DEFAULT_URL


def url_source() -> str:
    if os.environ.get("FORMEXT_REGISTRY_URL", "").strip():
        return "FORMEXT_REGISTRY_URL"
    configured = settings.value("registry.url")
    if isinstance(configured, str) and configured.strip() and configured.strip() != DEFAULT_URL:
        return "setting registry.url"
    return "default"


def compiled_keys() -> list[str]:
    try:
        text = KEYS_FILE.read_text(encoding="utf-8")
    except OSError:
        return []
    return [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]


def trusted_keys() -> list[str]:
    extra = [k.strip() for k in os.environ.get("FORMEXT_REGISTRY_PUBKEY", "").split(",") if k.strip()]
    out: list[str] = []
    for key in compiled_keys() + extra:
        raw = unb64(key)
        if raw is not None and len(raw) == 32 and key not in out:
            out.append(key)
    return out


def developer() -> bool:
    return settings.value("registry.developer") is True


def _token(url: str) -> str:
    host = urllib.parse.urlsplit(url).hostname or ""
    if host == "github.com" or host.endswith(".github.com") or host.endswith("githubusercontent.com"):
        return os.environ.get("FORMEXT_GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""
    return ""


def _sibling(url: str, name: str) -> str:
    return urllib.parse.urljoin(url, name)


def fetch(url: str, limit: int, what: str) -> bytes:
    parts = urllib.parse.urlsplit(url)
    if parts.scheme == "file":
        target = Path(urllib.parse.unquote(parts.path))
        try:
            if target.stat().st_size > limit:
                raise RegistryError(f"{what} at {url} is larger than {limit} bytes", "too-large", 422)
            return target.read_bytes()
        except FileNotFoundError:
            raise RegistryError(f"The registry has no {what} at {url}.", "missing", 404) from None
        except OSError as e:
            raise RegistryError(f"The registry is unreachable: {what} at {url} cannot be read ({e.strerror or e}).", "unreachable") from None
    if parts.scheme not in ("https", "http"):
        raise RegistryError(f"The registry address must start with https:// (it is {url}).", "address", 400)
    headers = {"User-Agent": "formext", "Accept": "application/octet-stream, application/json"}
    token = _token(url)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            body = res.read(limit + 1)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403, 404):
            hint = "" if token else " Set GITHUB_TOKEN to a token that can read it, or wait until the registry is public."
            raise RegistryError(
                f"The registry refused {what} ({e.code} from {parts.hostname}). {REPO} is private while it is tested, so its downloads need a GitHub token, or nothing is published at {url} yet.{hint}",
                "private",
            ) from None
        raise RegistryError(f"The registry answered {e.code} for {what} at {url}.", "unreachable") from None
    except (urllib.error.URLError, OSError, ValueError) as e:
        reason = getattr(e, "reason", e)
        raise RegistryError(f"The registry is unreachable: {what} could not be downloaded from {url} ({reason}).", "unreachable") from None
    if len(body) > limit:
        raise RegistryError(f"{what} at {url} is larger than {limit} bytes", "too-large", 422)
    return body


def mirrored(url: str, index: str) -> str:
    if index == DEFAULT_URL or not url.startswith(RELEASES):
        return url
    return urllib.parse.urljoin(index, "../" + url[len(RELEASES):])


def _cache_dir() -> Path:
    return paths.sub("registry")


def _check_index(body: bytes, sig: bytes | None, keys: list[str]) -> dict:
    if not keys:
        if developer():
            return {"verified": False, "key": None, "note": "this build trusts no registry key yet; the developer setting registry.developer reads the index without checking its signature"}
        raise RegistryError("Not read: this build trusts no registry key yet. The registry's public key goes in backend/app/registry_keys.txt (or FORMEXT_REGISTRY_PUBKEY for testing).", "no-key", 409)
    if sig is None:
        raise RegistryError("Not read: the registry index has no extensions.json.sig beside it, so it cannot be verified.", "signature", 422)
    text = sig.decode("ascii", "replace").strip()
    for key in keys:
        try:
            verify(body, text, [key])
            return {"verified": True, "key": fingerprint(key), "note": ""}
        except SignatureRefused:
            continue
    raise RegistryError("Not read: signature mismatch. extensions.json.sig does not match the registry index with any key this build trusts, so the index was changed or signed with another key.", "signature", 422)


class Registry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hit: dict | None = None

    def _download(self, url: str) -> tuple[bytes, bytes | None]:
        body = fetch(url, MAX_INDEX, "the index")
        try:
            sig = fetch(url + ".sig", 4096, "the index signature")
        except RegistryError as e:
            if e.problem not in ("missing", "private"):
                raise
            sig = None
        return body, sig

    def _keep(self, url: str, body: bytes, sig: bytes | None) -> None:
        folder = _cache_dir()
        record = {"url": url, "fetched_at": time.time(), "sha256": hashlib.sha256(body).hexdigest()}
        (folder / ".extensions.json.tmp").write_bytes(body)
        os.replace(folder / ".extensions.json.tmp", folder / "extensions.json")
        if sig is not None:
            (folder / ".extensions.json.sig.tmp").write_bytes(sig)
            os.replace(folder / ".extensions.json.sig.tmp", folder / "extensions.json.sig")
        else:
            (folder / "extensions.json.sig").unlink(missing_ok=True)
        (folder / "kept.json").write_text(json.dumps(record, indent=2), encoding="utf-8")

    def _kept(self, url: str) -> tuple[bytes, bytes | None, float] | None:
        folder = _cache_dir()
        try:
            record = json.loads((folder / "kept.json").read_text(encoding="utf-8"))
            if record.get("url") != url:
                return None
            body = (folder / "extensions.json").read_bytes()
        except (OSError, ValueError):
            return None
        sig_file = folder / "extensions.json.sig"
        return body, sig_file.read_bytes() if sig_file.is_file() else None, float(record.get("fetched_at") or 0)

    def load(self, refresh: bool = False) -> dict:
        url = index_url()
        keys = trusted_keys()
        with self._lock:
            hit = self._hit
            if hit and not refresh and hit["url"] == url and hit["keys"] == keys and time.time() - hit["at"] < FRESH:
                return hit["index"]
        if not keys and not developer():
            _check_index(b"", None, keys)
        offline = None
        try:
            body, sig = self._download(url)
            fetched = time.time()
        except RegistryError as e:
            if e.problem != "unreachable":
                raise
            kept = self._kept(url)
            if kept is None:
                raise
            body, sig, fetched = kept
            offline = e.message
        trust = _check_index(body, sig, keys)
        try:
            data = json.loads(body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as e:
            raise RegistryError(f"Not read: the registry index is not valid JSON ({e}).", "format", 422) from None
        if not isinstance(data, dict) or data.get("format") != "formai-extensions":
            raise RegistryError("Not read: the file at the registry address is not a formai-extensions index.", "format", 422)
        if offline is None:
            self._keep(url, body, sig)
        index = {
            "url": url,
            "url_source": url_source(),
            "sha256": hashlib.sha256(body).hexdigest(),
            "fetched_at": fetched,
            "offline": offline,
            "verified": trust["verified"],
            "key": trust["key"],
            "note": trust["note"],
            "keys": len(keys),
            "data": data,
        }
        with self._lock:
            self._hit = {"url": url, "keys": keys, "at": time.time(), "index": index}
        return index

    @staticmethod
    def _entries(data: dict) -> list[dict]:
        listed = data.get("extensions")
        if not isinstance(listed, list):
            listed = data.get("packages")
        return [e for e in listed or [] if isinstance(e, dict) and isinstance(e.get("id"), str)]

    def _entry(self, eid: str, refresh: bool = False) -> tuple[dict, dict]:
        index = self.load(refresh)
        found = [e for e in self._entries(index["data"]) if e.get("id") == eid]
        if not found:
            raise NotFound(f"the registry index lists no extension {eid}")
        found.sort(key=lambda e: _version_key(e.get("version")), reverse=True)
        return index, found[0]

    def shelf(self, refresh: bool = False, imported: dict[str, list[str]] | None = None) -> dict:
        index = self.load(refresh)
        data = index["data"]
        newest: dict[str, dict] = {}
        for e in self._entries(data):
            if e["id"] not in newest or _version_key(e.get("version")) > _version_key(newest[e["id"]].get("version")):
                newest[e["id"]] = e
        rows = []
        for e in newest.values():
            perms = [p for p in e.get("permissions") or [] if isinstance(p, str)]
            sig = e.get("signature") if isinstance(e.get("signature"), dict) else None
            rows.append({
                "id": e["id"],
                "name": e.get("name") or e["id"],
                "product": e.get("product") or "",
                "version": e.get("version"),
                "kind": e.get("kind"),
                "author": e.get("author") or "",
                "licence": e.get("licence") or "",
                "description": e.get("description") or "",
                "permissions": [{"id": p, "words": PERMISSION_WORDS.get(p, p)} for p in perms],
                "verified": bool(e.get("verified")) and index["verified"],
                "listed_verified": bool(e.get("verified")),
                "source": e.get("source") if isinstance(e.get("source"), str) and e["source"].startswith("https://") else SOURCE_URL.format(id=e["id"]),
                "registry_commit": e.get("registry_commit"),
                "url": e.get("url"),
                "sha256": e.get("sha256"),
                "bytes": e.get("bytes"),
                "signed_by": sig.get("publisher") if sig else None,
                "imported": (imported or {}).get(str(e.get("sha256")), []),
            })
        rows.sort(key=lambda r: (str(r["product"]), str(r["name"]).lower()))
        commits = sorted({r["registry_commit"] for r in rows if isinstance(r.get("registry_commit"), str)})
        return {
            "url": index["url"],
            "url_source": index["url_source"],
            "name": data.get("name") or "",
            "verified": index["verified"],
            "key": index["key"],
            "keys": index["keys"],
            "note": index["note"],
            "offline": index["offline"],
            "fetched_at": index["fetched_at"],
            "sha256": index["sha256"],
            "registry_commit": commits[0] if len(commits) == 1 else None,
            "publishers": [{"id": p.get("id"), "name": p.get("name")} for p in data.get("publishers") or [] if isinstance(p, dict)],
            "extensions": rows,
        }

    def package(self, eid: str) -> tuple[bytes, dict, dict]:
        index, entry = self._entry(eid)
        url = str(entry.get("url") or "")
        digest = str(entry.get("sha256") or "")
        if not url.startswith(("https://", "http://", "file://")) or len(digest) != 64:
            raise RegistryError(f"The registry entry of {eid} has no usable package address or SHA-256.", "format", 422)
        url = mirrored(url, index["url"])
        cached = _cache_dir() / "packages" / f"{digest}.formpkg"
        body = cached.read_bytes() if cached.is_file() else fetch(url, MAX_PACKAGE, f"the package of {eid}")
        if hashlib.sha256(body).hexdigest() != digest:
            cached.unlink(missing_ok=True)
            raise RegistryError(f"Not imported: the package downloaded for {eid} does not match the SHA-256 the signed index gives, so it was changed on the way or on the server.", "sha256", 422)
        if isinstance(entry.get("bytes"), int) and entry["bytes"] != len(body):
            raise RegistryError(f"Not imported: the package of {eid} is {len(body)} bytes, the index says {entry['bytes']}.", "sha256", 422)
        signer = self._publisher_check(eid, body, entry, index["data"])
        if not cached.is_file():
            cached.parent.mkdir(parents=True, exist_ok=True)
            tmp = cached.with_name(f".{cached.name}.tmp")
            tmp.write_bytes(body)
            os.replace(tmp, cached)
        source = {
            "kind": "registry",
            "id": eid,
            "version": entry.get("version"),
            "sha256": digest,
            "url": url,
            "index": index["url"],
            "repo": entry.get("source") or SOURCE_URL.format(id=eid),
            "repo_name": f"{REPO}/extensions/{eid}",
            "signed_by": signer,
            "index_verified": index["verified"],
        }
        return body, entry, source

    def _publisher_check(self, eid: str, body: bytes, entry: dict, data: dict) -> str | None:
        sig = entry.get("signature")
        if not isinstance(sig, dict):
            if developer():
                return None
            raise RegistryError(f"Not imported: the registry entry of {eid} carries no publisher signature, and registry packages must be signed.", "signature", 422)
        publishers = [p for p in data.get("publishers") or [] if isinstance(p, dict)]
        with tempfile.TemporaryDirectory(prefix="formext-registry-") as tmp:
            target = Path(tmp) / "package.formpkg"
            target.write_bytes(body)
            try:
                return check_signature(target, sig, publishers)
            except SignatureRefused as e:
                raise RegistryError(f"Not imported: signature mismatch, {e.message}.", "signature", 422) from None


def _version_key(version) -> tuple[int, ...]:
    try:
        return tuple(int(p) for p in str(version).split("."))
    except ValueError:
        return (0,)


registry = Registry()
