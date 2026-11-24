import hashlib
import hmac
import json

import keyring
import pytest
from keyring.backend import KeyringBackend

from app.services import seal, settings, window_key

SEALED = ("formportal_root", "formportal_cli", "agent_access")


class MemoryKeyring(KeyringBackend):
    priority = 1

    def __init__(self):
        super().__init__()
        self.store = {}

    def get_password(self, service, username):
        return self.store.get((service, username))

    def set_password(self, service, username, password):
        self.store[(service, username)] = password

    def delete_password(self, service, username):
        self.store.pop((service, username), None)


@pytest.fixture
def vault(home):
    before = keyring.get_keyring()
    memory = MemoryKeyring()
    keyring.set_keyring(memory)
    seal.reset()
    yield memory
    keyring.set_keyring(before)
    seal.reset()


@pytest.fixture
def no_vault(home):
    from keyring.backends import fail
    before = keyring.get_keyring()
    keyring.set_keyring(fail.Keyring())
    seal.reset()
    yield
    keyring.set_keyring(before)
    seal.reset()


def _stored(home):
    return json.loads((home / "settings.json").read_text(encoding="utf-8"))


def _rewrite(home, **changes):
    data = _stored(home)
    data.update(changes)
    (home / "settings.json").write_text(json.dumps(data), encoding="utf-8")


def test_settings_written_by_the_window_are_sealed(client, vault, tmp_path):
    reply = client.put("/api/settings", json={"formportal_root": str(tmp_path)})
    assert reply.json()["seal"] == "ok"
    assert reply.json()["sealBroken"] is False
    assert client.get("/api/settings").json()["formportal_root"] == str(tmp_path)


def test_the_seal_on_disk_is_an_hmac_sha256_of_the_sealed_fields_with_the_vault_key(client, vault, home, tmp_path):
    client.put("/api/settings", json={"formportal_root": str(tmp_path)})
    key = bytes.fromhex(vault.store[("form.ext", "settings-seal")])
    stored = {**settings.DEFAULTS, **_stored(home)}
    body = json.dumps({k: stored.get(k) for k in SEALED}, sort_keys=True, separators=(",", ":"))
    assert stored["seal"] == hmac.new(key, body.encode("utf-8"), hashlib.sha256).hexdigest()


def test_the_seal_value_itself_is_never_returned(client, vault, home, tmp_path):
    client.put("/api/settings", json={"formportal_root": str(tmp_path)})
    mark = _stored(home)["seal"]
    assert mark not in client.get("/api/settings").text
    assert vault.store[("form.ext", "settings-seal")] not in client.get("/api/settings").text


def test_a_hand_edited_portal_folder_breaks_the_seal_and_is_dropped(client, vault, home, tmp_path):
    client.put("/api/settings", json={"formportal_root": str(tmp_path)})
    _rewrite(home, formportal_root="/somewhere/else")
    got = client.get("/api/settings").json()
    assert got["seal"] == "broken"
    assert got["sealBroken"] is True
    assert got["formportal_root"] == ""
    assert got["agentAccessReset"] is False


def test_a_hand_edited_agent_access_breaks_the_seal_and_reports_the_reset(client, vault, home):
    client.put("/api/settings", json={"agent_access": "blocked"})
    _rewrite(home, agent_access="allowed")
    got = client.get("/api/settings").json()
    assert got["seal"] == "broken"
    assert got["agent_access"] == ""
    assert got["agentAccessReset"] is True


def test_a_removed_seal_on_loosened_settings_counts_as_broken(client, vault, home, tmp_path):
    client.put("/api/settings", json={"formportal_cli": str(tmp_path / "cli")})
    data = _stored(home)
    data.pop("seal")
    (home / "settings.json").write_text(json.dumps(data), encoding="utf-8")
    got = client.get("/api/settings").json()
    assert got["seal"] == "broken"
    assert got["formportal_cli"] == ""


def test_a_forged_seal_made_with_another_key_is_broken(client, vault, home, tmp_path):
    client.put("/api/settings", json={"formportal_root": str(tmp_path)})
    stored = _stored(home)
    stored["formportal_root"] = "/forged"
    stored["seal"] = seal.digest(stored, b"\x00" * 32)
    (home / "settings.json").write_text(json.dumps(stored), encoding="utf-8")
    assert client.get("/api/settings").json()["seal"] == "broken"


def test_the_portal_root_does_not_follow_a_tampered_setting(client, vault, home, tmp_path, monkeypatch):
    monkeypatch.delenv("FORMPORTAL_ROOT", raising=False)
    client.put("/api/settings", json={"formportal_root": str(tmp_path)})
    assert client.get("/api/runapp/root").json() == {"path": str(tmp_path), "source": "settings", "exists": True}
    _rewrite(home, formportal_root=str(home))
    root = client.get("/api/runapp/root").json()
    assert root["source"] == "default"
    assert root["path"] != str(home)


def test_editing_unsealed_fields_by_hand_keeps_the_seal(client, vault, home, tmp_path):
    client.put("/api/settings", json={"formportal_root": str(tmp_path)})
    _rewrite(home, theme="something")
    assert client.get("/api/settings").json()["seal"] == "ok"


def test_settings_that_loosen_nothing_report_unsealed_not_broken(client, vault):
    got = client.get("/api/settings").json()
    assert got["seal"] == "unsealed"
    assert got["sealBroken"] is False


def test_the_window_can_reseal_after_a_break_and_keeps_only_what_it_sends(client, vault, home, tmp_path):
    client.put("/api/settings", json={"formportal_root": str(tmp_path), "formportal_cli": "/bin/true"})
    _rewrite(home, formportal_root="/elsewhere")
    again = client.put("/api/settings", json={"formportal_root": str(tmp_path)}).json()
    assert again["seal"] == "ok"
    assert again["formportal_root"] == str(tmp_path)
    assert again["formportal_cli"] == ""


def test_without_a_system_vault_the_seal_is_reported_unavailable(client, no_vault, tmp_path):
    got = client.put("/api/settings", json={"formportal_root": str(tmp_path)}).json()
    assert got["seal"] == "unavailable"
    assert got["sealBroken"] is False
    assert got["formportal_root"] == str(tmp_path)


def test_a_client_cannot_set_the_seal_fields_through_the_body(client, vault, home):
    client.put("/api/settings", json={"seal": "f" * 64, "sealBroken": False, "agentAccessReset": True})
    stored = _stored(home)
    assert stored.get("seal") != "f" * 64
    assert "sealBroken" not in stored
    assert "agentAccessReset" not in stored


def test_a_settings_write_without_the_window_key_is_refused_and_changes_nothing(outsider, vault, home):
    reply = outsider.put("/api/settings", json={"agent_access": "allowed"})
    assert reply.status_code == 403
    assert reply.json() == {"detail": window_key.REFUSED}
    assert not (home / "settings.json").exists()


def test_an_unknown_agent_access_value_is_refused_with_its_reason(client, vault):
    reply = client.put("/api/settings", json={"agent_access": "always"})
    assert reply.status_code == 400
    assert reply.json()["detail"] == "agent_access is ask, allowed or blocked"
