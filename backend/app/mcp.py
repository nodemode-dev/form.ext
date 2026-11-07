import argparse
import json
import sys
import threading
import traceback
from typing import Any

from app import __version__
from app.cli import OPS, BY_NAME, Engine, EngineError, OpError, _docs_topics, run_op

PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]

INSTRUCTIONS = (
    "form.ext makes extensions for the Form apps (formvis, formcut, formwav, formpdf, formdeck, formlit, formmd, formencoder, formvfx, formmcp, formtray, formskills). "
    "Read docs {topic: 'contract'} once and docs {topic: <product>} for the app you build for. "
    "The loop: templates, new, read and write the files, manifest, validate until it has no errors, preview, package, then run_in_app to load it in the real app, sign and publish. "
    "Paths are relative to the project folder (package/ui/app.js); files gives package_prefix. "
    "Ask the person before run_in_app (it writes FormPortal's dev.json), publish with formportal (it installs), and delete."
)


def _schema(op) -> dict:
    props: dict[str, Any] = {}
    for p in op.params:
        if p.name == "source":
            continue
        spec: dict[str, Any] = {"type": p.type, "description": p.help}
        if p.enum:
            spec["enum"] = p.enum
        if p.default not in (None, False):
            spec["default"] = p.default
        props[p.name] = spec
    required = [p.name for p in op.params if p.required]
    out: dict[str, Any] = {"type": "object", "properties": props, "additionalProperties": False}
    if required:
        out["required"] = required
    return out


def tools() -> list[dict]:
    out = []
    for op in OPS:
        if not op.mcp:
            continue
        out.append({
            "name": op.name,
            "title": op.title,
            "description": op.help,
            "inputSchema": _schema(op),
            "annotations": {"title": op.title, "readOnlyHint": op.read_only, "destructiveHint": op.destructive, "idempotentHint": op.read_only, "openWorldHint": False},
        })
    return out


def resources() -> list[dict]:
    out = []
    for topic, path in _docs_topics().items():
        if path.is_file():
            mime = "text/markdown" if path.suffix == ".md" else "application/json" if path.suffix == ".json" else "text/plain"
            out.append({"uri": f"formext://docs/{topic}", "name": topic, "title": "Form Extension Contract" if topic == "contract" else f"{topic} extension API" if path.suffix == ".md" else topic, "mimeType": mime})
    return out


class Server:
    def __init__(self, engine: Engine, out) -> None:
        self.engine = engine
        self.out = out
        self.lock = threading.Lock()
        self.protocol = PROTOCOLS[0]

    def write(self, message: dict) -> None:
        with self.lock:
            self.out.write(json.dumps(message, ensure_ascii=False) + "\n")
            self.out.flush()

    def warm(self) -> None:
        def run() -> None:
            try:
                self.engine.connect()
            except Exception:
                traceback.print_exc(file=sys.stderr)

        threading.Thread(target=run, name="formext-mcp-warm", daemon=True).start()

    def call_tool(self, params: dict) -> dict:
        name = str(params.get("name") or "")
        if name not in BY_NAME or not BY_NAME[name].mcp:
            raise LookupError(name)
        args = params.get("arguments") or {}
        try:
            data = run_op(self.engine, name, args if isinstance(args, dict) else {})
        except OpError as err:
            body = {"error": err.message}
            if err.data is not None:
                body["data"] = err.data
            if isinstance(err, EngineError):
                body["status"] = err.status
            return {"content": [{"type": "text", "text": json.dumps(body, indent=1, ensure_ascii=False)}], "isError": True}
        except (OSError, ValueError, TypeError) as err:
            return {"content": [{"type": "text", "text": f"{name} failed: {type(err).__name__}: {err}"}], "isError": True}
        result: dict[str, Any] = {"content": [{"type": "text", "text": json.dumps(data, indent=1, ensure_ascii=False)}]}
        if isinstance(data, dict):
            result["structuredContent"] = data
        return result

    def handle(self, msg: Any) -> dict | None:
        if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0" or not isinstance(msg.get("method"), str):
            if isinstance(msg, dict) and "id" in msg and "method" not in msg:
                return None
            return {"jsonrpc": "2.0", "id": msg.get("id") if isinstance(msg, dict) else None, "error": {"code": -32600, "message": "Invalid Request"}}
        mid = msg.get("id")
        method = msg["method"]
        params = msg.get("params") or {}
        if mid is None:
            return None
        try:
            if method == "initialize":
                asked = str(params.get("protocolVersion") or "")
                self.protocol = asked if asked in PROTOCOLS else PROTOCOLS[0]
                self.warm()
                result = {
                    "protocolVersion": self.protocol,
                    "capabilities": {"tools": {"listChanged": False}, "resources": {"listChanged": False, "subscribe": False}},
                    "serverInfo": {"name": "formext", "title": "form.ext", "version": __version__},
                    "instructions": INSTRUCTIONS,
                }
            elif method == "ping":
                result = {}
            elif method == "tools/list":
                result = {"tools": tools()}
            elif method == "tools/call":
                try:
                    result = self.call_tool(params)
                except LookupError:
                    return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32602, "message": f"Unknown tool: {params.get('name')}"}}
            elif method == "resources/list":
                result = {"resources": resources()}
            elif method == "resources/templates/list":
                result = {"resourceTemplates": []}
            elif method == "resources/read":
                uri = str(params.get("uri") or "")
                topic = uri.removeprefix("formext://docs/")
                path = _docs_topics().get(topic)
                if not uri.startswith("formext://docs/") or path is None or not path.is_file():
                    return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32002, "message": f"Resource not found: {uri}"}}
                mime = next((r["mimeType"] for r in resources() if r["uri"] == uri), "text/plain")
                result = {"contents": [{"uri": uri, "mimeType": mime, "text": path.read_text(encoding="utf-8", errors="replace")}]}
            elif method == "prompts/list":
                result = {"prompts": []}
            elif method == "logging/setLevel":
                result = {}
            else:
                return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"Method not found: {method}"}}
        except Exception as exc:
            traceback.print_exc(file=sys.stderr)
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32603, "message": f"Internal error: {type(exc).__name__}: {exc}"}}
        return {"jsonrpc": "2.0", "id": mid, "result": result}

    def serve(self, stdin) -> None:
        for raw in stdin:
            line = raw.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except ValueError:
                self.write({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
                continue
            if isinstance(msg, list):
                answers = [a for a in (self.handle(m) for m in msg) if a]
                if answers:
                    self.write(answers)
                continue
            answer = self.handle(msg)
            if answer:
                self.write(answer)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="formext mcp", description="The form.ext MCP server on stdio (newline-delimited JSON-RPC 2.0).")
    parser.add_argument("--engine", metavar="URL", help="talk to the engine at URL (default: a running engine with this data folder, else in-process)")
    parser.add_argument("--local", action="store_true", help="always run the engine's routes in-process")
    parser.add_argument("--list-tools", action="store_true", help="print the tool list as JSON and exit")
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)
    if args.list_tools:
        print(json.dumps(tools(), indent=2))
        return 0
    sys.stdout.flush()
    out = open(sys.stdout.fileno(), "w", encoding="utf-8", closefd=False)
    sys.stdout = sys.stderr
    stdin = open(sys.stdin.fileno(), "r", encoding="utf-8", closefd=False)
    server = Server(Engine(args.engine, "local" if args.local else "auto"), out)
    try:
        server.serve(stdin)
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
