import os
import sys
from pathlib import Path

APP_ID = "ai.nodemode.formext"


def frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def resource_dir() -> Path:
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        return Path(meipass)
    return repo_root()


def backend_dir() -> Path:
    return Path(__file__).resolve().parents[2]


def repo_root() -> Path:
    return backend_dir().parent


def home() -> Path:
    env = os.environ.get("FORMEXT_HOME")
    if env:
        base = Path(env).expanduser()
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support" / APP_ID
    elif os.name == "nt":
        root = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Roaming")
        base = Path(root) / APP_ID
    else:
        xdg = os.environ.get("XDG_DATA_HOME")
        base = (Path(xdg) if xdg else Path.home() / ".local" / "share") / APP_ID
    base.mkdir(parents=True, exist_ok=True)
    return base


def sub(name: str) -> Path:
    folder = home() / name
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def projects_dir() -> Path:
    return sub("projects")


def builds_dir() -> Path:
    return sub("builds")


def keys_dir() -> Path:
    return sub("keys")


def trash_dir() -> Path:
    return sub("trash")


def settings_file() -> Path:
    return home() / "settings.json"


def index_file() -> Path:
    return home() / "projects.json"


def _bundled(name: str) -> Path:
    packed = resource_dir() / name
    if packed.exists():
        return packed
    return repo_root() / name


def contract_dir() -> Path:
    return _bundled("contract")


def templates_dir() -> Path:
    return _bundled("templates")


def docs_dir() -> Path:
    return _bundled("docs")


def frontend_dist() -> Path | None:
    env = os.environ.get("FORMEXT_DIST")
    candidates = [Path(env)] if env else []
    candidates += [resource_dir() / "frontend_dist", repo_root() / "frontend" / "dist"]
    for candidate in candidates:
        if (candidate / "index.html").is_file():
            return candidate
    return None


def contract_import_paths() -> list[Path]:
    root = contract_dir()
    return [root / "host" / "python", root / "tools"]


def use_contract() -> None:
    for folder in contract_import_paths():
        text = str(folder)
        if folder.is_dir() and text not in sys.path:
            sys.path.insert(0, text)
