from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
import re
import threading
import time
from pathlib import Path

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from app.services import paths
from app.services.bus import bus
from app.services.workspace import Conflict, NotFound, WorkspaceError

PUBLISHER_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,38}\Z")
FORMAT = "formext-publisher-key"
ALGORITHM = "ed25519"
MIN_PASSPHRASE = 8


class Locked(WorkspaceError):
    status = 401


class SignatureRefused(WorkspaceError):
    status = 422


def b64(data: bytes) -> str:
    return base64.standard_b64encode(data).decode("ascii")


def unb64(text: str) -> bytes | None:
    try:
        return base64.b64decode(text.strip(), validate=True)
    except (binascii.Error, ValueError, AttributeError):
        return None


def fingerprint(public_key: str) -> str:
    raw = unb64(public_key) or b""
    digest = hashlib.sha256(raw).hexdigest()[:20]
    return " ".join(digest[i:i + 4] for i in range(0, 20, 4))


def verify(body: bytes, signature: str, keys: list[str]) -> None:
    if not keys:
        raise SignatureRefused("this build trusts no catalogue key yet")
    raw = unb64(signature)
    if raw is None:
        raise SignatureRefused("its signature is not valid base64")
    if len(raw) != 64:
        raise SignatureRefused("its signature is not 64 bytes")
    for key in keys:
        data = unb64(key)
        if data is None or len(data) != 32:
            continue
        try:
            Ed25519PublicKey.from_public_bytes(data).verify(raw, body)
            return
        except (InvalidSignature, ValueError):
            continue
    raise SignatureRefused("its signature does not match a key this build trusts")


def check_signature(package: Path, signature: dict, publishers: list[dict]) -> str:
    publisher = next((p for p in publishers if p.get("id") == signature.get("publisher")), None)
    if publisher is None:
        raise SignatureRefused(f"the package names a publisher, {json.dumps(signature.get('publisher'))}, that the index does not list")
    if signature.get("algorithm") != ALGORITHM:
        raise SignatureRefused(f"the package's signature uses {json.dumps(signature.get('algorithm'))}, not ed25519")
    try:
        verify(Path(package).read_bytes(), str(signature.get("value", "")), [str(publisher.get("public_key", ""))])
    except SignatureRefused:
        raise SignatureRefused(f"the package's signature does not match {publisher.get('name')}'s key") from None
    return str(publisher["id"])


class Keys:
    def __init__(self) -> None:
        self._lock = threading.Lock()

    def _dir(self) -> Path:
        folder = paths.keys_dir()
        try:
            os.chmod(folder, 0o700)
        except OSError:
            pass
        return folder

    def _file(self, kid: str) -> Path:
        if not isinstance(kid, str) or not PUBLISHER_RE.match(kid):
            raise NotFound("no such publisher key")
        return self._dir() / f"{kid}.json"

    def _load(self, kid: str) -> dict:
        target = self._file(kid)
        try:
            data = json.loads(target.read_text(encoding="utf-8"))
        except FileNotFoundError:
            raise NotFound(f"no publisher key {kid}") from None
        except (OSError, ValueError) as e:
            raise WorkspaceError(f"the key file of {kid} cannot be read: {e}") from None
        if not isinstance(data, dict) or data.get("format") != FORMAT:
            raise WorkspaceError(f"the key file of {kid} is not a form.ext publisher key")
        return data

    def _save(self, data: dict) -> None:
        target = self._file(data["id"])
        tmp = target.with_name(f".{target.name}.tmp")
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(data, indent=2))
        os.replace(tmp, target)

    @staticmethod
    def public(data: dict) -> dict:
        return {
            "id": data["id"],
            "name": data["name"],
            "url": data.get("url") or "",
            "algorithm": ALGORITHM,
            "public_key": data["public_key"],
            "fingerprint": fingerprint(data["public_key"]),
            "encrypted": bool(data.get("encrypted")),
            "created": data.get("created", 0),
        }

    @staticmethod
    def publisher(data: dict) -> dict:
        out = {"id": data["id"], "name": data["name"], "public_key": data["public_key"]}
        if data.get("url"):
            out["url"] = data["url"]
        return out

    def list(self) -> list[dict]:
        out = []
        for f in sorted(self._dir().glob("*.json")):
            if f.name.startswith("."):
                continue
            try:
                out.append(self.public(self._load(f.stem)))
            except WorkspaceError:
                continue
        out.sort(key=lambda k: k["created"])
        return out

    def get(self, kid: str) -> dict:
        return self.public(self._load(kid))

    def export(self, kid: str) -> dict:
        data = self._load(kid)
        return {"publisher": self.publisher(data), "fingerprint": fingerprint(data["public_key"]), "algorithm": ALGORITHM}

    def create(self, kid: str, name: str, url: str = "", passphrase: str = "") -> dict:
        kid = (kid or "").strip()
        name = (name or "").strip()
        url = (url or "").strip()
        if not PUBLISHER_RE.match(kid):
            raise WorkspaceError("A publisher id is 2 to 39 lower-case letters, digits and hyphens, starting with a letter or digit.")
        if not name:
            raise WorkspaceError("Give the publisher a name; FormPortal shows it beside the package.")
        if url and not url.startswith("https://"):
            raise WorkspaceError("The publisher address must start with https://.")
        if passphrase and len(passphrase) < MIN_PASSPHRASE:
            raise WorkspaceError(f"A passphrase needs at least {MIN_PASSPHRASE} characters, or leave it empty.")
        with self._lock:
            if self._file(kid).exists():
                raise Conflict(f"a publisher key {kid} already exists")
            private = Ed25519PrivateKey.generate()
            raw_public = private.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
            encryption = serialization.BestAvailableEncryption(passphrase.encode("utf-8")) if passphrase else serialization.NoEncryption()
            pem = private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, encryption).decode("ascii")
            data = {
                "format": FORMAT,
                "format_version": 1,
                "id": kid,
                "name": name,
                "url": url,
                "algorithm": ALGORITHM,
                "public_key": b64(raw_public),
                "private_key": pem,
                "encrypted": bool(passphrase),
                "created": time.time(),
            }
            self._save(data)
        out = self.public(data)
        bus.emit("keys.changed", {"id": kid, "kind": "created"})
        return out

    def remove(self, kid: str) -> dict:
        with self._lock:
            target = self._file(kid)
            if not target.exists():
                raise NotFound(f"no publisher key {kid}")
            kept = paths.trash_dir() / f"key-{kid}-{int(time.time())}.json"
            os.replace(target, kept)
            try:
                os.chmod(kept, 0o600)
            except OSError:
                pass
        bus.emit("keys.changed", {"id": kid, "kind": "removed"})
        return {"id": kid, "removed": True, "kept": str(kept)}

    def _private(self, data: dict, passphrase: str) -> Ed25519PrivateKey:
        password = passphrase.encode("utf-8") if data.get("encrypted") else None
        if data.get("encrypted") and not passphrase:
            raise Locked(f"the key {data['id']} is protected: give its passphrase")
        try:
            key = serialization.load_pem_private_key(data["private_key"].encode("ascii"), password=password)
        except (ValueError, TypeError):
            raise Locked(f"the passphrase does not open the key {data['id']}") from None
        if not isinstance(key, Ed25519PrivateKey):
            raise WorkspaceError(f"the key {data['id']} is not an Ed25519 key")
        return key

    def sign(self, kid: str, body: bytes, passphrase: str = "") -> dict:
        data = self._load(kid)
        key = self._private(data, passphrase or "")
        value = b64(key.sign(body))
        verify(body, value, [data["public_key"]])
        return {"publisher": data["id"], "algorithm": ALGORITHM, "value": value}


keys = Keys()
