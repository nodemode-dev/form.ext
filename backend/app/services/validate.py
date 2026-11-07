from __future__ import annotations

import bisect
import importlib
import json
import re
import time
import zlib
from pathlib import Path

from app.services import paths

paths.use_contract()
formext_host = importlib.import_module("formext_host")
formpkg = importlib.import_module("formpkg")

SEVERITIES = ("error", "warning", "info")
LINT_TYPES = {".html", ".js", ".mjs", ".css"}
TEXT_LIMIT = 2 * 1024 * 1024
LARGE_FILE = 5 * 1024 * 1024
PLAIN = {
    "document": "read and change the open document",
    "files-read": "open files you choose",
    "files-write": "save files where you choose",
    "network": "reach the internet",
    "models": "use local models",
    "native-code": "run native code",
}

RULES = [
    {"id": "json", "severity": "error", "title": "manifest.json is valid JSON", "text": "The host cannot read a manifest with a syntax error."},
    {"id": "package", "severity": "error", "title": "Package rules", "text": "The contract kit's own checks (tools/formpkg.py): required fields, ids, versions, permissions, contributes, entry.ui, file types, paths and file count."},
    {"id": "schema", "severity": "error", "title": "Manifest schema", "text": "contract/schema/package.schema.json: lengths, https addresses, panel locations, unknown keys in entry and contributes."},
    {"id": "host", "severity": "error", "title": "Host acceptance", "text": "What an API 1 host checks before loading (contract section 3), with formext_host.check."},
    {"id": "missing-entry", "severity": "error", "title": "Entry page", "text": "entry.ui exists and is an HTML page."},
    {"id": "missing-file", "severity": "error", "title": "Files the code loads", "text": "Every relative script, style, image, import and url() points at a file in the package."},
    {"id": "csp-inline-script", "severity": "error", "title": "Inline script", "text": "The extension CSP allows scripts from the package only: inline <script>, on* attributes and javascript: links never run."},
    {"id": "csp-external", "severity": "error", "title": "Outside resources", "text": "Scripts, styles, fonts, images and media load only from the package; anything from the internet is blocked."},
    {"id": "csp-frame", "severity": "error", "title": "Frames and base", "text": "frame-src and base-uri are 'none'."},
    {"id": "no-network", "severity": "error", "title": "Direct network use", "text": "connect-src is 'none': fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon fail. Use net.fetch with the network permission."},
    {"id": "no-eval", "severity": "error", "title": "eval", "text": "The CSP has no 'unsafe-eval': eval, new Function and string timers fail."},
    {"id": "sandbox-storage", "severity": "error", "title": "Browser storage", "text": "The sandbox has an opaque origin: localStorage, sessionStorage, indexedDB and cookies throw. Use storage.get and storage.set."},
    {"id": "sandbox-ui", "severity": "warning", "title": "Dialogs, popups and forms", "text": "The sandbox allows scripts only: alert, confirm, prompt, window.open, target=_blank and form submits do nothing, and the parent's DOM is out of reach."},
    {"id": "undeclared-permission", "severity": "error", "title": "Permission used but not declared", "text": "Calls that need a permission missing from the manifest fail with -32001."},
    {"id": "unused-permission", "severity": "warning", "title": "Permission declared but not used", "text": "Every permission is shown to the person in the consent dialog; ask only for what the code calls."},
    {"id": "headless-command", "severity": "warning", "title": "Headless commands", "text": "A command without a panel must handle ext.activate and call ext.done, or the host closes it after 120 s idle."},
    {"id": "file-size", "severity": "warning", "title": "File sizes", "text": "Single files over 5 MB slow every load; the packed package must stay under 20 MB."},
    {"id": "description", "severity": "info", "title": "Description", "text": "The index and FormPortal show the description; without one they show the name."},
]
RULE_SEVERITY = {r["id"]: r["severity"] for r in RULES}

FIX = {
    "format": 'Set "format": "formai-package".',
    "format_version": 'Set "format_version": 1.',
    "id": "Use 2 to 64 lower-case letters, digits and hyphens, starting with a letter or digit.",
    "name": "Give the extension a name.",
    "author": "Fill in the author (settings hold a default).",
    "licence": 'Fill in the licence, for example "Apache-2.0".',
    "product": "Pick one of: " + ", ".join(formpkg.PRODUCTS) + ".",
    "kind": 'Extensions with panels or commands are "script-plugin".',
    "version": "Write the version as three numbers, like 0.1.0.",
    "minimum_app": "Write it as three numbers, or leave it out while testing against a source build.",
    "native": 'Set "native": false; API 1 hosts do not load native extensions.',
    "permissions": "List each permission once, from: " + ", ".join(formpkg.PERMISSIONS) + ".",
    "api": 'Set "api": "1".',
    "description": "Keep the description to 400 characters.",
    "homepage": "Use an https:// address.",
    "support": "Use an https:// address.",
    "payload": "Name the payload file, or remove the key.",
    "entry": 'entry holds only "ui".',
    "entry.ui": 'Point entry.ui at the HTML page inside the package, for example "ui/index.html".',
    "contributes": "contributes holds only panels and commands.",
    "contributes.panels": "At most 8 panels.",
    "contributes.commands": "At most 32 commands.",
    "contributes.panels.id": "Use 1 to 32 lower-case letters, digits and hyphens.",
    "contributes.commands.id": "Use 1 to 32 lower-case letters, digits and hyphens.",
    "contributes.panels.title": "Give the panel a title of at most 60 characters.",
    "contributes.commands.title": "Give the command a title of at most 80 characters.",
    "contributes.panels.location": 'Use "dock" or "dialog".',
    "contributes.commands.panel": 'Name a panel id from contributes.panels, or remove "panel" to run the command headless.',
}


class Problems:
    def __init__(self) -> None:
        self.items: list[dict] = []
        self.seen: set[tuple] = set()

    def add(self, rule: str, message: str, file: str = "", line: int = 0, column: int = 0, fix: str = "", severity: str | None = None, path: str = "") -> None:
        key = (rule, file, line, message)
        if key in self.seen:
            return
        self.seen.add(key)
        self.items.append({
            "rule": rule,
            "severity": severity or RULE_SEVERITY.get(rule, "error"),
            "file": file,
            "line": line,
            "column": column,
            "message": message,
            "fix": fix,
            "path": path,
        })


class Text:
    def __init__(self, text: str) -> None:
        self.text = text
        self.starts = [0] + [m.end() for m in re.finditer("\n", text)]

    def pos(self, offset: int) -> tuple[int, int]:
        i = bisect.bisect_right(self.starts, offset) - 1
        return i + 1, offset - self.starts[i] + 1


def locate(text: str) -> dict[tuple, int]:
    out: dict[tuple, int] = {}
    t = Text(text)
    n = len(text)
    scalar = re.compile(r"-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null")

    def ws(i: int) -> int:
        while i < n and text[i] in " \t\r\n":
            i += 1
        return i

    def string(i: int) -> tuple[str, int]:
        j = i + 1
        while j < n:
            if text[j] == "\\":
                j += 2
                continue
            if text[j] == '"':
                return json.loads(text[i:j + 1]), j + 1
            j += 1
        raise ValueError("unterminated string")

    def value(i: int, path: tuple) -> int:
        i = ws(i)
        out.setdefault(path, t.pos(i)[0])
        c = text[i]
        if c == "{":
            i = ws(i + 1)
            if text[i] == "}":
                return i + 1
            while True:
                i = ws(i)
                key, end = string(i)
                out[path + (key,)] = t.pos(i)[0]
                i = ws(end)
                i = value(i + 1, path + (key,))
                i = ws(i)
                if text[i] == ",":
                    i += 1
                    continue
                return i + 1
        if c == "[":
            i = ws(i + 1)
            if text[i] == "]":
                return i + 1
            k = 0
            while True:
                i = value(i, path + (k,))
                i = ws(i)
                k += 1
                if text[i] == ",":
                    i += 1
                    continue
                return i + 1
        if c == '"':
            return string(i)[1]
        m = scalar.match(text, i)
        if not m:
            raise ValueError("bad value")
        return m.end()

    try:
        value(0, ())
    except (ValueError, IndexError):
        pass
    return out


def path_text(path: tuple) -> str:
    out = ""
    for part in path:
        out += f"[{part}]" if isinstance(part, int) else (f".{part}" if out else str(part))
    return out


def path_key(path: tuple) -> str:
    return ".".join(str(p) for p in path if not isinstance(p, int))


def _same(a, b) -> bool:
    return type(a) is type(b) and a == b


TYPE_OK = {
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "string": lambda v: isinstance(v, str),
    "boolean": lambda v: isinstance(v, bool),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
}


def schema_errors(schema: dict, root: dict, value, path: tuple = ()) -> list[tuple[tuple, str]]:
    ref = schema.get("$ref")
    if isinstance(ref, str) and ref.startswith("#/"):
        node = root
        for part in ref[2:].split("/"):
            node = node.get(part, {})
        schema = {**node, **{k: v for k, v in schema.items() if k != "$ref"}}
    name = path_text(path) or "manifest"
    out: list[tuple[tuple, str]] = []
    if "const" in schema and not _same(value, schema["const"]):
        return [(path, f"{name} must be {json.dumps(schema['const'])}")]
    if "enum" in schema and not any(_same(value, e) for e in schema["enum"]):
        return [(path, f"{name} must be one of {', '.join(str(e) for e in schema['enum'])}")]
    kind = schema.get("type")
    if kind and not TYPE_OK.get(kind, lambda v: True)(value):
        return [(path, f"{name} must be {'an' if kind[0] in 'aeiou' else 'a'} {kind}")]
    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            out.append((path, f"{name} must not be empty" if schema["minLength"] == 1 else f"{name} is shorter than {schema['minLength']} characters"))
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            out.append((path, f"{name} is {len(value)} characters; at most {schema['maxLength']}"))
        if "pattern" in schema and not re.search(schema["pattern"], value):
            out.append((path, f"{name} {json.dumps(value)} does not match {schema['pattern']}"))
    if isinstance(value, list):
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            out.append((path, f"{name} has {len(value)} items; at most {schema['maxItems']}"))
        if "minItems" in schema and len(value) < schema["minItems"]:
            out.append((path, f"{name} needs at least {schema['minItems']} items"))
        if schema.get("uniqueItems"):
            seen: list = []
            for v in value:
                if any(_same(v, s) for s in seen):
                    out.append((path, f"{name} lists {json.dumps(v)} twice"))
                seen.append(v)
        if isinstance(schema.get("items"), dict):
            for i, v in enumerate(value):
                out += schema_errors(schema["items"], root, v, path + (i,))
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                out.append((path + (key,), f"{path_text(path + (key,))} is required"))
        props = schema.get("properties", {})
        for key, v in value.items():
            if key in props:
                out += schema_errors(props[key], root, v, path + (key,))
            elif schema.get("additionalProperties") is False:
                out.append((path + (key,), f"{name} has an unknown key {json.dumps(key)}"))
    return out


def pkg_path(message: str) -> str:
    body = message.split(": ", 1)[1] if message.startswith("manifest.json: ") else message
    m = re.match(r"contributes\.(panels|commands) id ", body)
    if m:
        return f"contributes.{m.group(1)}.id"
    m = re.match(r"contributes\.(panels|commands) .* needs a title", body)
    if m:
        return f"contributes.{m.group(1)}.title"
    if body.startswith("command ") and "names panel" in body:
        return "contributes.commands.panel"
    if body.startswith("entry.ui"):
        return "entry.ui"
    m = re.match(r"(\S+) is required", body)
    if m:
        return m.group(1)
    return body.split(" ", 1)[0]


def fix_for(key: str) -> str:
    parts = key.split(".")
    while parts:
        hit = FIX.get(".".join(parts))
        if hit:
            return hit
        parts.pop()
    return ""


def host_path(reason: str) -> str:
    for needle, key in (("formai package", "format"), ("manifest says '", "id"), ("made for", "product"), ("version", "version"), ("extension API", "api"), ("native", "native"), ("permission", "permissions"), ("needs ", "minimum_app"), ("entry.ui", "entry.ui")):
        if needle in reason:
            return key
    return ""


REGEX_BEFORE = set("(,=:[!&|?{};+-*%<>~^")
REGEX_WORDS = {"return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void", "throw", "yield", "await", "instanceof"}


def scan_js(text: str) -> tuple[str, str]:
    code = list(text)
    bare = list(text)
    n = len(text)
    i = 0
    last = ""
    word = ""
    depth = 0
    templates: list[int] = []

    def blank(a: int, b: int, both: bool) -> None:
        for k in range(a, min(b, n)):
            if text[k] != "\n":
                bare[k] = " "
                if both:
                    code[k] = " "

    def quoted(i: int, q: str) -> int:
        j = i + 1
        while j < n:
            c = text[j]
            if c == "\\":
                j += 2
                continue
            if c == q or c == "\n":
                break
            j += 1
        blank(i + 1, j, False)
        return j + 1

    def template(i: int) -> int:
        j = i
        while j < n:
            c = text[j]
            if c == "\\":
                j += 2
                continue
            if c == "`":
                blank(i, j, False)
                return j + 1
            if c == "$" and j + 1 < n and text[j + 1] == "{":
                blank(i, j, False)
                templates.append(depth)
                return j + 2
            j += 1
        blank(i, n, False)
        return n

    while i < n:
        c = text[i]
        if c in " \t\r\n":
            i += 1
            continue
        if c in "'\"":
            i = quoted(i, c)
            last, word = '"', ""
            continue
        if c == "`":
            i = template(i + 1)
            last, word = '"', ""
            continue
        if c == "/" and text.startswith("//", i):
            end = text.find("\n", i)
            end = n if end < 0 else end
            blank(i, end, True)
            i = end
            continue
        if c == "/" and text.startswith("/*", i):
            end = text.find("*/", i + 2)
            end = n if end < 0 else end + 2
            blank(i, end, True)
            i = end
            continue
        if c == "/" and (not last or last in REGEX_BEFORE or word in REGEX_WORDS):
            j = i + 1
            klass = False
            while j < n and text[j] != "\n":
                d = text[j]
                if d == "\\":
                    j += 2
                    continue
                if d == "[":
                    klass = True
                elif d == "]":
                    klass = False
                elif d == "/" and not klass:
                    break
                j += 1
            if j < n and text[j] == "/":
                blank(i + 1, j, False)
                i = j + 1
                last, word = '"', ""
                continue
        if c == "{":
            depth += 1
        elif c == "}":
            if templates and templates[-1] == depth:
                templates.pop()
                i = template(i + 1)
                last, word = '"', ""
                continue
            depth -= 1
        if c.isalnum() or c in "_$":
            j = i
            while j < n and (text[j].isalnum() or text[j] in "_$"):
                j += 1
            word = text[i:j]
            last = "a"
            i = j
            continue
        last, word = c, ""
        i += 1
    return "".join(code), "".join(bare)


def defines(bare: str, open_paren: int) -> bool:
    level = 0
    n = len(bare)
    i = open_paren
    while i < n:
        c = bare[i]
        if c == "(":
            level += 1
        elif c == ")":
            level -= 1
            if level == 0:
                break
        i += 1
    i += 1
    while i < n and bare[i] in " \t\r\n":
        i += 1
    return i < n and bare[i] == "{"


def strip_html(text: str) -> str:
    return re.sub(r"<!--.*?-->", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text, flags=re.S)


def strip_css(text: str) -> str:
    return re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text, flags=re.S)


EXTERNAL = re.compile(r"^(?:[a-z][a-z0-9+.-]*:)?//", re.I)
SKIP_REF = re.compile(r"^(?:#|data:|blob:|mailto:|about:|javascript:)", re.I)

JS_RULES = [
    ("no-network", re.compile(r"(?<![\w$.])fetch\s*\("), "fetch() is blocked: the extension CSP sets connect-src 'none'.", "Call the host instead: formext.fetch(url) (net.fetch) with the network permission. To read a file of your own package, import it as a module."),
    ("no-network", re.compile(r"\b(?:window|globalThis|self)\.fetch\s*\("), "fetch() is blocked: the extension CSP sets connect-src 'none'.", "Call the host instead: formext.fetch(url) (net.fetch) with the network permission."),
    ("no-network", re.compile(r"\bXMLHttpRequest\b"), "XMLHttpRequest is blocked: connect-src is 'none'.", "Use formext.fetch(url) (net.fetch) with the network permission."),
    ("no-network", re.compile(r"\bWebSocket\s*\("), "WebSocket is blocked: connect-src is 'none'.", "API 1 has no sockets; poll with formext.fetch(url) (net.fetch) or listen to ext.event from the host."),
    ("no-network", re.compile(r"\bEventSource\s*\("), "EventSource is blocked: connect-src is 'none'.", "Listen to ext.event from the host, or poll with net.fetch."),
    ("no-network", re.compile(r"\bnavigator\.sendBeacon\s*\("), "sendBeacon is blocked: connect-src is 'none'.", "Use formext.fetch(url) (net.fetch) with the network permission."),
    ("no-eval", re.compile(r"(?<![\w$.])eval\s*\("), "eval() is blocked: the CSP has no 'unsafe-eval'.", "Parse data with JSON.parse, or write the code as a module in the package."),
    ("no-eval", re.compile(r"\bnew\s+Function\s*\("), "new Function() is blocked: the CSP has no 'unsafe-eval'.", "Write the function in a module in the package."),
    ("no-eval", re.compile(r"\bset(?:Timeout|Interval)\s*\(\s*['\"`]"), "A string timer is evaluated as code, which the CSP blocks.", "Pass a function: setTimeout(() => work(), ms)."),
    ("sandbox-storage", re.compile(r"\b(?:localStorage|sessionStorage|indexedDB)\b"), "{0} throws in the sandbox: the frame has an opaque origin.", "Use formext.storageGet(key) and formext.storageSet(key, value) (storage.get, storage.set), 256 KB per extension."),
    ("sandbox-storage", re.compile(r"\bdocument\.cookie\b"), "document.cookie throws in the sandbox: the frame has an opaque origin.", "Use formext.storageSet(key, value) (storage.set)."),
    ("sandbox-ui", re.compile(r"(?:(?<![\w$.])|\bwindow\.)(?:alert|confirm|prompt)\s*\("), "{0} does nothing in the sandbox: modals are not allowed.", "Tell the person with formext.notify(message, level) (ui.notify), or ask inside your own page."),
    ("sandbox-ui", re.compile(r"\bwindow\.open\s*\("), "window.open does nothing in the sandbox: popups are not allowed.", "Show the content inside your panel, or fetch it through net.fetch."),
    ("sandbox-ui", re.compile(r"\b(?:top|parent)\.(?:document|location)\b"), "{0} is out of reach: the host's window is another origin.", "Talk to the host only through postMessage (the SDK)."),
]
IMPORT_RE = re.compile(r"""(?:(?<![.$])\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|(?<![.$])\bimport\s*\(\s*|\bnew\s+Worker\s*\(\s*)(['"])([^'"\n]+)\1""")
METHOD_STRING = re.compile(r"""['"`]((?:document|app|files|net|ext|host|ui|storage)\.[a-zA-Z]+)['"`]""")
METHOD_ITEM = r"""\s*['"`](?:document|app|files|net|ext|host|ui|storage)\.[a-zA-Z]+['"`]\s*"""
METHOD_LIST = re.compile(r"\[" + METHOD_ITEM + r"(?:," + METHOD_ITEM + r")+\]")
SDK_WRAPPER = re.compile(r"\bthis\s*\.\s*(?:call|on)\s*(?:<[^()]*>)?\s*\(\s*$")
SDK_CALLS = [
    (re.compile(r"\.readDocument\s*\("), "document.read"),
    (re.compile(r"\.apply\s*\(\s*['\"`]"), "document.apply"),
    (re.compile(r"\.run\s*\(\s*['\"`]"), "app.run"),
    (re.compile(r"\.openFiles\s*\("), "files.open"),
    (re.compile(r"\.saveFile\s*\("), "files.save"),
    (re.compile(r"\.done\s*\("), "ext.done"),
    (re.compile(r"\.onActivate\s*\("), "ext.activate"),
]
CLIENT_FETCH = re.compile(r"\b([A-Za-z_$][\w$]*)\.fetch\s*\(")
NEEDS = {"document.read": "document", "document.apply": "document", "app.commands": "document", "app.run": "document", "files.open": "files-read", "files.save": "files-write", "net.fetch": "network"}


def is_sdk(text: str) -> bool:
    return "class FormExt" in text and "host.hello" in text


class Linter:
    def __init__(self, folder: Path, prefix: str, out: Problems) -> None:
        self.folder = folder
        self.prefix = prefix
        self.out = out
        self.uses: dict[str, tuple[str, int]] = {}

    def rel(self, path: Path) -> str:
        r = path.relative_to(self.folder).as_posix()
        return f"{self.prefix}/{r}" if self.prefix else r

    def exists(self, base: Path, ref: str) -> bool | None:
        ref = ref.split("#", 1)[0].split("?", 1)[0]
        if not ref:
            return None
        target = (self.folder / ref.lstrip("/")) if ref.startswith("/") else (base.parent / ref)
        try:
            resolved = target.resolve()
        except OSError:
            return False
        root = self.folder.resolve()
        return (resolved == root or root in resolved.parents) and resolved.is_file()

    def ref(self, file: Path, t: Text, offset: int, ref: str, what: str) -> None:
        ref = ref.strip()
        if not ref or SKIP_REF.match(ref):
            return
        line, col = t.pos(offset)
        if EXTERNAL.match(ref):
            self.out.add("csp-external", f"{what} {ref} is blocked: extensions load only their own files.", self.rel(file), line, col, "Copy the file into the package and point at it with a relative path.")
            return
        if re.match(r"^[a-z][a-z0-9+.-]*:", ref, re.I):
            return
        if what == "import" and not ref.startswith((".", "/")):
            self.out.add("missing-file", f"import {json.dumps(ref)} is a bare name; the browser cannot resolve it without a bundler.", self.rel(file), line, col, 'Import with a relative path, for example "./formext.js".')
            return
        if self.exists(file, ref) is False:
            self.out.add("missing-file", f"{what} {ref} is not in the package.", self.rel(file), line, col, "Add the file, or fix the path (it is relative to this file).")

    def use(self, method: str, file: Path, t: Text, offset: int) -> None:
        if method not in self.uses:
            self.uses[method] = (self.rel(file), t.pos(offset)[0])

    def js(self, file: Path, text: str, base_offset: int = 0, t: Text | None = None) -> None:
        t = t or Text(text)
        code, bare = scan_js(text)
        for rule, rx, message, fix in JS_RULES:
            for m in rx.finditer(bare):
                if m.group(0).endswith("(") and defines(bare, m.end() - 1):
                    continue
                line, col = t.pos(base_offset + m.start())
                self.out.add(rule, message.format(m.group(0).rstrip("( ").strip()), self.rel(file), line, col, fix)
        for m in IMPORT_RE.finditer(code):
            if bare[m.start()] != code[m.start()]:
                continue
            self.ref(file, t, base_offset + m.start(2), m.group(2), "import")
        lists = [m.span() for m in METHOD_LIST.finditer(code)]
        for m in METHOD_STRING.finditer(code):
            if SDK_WRAPPER.search(code[max(0, m.start() - 48):m.start()]) or any(a <= m.start() < b for a, b in lists):
                continue
            self.use(m.group(1), file, t, base_offset + m.start())
        for rx, method in SDK_CALLS:
            for m in rx.finditer(bare):
                self.use(method, file, t, base_offset + m.start())
        for m in CLIENT_FETCH.finditer(bare):
            if defines(bare, m.end() - 1):
                continue
            if m.group(1) not in ("window", "globalThis", "self"):
                self.use("net.fetch", file, t, base_offset + m.start())

    def css(self, file: Path, text: str, base_offset: int = 0, t: Text | None = None) -> None:
        t = t or Text(text)
        code = strip_css(text)
        for m in re.finditer(r"""url\(\s*(['"]?)([^'")]+)\1\s*\)""", code):
            self.ref(file, t, base_offset + m.start(2), m.group(2), "url()")
        for m in re.finditer(r"""@import\s+(['"])([^'"]+)\1""", code):
            self.ref(file, t, base_offset + m.start(2), m.group(2), "@import")

    def html(self, file: Path, text: str) -> None:
        t = Text(text)
        code = strip_html(text)
        for m in re.finditer(r"<script\b([^>]*)>(.*?)</script\s*>", code, re.S | re.I):
            attrs, body = m.group(1), m.group(2)
            src = re.search(r"""\bsrc\s*=\s*(['"]?)([^'"\s>]+)\1""", attrs, re.I)
            kind = re.search(r"""\btype\s*=\s*(['"]?)([^'"\s>]+)\1""", attrs, re.I)
            kind_value = kind.group(2).lower() if kind else ""
            if src:
                self.ref(file, t, m.start(1) + src.start(2), src.group(2), "script")
            elif body.strip() and (not kind_value or kind_value in ("module", "text/javascript", "application/javascript", "importmap")):
                line, col = t.pos(m.start())
                self.out.add("csp-inline-script", "This inline <script> never runs: the CSP allows scripts from the package only.", self.rel(file), line, col, 'Move the code into a .js file in the package and load it with <script type="module" src="...">.')
            if not src and kind_value not in ("application/json", "application/ld+json", "text/template", "text/plain"):
                self.js(file, body, m.start(2), t)
        for m in re.finditer(r"<style\b[^>]*>(.*?)</style\s*>", code, re.S | re.I):
            self.css(file, m.group(1), m.start(1), t)
        for tag in re.finditer(r"<([a-zA-Z][\w-]*)\b([^>]*)>", code):
            name, attrs = tag.group(1).lower(), tag.group(2)
            offset = tag.start(2)
            for a in re.finditer(r"""\s(on[a-z]+)\s*=""", attrs, re.I):
                line, col = t.pos(offset + a.start(1))
                self.out.add("csp-inline-script", f"The {a.group(1)} attribute never runs: the CSP blocks inline handlers.", self.rel(file), line, col, f"Add the listener in your module: element.addEventListener('{a.group(1)[2:].lower()}', ...).")
            for a in re.finditer(r"""\s(src|href|poster|data)\s*=\s*(['"]?)([^'"\s>]*)\2""", attrs, re.I):
                attr, value = a.group(1).lower(), a.group(3)
                if value.lower().startswith("javascript:"):
                    line, col = t.pos(offset + a.start(3))
                    self.out.add("csp-inline-script", "A javascript: link never runs: the CSP blocks inline script.", self.rel(file), line, col, "Use a button with a listener added in your module.")
                    continue
                if name == "script" and attr == "src":
                    continue
                if name == "a" and attr == "href":
                    if EXTERNAL.match(value):
                        line, col = t.pos(offset + a.start(3))
                        self.out.add("sandbox-ui", f"The link {value} cannot open: the sandbox blocks navigation and popups.", self.rel(file), line, col, "Show the address as text, or fetch the content through net.fetch.")
                    continue
                if name == "link" and not re.search(r"""\brel\s*=\s*['"]?(?:stylesheet|icon|preload|modulepreload)""", attrs, re.I):
                    continue
                self.ref(file, t, offset + a.start(3), value, f"<{name} {attr}>")
            for a in re.finditer(r"""\sstyle\s*=\s*(['"])(.*?)\1""", attrs, re.S | re.I):
                self.css(file, a.group(2), offset + a.start(2), t)
            if name in ("iframe", "frame", "object", "embed"):
                line, col = t.pos(tag.start())
                self.out.add("csp-frame", f"<{name}> is blocked: frame-src is 'none'.", self.rel(file), line, col, "Show the content directly in your page.")
            elif name == "base":
                line, col = t.pos(tag.start())
                self.out.add("csp-frame", "<base> is blocked: base-uri is 'none'.", self.rel(file), line, col, "Remove it and use relative paths.")
            elif name == "form" and not re.search(r"""\bonsubmit\b""", attrs, re.I):
                line, col = t.pos(tag.start())
                self.out.add("sandbox-ui", "A <form> cannot submit in the sandbox.", self.rel(file), line, col, "Handle the submit event in your module and call event.preventDefault().")
            if re.search(r"""\btarget\s*=\s*['"]?_blank""", attrs, re.I):
                line, col = t.pos(tag.start())
                self.out.add("sandbox-ui", 'target="_blank" does nothing: the sandbox blocks popups.', self.rel(file), line, col, "Remove the target.")

    def run(self, files: list[Path]) -> None:
        for p in files:
            suffix = p.suffix.lower()
            if suffix not in LINT_TYPES:
                continue
            try:
                if p.stat().st_size > TEXT_LIMIT:
                    continue
                text = p.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            if suffix in (".js", ".mjs"):
                if is_sdk(text):
                    continue
                self.js(p, text)
            elif suffix == ".css":
                self.css(p, text)
            else:
                self.html(p, text)


def validate_folder(folder: Path, prefix: str = "") -> dict:
    folder = Path(folder)
    started = time.time()
    out = Problems()
    mfile = f"{prefix}/manifest.json" if prefix else "manifest.json"
    raw = ""
    manifest: dict | None = None
    lines: dict[tuple, int] = {}
    try:
        raw = (folder / "manifest.json").read_text(encoding="utf-8")
    except FileNotFoundError:
        out.add("json", "There is no manifest.json at the package root.", mfile, 0, 0, "Create manifest.json (the New pane writes a working one).")
    except (OSError, UnicodeDecodeError) as e:
        out.add("json", f"manifest.json cannot be read: {e}", mfile, 0, 0, "Save it as UTF-8 text.")
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                manifest = parsed
                lines = locate(raw)
            else:
                out.add("json", "manifest.json must hold one JSON object.", mfile, 1, 1, "Wrap the fields in { }.")
        except json.JSONDecodeError as e:
            out.add("json", f"manifest.json is not valid JSON: {e.msg}.", mfile, e.lineno, e.colno, "Fix the syntax at this line: check commas, quotes and brackets.")

    def line_of(path: tuple) -> int:
        p = tuple(path)
        while p:
            if p in lines:
                return lines[p]
            p = p[:-1]
        return lines.get((), 1 if manifest is not None else 0)

    def key_line(key: str) -> int:
        return line_of(tuple(key.split("."))) if key else line_of(())

    files: list[Path] = []
    file_errs: list[str] = []
    try:
        files, file_errs = formpkg.files_of(folder)
    except OSError as e:
        file_errs = [f"the folder cannot be read: {e}"]
    for msg in file_errs:
        rel, _, text = msg.partition(": ")
        if text and ((folder / rel).exists() or (folder / rel).is_symlink()):
            out.add("package", text[:1].upper() + text[1:] + ".", f"{prefix}/{rel}" if prefix else rel, 0, 0, "Only the contract's file types go into a package: " + " ".join(sorted(formpkg.TYPES)) + "." if "file type" in text else "Replace the link with the file itself." if "symlink" in text else "Shorten the path to 200 characters.")
        else:
            out.add("package", msg[:1].upper() + msg[1:] + ".", mfile, 0, 0, f"Keep the package to {formpkg.MAX_FILES} files.")

    reported: set[str] = set()
    if manifest is not None:
        try:
            pkg_errs, _ = formpkg.problems(folder)
        except Exception as e:
            pkg_errs = []
            out.add("package", f"The kit's package check (formpkg) stopped on this manifest ({type(e).__name__}); the schema problems say why.", mfile, 1, 1, "Make entry and contributes objects, entry.ui text, and panels and commands lists of objects.", severity="info")
        for msg in pkg_errs:
            key = pkg_path(msg)
            reported.add(key)
            body = msg.split(": ", 1)[1] if msg.startswith("manifest.json: ") else msg
            rule = "missing-entry" if key == "entry.ui" and "not a file" in body else "package"
            fix = FIX.get(key, "")
            if rule == "missing-entry":
                fix = "Create the page at that path, or point entry.ui at the HTML page you have."
            out.add(rule, body + ".", mfile, key_line(key), 0, fix, path=key)
        try:
            schema = json.loads((paths.contract_dir() / "schema" / "package.schema.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            schema = {}
        for path, msg in schema_errors(schema, schema, manifest) if schema else []:
            key = path_key(path)
            if any(key == r or key.startswith(r + ".") for r in reported):
                continue
            out.add("schema", msg + ".", mfile, line_of(path), 0, fix_for(key) or "See contract/schema/package.schema.json.", path=path_text(path))
            reported.add(key)
        if "api" not in manifest:
            out.add("host", 'An API 1 host refuses it: there is no "api" field.', mfile, line_of(()), 0, FIX["api"], path="api")
            reported.add("api")
        if manifest.get("native") is True and "native" not in reported:
            out.add("host", "An API 1 host refuses it: native extensions are not supported.", mfile, key_line("native"), 0, FIX["native"], path="native")
            reported.add("native")
        mid = str(manifest.get("id", ""))
        product = str(manifest.get("product", ""))
        if formpkg.ID_RE.match(mid) and product in formpkg.PRODUCTS:
            try:
                ext = formext_host.Extension(id=mid, version=str(manifest.get("version", "0.0.0")), source="development", path=folder)
                ext = formext_host.check(ext, product, "99.99.9", product)
                if ext.state == "refused":
                    key = host_path(ext.reason)
                    if not key or not any(key == r or key.startswith(r + ".") or r.startswith(key + ".") for r in reported):
                        fix = FIX.get(key, "")
                        out.add("host", f"An API 1 host would refuse it: {ext.reason}.", mfile, key_line(key), 0, fix, path=key)
                        reported.add(key)
            except Exception as e:
                out.add("host", f"The host check stopped: {type(e).__name__}.", mfile, 1, 0, "")
        entry = (manifest.get("entry") or {}).get("ui") if isinstance(manifest.get("entry"), dict) else None
        if isinstance(entry, str) and entry and not entry.lower().endswith((".html", ".htm")) and "entry.ui" not in reported:
            out.add("missing-entry", f"entry.ui {entry} is not an HTML page; the host loads it in a frame.", mfile, key_line("entry.ui"), 0, "Point entry.ui at an .html page.", severity="warning", path="entry.ui")
        if not manifest.get("description") and "description" not in reported:
            out.add("description", "There is no description.", mfile, line_of(()), 0, "Add one sentence that says what the extension does (at most 400 characters).", path="description")

    lint = Linter(folder, prefix, out)
    lint.run(files)

    if manifest is not None:
        declared = manifest.get("permissions") if isinstance(manifest.get("permissions"), list) else []
        used: dict[str, tuple[str, int, str]] = {}
        for method, (file, line) in lint.uses.items():
            perm = NEEDS.get(method)
            if perm and perm not in used:
                used[perm] = (file, line, method)
        for perm, (file, line, method) in used.items():
            if perm not in declared:
                out.add("undeclared-permission", f"The code calls {method}, which needs the {perm} permission ({PLAIN[perm]}), and the manifest does not ask for it.", file, line, 0, f'Add "{perm}" to permissions in manifest.json.')
        if "permissions" not in reported:
            for i, perm in enumerate(declared):
                if perm in used or perm not in PLAIN:
                    continue
                if perm in ("models", "native-code"):
                    text = f"The {perm} permission ({PLAIN[perm]}) has no API 1 method; the consent dialog shows it for nothing."
                else:
                    text = f"The manifest asks for {perm} ({PLAIN[perm]}), but no code calls a method that needs it."
                out.add("unused-permission", text, mfile, line_of(("permissions", i)), 0, f'Remove "{perm}" from permissions, unless code loaded at run time calls it.', path=f"permissions[{i}]")
        contributes = manifest.get("contributes") if isinstance(manifest.get("contributes"), dict) else {}
        commands = contributes.get("commands") if isinstance(contributes.get("commands"), list) else []
        handles = "ext.activate" in lint.uses
        finishes = "ext.done" in lint.uses
        for i, c in enumerate(commands):
            if not isinstance(c, dict) or c.get("panel"):
                continue
            if not handles:
                out.add("headless-command", f"Command {c.get('id')!r} runs headless, but no code handles ext.activate.", mfile, line_of(("contributes", "commands", i)), 0, "Handle it: formext.onActivate(({ command }) => ...), or give the command a panel.", path=f"contributes.commands[{i}]")
            elif not finishes:
                out.add("headless-command", f"Command {c.get('id')!r} runs headless, but no code calls ext.done; the host closes it after 120 s idle.", mfile, line_of(("contributes", "commands", i)), 0, "Call formext.done(result) when the command has finished.", path=f"contributes.commands[{i}]")

    total = 0
    for p in files:
        try:
            size = p.stat().st_size
        except OSError:
            continue
        total += size
        if size > LARGE_FILE:
            out.add("file-size", f"This file is {size / 1048576:.1f} MB.", lint.rel(p), 0, 0, "Compress it, or load less at once; the packed package must stay under 20 MB.")
    if total > formpkg.MAX_BYTES:
        packed = 0
        for p in files:
            try:
                packed += len(zlib.compress(p.read_bytes(), 9)) + 100
            except OSError:
                continue
        if packed > formpkg.MAX_BYTES:
            out.add("file-size", f"The package would be about {packed / 1048576:.1f} MB packed; at most 20 MB.", mfile, 0, 0, "Remove or shrink the largest files.", severity="error")

    order = {s: i for i, s in enumerate(SEVERITIES)}
    out.items.sort(key=lambda p: (order.get(p["severity"], 9), p["file"] != mfile, p["file"], p["line"], p["column"]))
    counts = {s: sum(1 for p in out.items if p["severity"] == s) for s in SEVERITIES}
    return {
        "ok": counts["error"] == 0,
        "counts": counts,
        "problems": out.items,
        "files": len(files),
        "bytes": total,
        "manifest": mfile,
        "id": (manifest or {}).get("id"),
        "product": (manifest or {}).get("product"),
        "checked_at": started,
        "ms": round((time.time() - started) * 1000),
    }


def rules() -> list[dict]:
    return RULES
