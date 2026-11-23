# Testing form.ext

form.ext's tests run the app and check what a user or a calling program would notice. This page says how to run them, where they live and what a test must do to be accepted.

## Running the tests

```sh
./formext test                       # every layer
./formext test engine                # one layer: unit or engine
./formext test engine -k consent     # the rest of the line goes to the runner
```

On Windows use `formext.bat test` from a shell that has `bash` (Git for Windows). Run `./formext install` first. The engine tests also need pytest and httpx in the backend venv; the runner says so when they are missing:

```sh
backend/venv/bin/python -m pip install pytest httpx
```

An unknown layer exits 2 with a sentence. The runner is `setup/test`.

## The layers

| Layer | Tool | Where | What it runs against |
| --- | --- | --- | --- |
| unit | vitest, happy-dom | `frontend/tests/unit/` | exported interface functions and stores, no browser |
| engine | pytest | `tests/` | the real engine: the FastAPI app in process, the command line, the MCP server and the setup scripts, with a scratch home and data folder |

Tests are grouped by area, one folder for each: an area's engine tests live in `tests/<area>/` and its interface tests in `frontend/tests/unit/<area>/`. Interface test files end in `.test.ts`; engine test files are named `test_*.py`. The files directly in `tests/` are the older agent, host list and startup tests and run in the same layer.

## What the shared base gives a test

`tests/stand_ins.py` is imported first by every engine test file. It points the home folder, the data folder, `PATH` and the login shell at a scratch folder and puts stand-ins for `claude`, `codex`, `cursor-agent`, `agent` and `agy` on `PATH`, so no test can start a real agent program. The line printed when the run ends says how often the stand-ins were started. A test reaches the engine by putting `backend/` on `sys.path` and importing the app, or by starting `backend/formext_engine.py` as a process:

```python
import stand_ins

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
```

`frontend/vitest.config.ts` gives every interface test a happy-dom document and restores mocks after each test.

## The five rules

1. The test runs the app through a public surface: an HTTP route, a command through the command runner, an MCP tool, a worker request, an exported interface function, or the visible interface in a browser.
2. It checks a result a user or a calling program would notice: geometry, a number, a saved or exported file, a refusal, an undo, something on screen.
3. Its expected value comes from outside the code under test: mathematics, the rules of a file format checked by an independent reader, the manual and the format documents in `docs/`, an invariant (undo then redo, save then open, export then import), two independent paths that must agree, or a fixture that states its own content.
4. It can fail. Change the expected value once, see the test fail, and change it back.
5. Its name says the behaviour in plain words.

Not accepted:

- reading source files to check text, spelling, comments or formatting;
- checks that a file, function, class or route merely exists;
- a check of the status code alone, with nothing checked in the answer;
- snapshot files made by running the code and saving what came out;
- replacing the thing under test with a stand-in and testing the stand-in;
- a skip or an expected failure without a written reason.

## When a test shows the app is wrong

Do not bend the test. Keep it and mark it as a strict expected failure with a reason that starts with `DEFECT:` and says what the app does, what it should do and where that is stated. `git grep -n "DEFECT:" tests frontend/tests` lists the known ones. When the app is fixed, the strict mark makes the test fail until the mark is removed, so a fix cannot go unnoticed.

## Changing behaviour

Tests are added when the owner asks. A change in behaviour updates its tests in the same pull request. Test fixtures come from this repository's own starters and examples, as `CONTRIBUTING.md` says, and no test names or copies another product.

## CI

Every pull request runs one job, `test`, on Linux. It makes `backend/venv`, installs `backend/requirements.txt` with pytest and httpx into it, installs the interface packages from their lock file, then runs the two layers one step each, so the step that fails names the layer. The tests do not run on macOS or Windows in CI.
