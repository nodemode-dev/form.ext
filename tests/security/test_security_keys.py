import base64
import hashlib
import json
import os
import stat

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from app.services import keys as keys_module
from app.services.keys import SignatureRefused, keys

SECRET_MARKERS = ("private_key", "PRIVATE KEY", "passphrase")


def _key_file(home, kid):
    return home / "keys" / f"{kid}.json"


def _no_secret(text):
    for marker in SECRET_MARKERS:
        assert marker not in text


def _create(client, kid="acme", name="Acme Tools", **extra):
    reply = client.post("/api/keys", json={"id": kid, "name": name, **extra})
    assert reply.status_code == 200, reply.text
    return reply.json()


def test_creating_a_key_answers_without_the_private_half(client):
    reply = client.post("/api/keys", json={"id": "acme", "name": "Acme Tools"})
    _no_secret(reply.text)
    assert reply.json()["id"] == "acme"
    assert reply.json()["algorithm"] == "ed25519"


def test_the_private_half_is_stored_on_disk_readable_only_by_the_owner(client, home):
    _create(client)
    target = _key_file(home, "acme")
    stored = json.loads(target.read_text(encoding="utf-8"))
    assert "BEGIN PRIVATE KEY" in stored["private_key"]
    if os.name != "nt":
        assert stat.S_IMODE(target.stat().st_mode) == 0o600


def test_the_public_key_returned_matches_the_stored_private_key(client, home):
    made = _create(client)
    pem = json.loads(_key_file(home, "acme").read_text(encoding="utf-8"))["private_key"]
    private = serialization.load_pem_private_key(pem.encode("ascii"), password=None)
    raw = private.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    assert base64.b64decode(made["public_key"]) == raw
    assert len(raw) == 32


def test_the_fingerprint_is_the_first_twenty_hex_digits_of_the_public_key_hash_in_groups_of_four(client):
    made = _create(client)
    digest = hashlib.sha256(base64.b64decode(made["public_key"])).hexdigest()[:20]
    assert made["fingerprint"] == " ".join(digest[i:i + 4] for i in range(0, 20, 4))


@pytest.mark.parametrize("route", ["/api/keys", "/api/keys/acme", "/api/keys/acme/public"])
def test_no_read_route_returns_the_private_half(client, route):
    _create(client, passphrase="correct horse")
    reply = client.get(route)
    assert reply.status_code == 200
    _no_secret(reply.text)
    assert "acme" in reply.text


def test_a_passphrase_encrypts_the_stored_key_and_is_not_written_down(client, home):
    made = _create(client, passphrase="correct horse")
    assert made["encrypted"] is True
    text = _key_file(home, "acme").read_text(encoding="utf-8")
    assert "ENCRYPTED PRIVATE KEY" in text
    assert "correct horse" not in text
    pem = json.loads(text)["private_key"].encode("ascii")
    with pytest.raises(TypeError):
        serialization.load_pem_private_key(pem, password=None)


def test_a_short_passphrase_is_refused_with_its_reason(client, home):
    reply = client.post("/api/keys", json={"id": "acme", "name": "Acme", "passphrase": "short"})
    assert reply.status_code == 400
    assert reply.json()["detail"] == "A passphrase needs at least 8 characters, or leave it empty."
    assert not _key_file(home, "acme").exists()


@pytest.mark.parametrize("kid", ["A", "-lead", "UPPER", "has space", "a" * 40, "../up"])
def test_a_badly_formed_publisher_id_is_refused(client, kid):
    reply = client.post("/api/keys", json={"id": kid, "name": "X"})
    assert reply.status_code == 400
    assert reply.json()["detail"] == "A publisher id is 2 to 39 lower-case letters, digits and hyphens, starting with a letter or digit."


def test_a_publisher_address_that_is_not_https_is_refused(client):
    reply = client.post("/api/keys", json={"id": "acme", "name": "Acme", "url": "http://acme.example"})
    assert reply.status_code == 400
    assert reply.json()["detail"] == "The publisher address must start with https://."


def test_a_second_key_with_the_same_id_is_refused_and_the_first_survives(client):
    first = _create(client)
    again = client.post("/api/keys", json={"id": "acme", "name": "Other"})
    assert again.status_code == 409
    assert again.json()["detail"] == "a publisher key acme already exists"
    assert client.get("/api/keys/acme").json()["public_key"] == first["public_key"]


def test_a_key_id_that_climbs_out_of_the_folder_is_not_found(client):
    reply = client.get("/api/keys/..%2Fsettings")
    assert reply.status_code == 404


def test_removing_a_key_moves_it_to_the_trash_still_private(client, home):
    _create(client)
    reply = client.delete("/api/keys/acme")
    assert reply.status_code == 200
    kept = reply.json()["kept"]
    assert reply.json()["removed"] is True
    assert client.get("/api/keys").json() == {"keys": []}
    assert not _key_file(home, "acme").exists()
    assert "BEGIN PRIVATE KEY" in json.loads(open(kept, encoding="utf-8").read())["private_key"]
    if os.name != "nt":
        assert stat.S_IMODE(os.stat(kept).st_mode) == 0o600


def test_removing_a_missing_key_says_so(client):
    reply = client.delete("/api/keys/ghost")
    assert reply.status_code == 404
    assert reply.json()["detail"] == "no publisher key ghost"


def test_the_public_export_lists_what_a_registry_index_needs(client):
    made = _create(client, url="https://acme.example")
    out = client.get("/api/keys/acme/public").json()
    assert out["publisher"] == {"id": "acme", "name": "Acme Tools", "public_key": made["public_key"], "url": "https://acme.example"}
    assert out["fingerprint"] == made["fingerprint"]


def test_a_signature_made_by_a_key_verifies_with_an_independent_ed25519_reader(home):
    made = keys.create("acme", "Acme")
    body = b"package bytes"
    signed = keys.sign("acme", body)
    public = Ed25519PublicKey.from_public_bytes(base64.b64decode(made["public_key"]))
    public.verify(base64.b64decode(signed["value"]), body)
    assert signed["publisher"] == "acme"
    assert signed["algorithm"] == "ed25519"


def test_a_changed_body_no_longer_matches_its_signature(home):
    made = keys.create("acme", "Acme")
    signed = keys.sign("acme", b"package bytes")
    with pytest.raises(SignatureRefused) as caught:
        keys_module.verify(b"package bytez", signed["value"], [made["public_key"]])
    assert caught.value.message == "its signature does not match a key this build trusts"


def test_a_signature_with_one_flipped_bit_is_refused(home):
    made = keys.create("acme", "Acme")
    raw = bytearray(base64.b64decode(keys.sign("acme", b"body")["value"]))
    raw[10] ^= 1
    with pytest.raises(SignatureRefused) as caught:
        keys_module.verify(b"body", base64.b64encode(bytes(raw)).decode(), [made["public_key"]])
    assert caught.value.message == "its signature does not match a key this build trusts"


def test_a_signature_from_another_key_is_refused(home):
    keys.create("acme", "Acme")
    other = keys.create("rival", "Rival")
    value = keys.sign("acme", b"body")["value"]
    with pytest.raises(SignatureRefused):
        keys_module.verify(b"body", value, [other["public_key"]])


@pytest.mark.parametrize("value,said", [
    ("not base64 !!", "its signature is not valid base64"),
    (base64.b64encode(b"x" * 63).decode(), "its signature is not 64 bytes"),
])
def test_a_malformed_signature_is_refused_with_its_reason(home, value, said):
    made = keys.create("acme", "Acme")
    with pytest.raises(SignatureRefused) as caught:
        keys_module.verify(b"body", value, [made["public_key"]])
    assert caught.value.message == said


def test_verifying_with_no_trusted_key_is_refused():
    with pytest.raises(SignatureRefused) as caught:
        keys_module.verify(b"body", base64.b64encode(b"x" * 64).decode(), [])
    assert caught.value.message == "this build trusts no catalogue key yet"


def test_a_protected_key_will_not_sign_without_its_passphrase(home):
    keys.create("acme", "Acme", passphrase="correct horse")
    with pytest.raises(keys_module.Locked) as caught:
        keys.sign("acme", b"body")
    assert caught.value.message == "the key acme is protected: give its passphrase"
    assert caught.value.status == 401


def test_a_protected_key_will_not_sign_with_a_wrong_passphrase(home):
    keys.create("acme", "Acme", passphrase="correct horse")
    with pytest.raises(keys_module.Locked) as caught:
        keys.sign("acme", b"body", "wrong horse")
    assert caught.value.message == "the passphrase does not open the key acme"


def test_a_protected_key_signs_with_its_passphrase(home):
    made = keys.create("acme", "Acme", passphrase="correct horse")
    signed = keys.sign("acme", b"body", "correct horse")
    keys_module.verify(b"body", signed["value"], [made["public_key"]])


def test_a_package_signed_by_a_publisher_the_index_does_not_list_is_refused(home, tmp_path):
    made = keys.create("acme", "Acme")
    package = tmp_path / "x.formext"
    package.write_bytes(b"zip bytes")
    signature = keys.sign("acme", package.read_bytes())
    publishers = [{"id": "acme", "name": "Acme", "public_key": made["public_key"]}]
    assert keys_module.check_signature(package, signature, publishers) == "acme"
    with pytest.raises(SignatureRefused) as caught:
        keys_module.check_signature(package, {**signature, "publisher": "nobody"}, publishers)
    assert caught.value.message == 'the package names a publisher, "nobody", that the index does not list'
    package.write_bytes(b"zip bytez")
    with pytest.raises(SignatureRefused) as caught:
        keys_module.check_signature(package, signature, publishers)
    assert caught.value.message == "the package's signature does not match Acme's key"


def test_a_signature_naming_another_algorithm_is_refused(home, tmp_path):
    made = keys.create("acme", "Acme")
    package = tmp_path / "x.formext"
    package.write_bytes(b"zip")
    signature = {**keys.sign("acme", b"zip"), "algorithm": "rsa"}
    with pytest.raises(SignatureRefused) as caught:
        keys_module.check_signature(package, signature, [{"id": "acme", "name": "Acme", "public_key": made["public_key"]}])
    assert caught.value.message == 'the package\'s signature uses "rsa", not ed25519'


def test_a_key_file_edited_to_another_format_is_left_out_of_the_list(client, home):
    _create(client)
    _create(client, kid="other", name="Other")
    target = _key_file(home, "other")
    data = json.loads(target.read_text(encoding="utf-8"))
    target.write_text(json.dumps({**data, "format": "something-else"}), encoding="utf-8")
    assert [k["id"] for k in client.get("/api/keys").json()["keys"]] == ["acme"]
