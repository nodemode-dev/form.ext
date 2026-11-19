#!/usr/bin/env python3
"""setup/hosts.py: the Form apps that load form.ext extensions, from the family spec.

  --family PATH           write setup/hosts.json and .claude/skills/HOSTS.md from the spec's public apps that host
                          extensions; when either changed, also copy the spec to setup/family.spec.json
  --family PATH --check   write nothing; exit 0 when both files are what this would write, 1 naming each file that
                          differs, 2 when the spec or the side file cannot be read

Which apps are hosts and their host API come from an app's manifest.extensions in the spec when the spec carries it,
otherwise from the hand-kept side file setup/hosts.side.json, which also records the host skills copied into
.claude/skills and their commits. Names, ids, repositories, licences and MCP come from the spec. Private apps are left
out. Standard library only, no network; run as python3 -I setup/hosts.py.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SIDE = ROOT / "setup" / "hosts.side.json"
SPEC_COPY = ROOT / "setup" / "family.spec.json"
HOSTS_JSON = ROOT / "setup" / "hosts.json"
HOSTS_MD = ROOT / ".claude" / "skills" / "HOSTS.md"


class Unreadable(Exception):
    pass


def _load(path: Path, what: str) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as err:
        raise Unreadable(f"{what} {path}: {err}") from None
    if not isinstance(data, dict):
        raise Unreadable(f"{what} {path}: not a JSON object")
    return data


def read_spec(path: Path) -> dict:
    spec = _load(path, "family spec")
    if spec.get("format") != "formai-family" or spec.get("format_version") != 1 or not isinstance(spec.get("apps"), list):
        raise Unreadable(f"family spec {path}: not formai-family version 1 with an apps list")
    for app in spec["apps"]:
        if not isinstance(app, dict) or not isinstance(app.get("id"), str):
            raise Unreadable(f"family spec {path}: an app without an id")
        if app.get("public") is True and not all(isinstance(app.get(k), str) for k in ("name", "repo", "repository", "licence")):
            raise Unreadable(f"family spec {path}: public app {app['id']} lacks name, repo, repository or licence")
    return spec


def read_side(path: Path) -> dict:
    side = _load(path, "side file")
    apps = side.get("apps")
    if not isinstance(apps, dict) or not all(isinstance(v, dict) and isinstance(v.get("skills", {}), dict) for v in apps.values()):
        raise Unreadable(f"side file {path}: apps must map ids to objects with a skills object")
    return apps


def build(spec: dict, side: dict) -> tuple[dict, list[str]]:
    hosts, family, said = [], [], []
    from_side, from_spec, left_out = [], [], []
    public = {a["id"]: a for a in spec["apps"] if a.get("public") is True}
    for sid in sorted(side):
        if sid not in public:
            left_out.append(sid)
    for app in sorted(public.values(), key=lambda a: a["id"]):
        sid, mine = app["id"], side.get(app["id"])
        manifest = app.get("manifest")
        if isinstance(manifest, dict) and "extensions" in manifest:
            ext = manifest["extensions"]
            host_api = ext.get("host_api") if isinstance(ext, dict) else None
            source = "spec"
        elif mine is not None:
            host_api = mine.get("host_api")
            source = "side"
        else:
            continue
        entry = {
            "id": sid,
            "app": app.get("app"),
            "name": app["name"],
            "repo": app["repo"],
            "repository": app["repository"],
            "licence": app["licence"],
            "mcp": bool((app.get("agents") or {}).get("mcp")),
            "host_api": host_api,
            "host_api_from": source,
            "role": (mine or {}).get("role"),
            "note": (mine or {}).get("note"),
            "skills": [{"name": k, "commit": v} for k, v in sorted((mine or {}).get("skills", {}).items())],
        }
        (from_spec if source == "spec" else from_side).append(sid)
        if host_api is not None:
            hosts.append(entry)
        elif entry["skills"]:
            family.append(entry)
    if from_side:
        said.append("hosts: from the side file setup/hosts.side.json (the spec has no manifest.extensions for them): whether each hosts extensions and its host API, for " + ", ".join(from_side))
    if from_spec:
        said.append("hosts: from the spec's manifest.extensions: " + ", ".join(from_spec))
    if left_out:
        said.append("hosts: in the side file but not public in the spec, left out: " + ", ".join(left_out))
    doc = {
        "format": "formext-hosts",
        "version": 1,
        "source": {"registry_version": (spec.get("source") or {}).get("registry_version")},
        "hosts": hosts,
        "family": family,
    }
    return doc, said


def _names(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def hosts_md(doc: dict) -> str:
    out = [
        "# Host app skills",
        "",
        "Written by `python3 -I setup/hosts.py --family setup/family.spec.json` from the family spec (formadaptor's `family.json`) and `setup/hosts.side.json`; do not edit it by hand. The host list is also in `setup/hosts.json`.",
        "",
        "## Hosts",
        "",
        "The Form apps that load form.ext extensions, public apps only.",
        "",
        "| Host app | Spec id | Repository | Host API | MCP server | Host API from |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for h in doc["hosts"]:
        out.append(f"| {h['name']} | {h['id']} | {h['repository']} | {h['host_api']} | {'yes' if h['mcp'] else 'no'} | {'the spec' if h['host_api_from'] == 'spec' else 'side file'} |")
    out += [
        "",
        "## Copied skills",
        "",
        "Skills copied byte for byte from the Form apps' own repositories (`https://github.com/nodemode-dev/[repo]`, branch main), so an agent working in form.ext understands each host app it makes extensions for and can drive the app. They are not edited here: change a skill in its own repository, then fetch it again and update its commit in `setup/hosts.side.json`. Each folder keeps its name. `./formext agents sync` mirrors them to `.agents/skills`, and `./formext agents install` puts them in the user account with the formext skills.",
        "",
        "| Skill | Host app | Source repository | Commit | Licence of the source |",
        "| --- | --- | --- | --- | --- |",
    ]
    for h in doc["hosts"] + doc["family"]:
        label = f"{h['name']} ({h['role']})" if h.get("role") else h["name"]
        for s in h["skills"]:
            out.append(f"| `{s['name']}` | {label} | `{h['repo']}` | `{s['commit']}` | {h['licence']} |")
    out += [
        "",
        "Left out on purpose: the skillsets (`*-skillset`, and `formvis-harness` and `formlit-harness`, which are for changing an app's own code), `formvis-editing` (superseded by `formvis-driving`) and `formvis-colour-science`.",
    ]
    bare = [h for h in doc["hosts"] if not h["skills"]]
    if bare:
        notes = [f"{h['name']}: {h['note']}" for h in bare if h.get("note")]
        with_mcp = [h["name"] for h in bare if h["mcp"]]
        without = [h["name"] for h in bare if not h["mcp"]]
        mcp_line = []
        if with_mcp:
            mcp_line.append(f"{_names(with_mcp)} {'has its' if len(with_mcp) == 1 else 'have their'} own MCP server")
        if without:
            mcp_line.append(f"{_names(without)} {'has' if len(without) == 1 else 'have'} none")
        out += [
            "",
            f"Host apps with no skill that teaches an agent to use them yet: {_names([h['name'] for h in bare])}" + (f" ({'; '.join(notes)})" if notes else "") + ". For these, read the app's API page through the formext `docs` tool, pull its source with the `source` tool and read the files it names, and, when formMCP is installed, use its `app_tools` (" + "; ".join(mcp_line) + ").",
        ]
    out += [
        "",
        "The same copies can be taken from form.ext's own source store: `./formext cli source [app]` pulls an app's repository into the data folder (`sources/[repository]/`), and its `.claude/skills` there is the origin for a refresh.",
        "",
        "To refresh: clone each repository with `git clone --depth 1 --filter=blob:none --sparse`, run `git sparse-checkout set --no-cone /.claude/ /.agents/ /.mcp.json /AGENTS.md /LICENSE`, copy the skill folders again, update the commits in `setup/hosts.side.json`, run `python3 -I setup/hosts.py --family setup/family.spec.json` and `./formext agents sync`.",
        "",
    ]
    return "\n".join(out)


def outputs(spec: dict, side: dict) -> tuple[dict, list[str]]:
    doc, said = build(spec, side)
    return {HOSTS_JSON: json.dumps(doc, indent=2) + "\n", HOSTS_MD: hosts_md(doc)}, said


def main(argv: list[str]) -> int:
    check = "--check" in argv
    rest = [a for a in argv if a != "--check"]
    if len(rest) != 2 or rest[0] != "--family":
        print(__doc__, file=sys.stderr)
        return 2
    spec_path = Path(rest[1])
    try:
        spec = read_spec(spec_path)
        side = read_side(SIDE)
    except Unreadable as err:
        print(f"hosts: cannot read the {err}", file=sys.stderr)
        return 2
    files, said = outputs(spec, side)
    for line in said:
        print(line, file=sys.stderr)
    differ = [p for p, text in files.items() if not p.is_file() or p.read_bytes() != text.encode("utf-8")]
    if check:
        for p in differ:
            print(str(p.relative_to(ROOT)))
        return 1 if differ else 0
    if differ:
        for p in differ:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(files[p].encode("utf-8"))
            print(f"hosts: wrote {p.relative_to(ROOT)}", file=sys.stderr)
        if spec_path.resolve() != SPEC_COPY.resolve():
            SPEC_COPY.write_bytes(spec_path.read_bytes())
            print(f"hosts: copied the spec to {SPEC_COPY.relative_to(ROOT)}", file=sys.stderr)
    else:
        print("hosts: already in step", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
