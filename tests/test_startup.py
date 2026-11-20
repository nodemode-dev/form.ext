import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

import stand_ins

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
POSIX = os.name == "posix"
ENGINE = POSIX and all(importlib.util.find_spec(name) for name in ("fastapi", "uvicorn"))
FROZEN = "import sys\nsys.frozen = True\nsys.executable = {engine!r}\nsys.argv = ['formext-engine']\nimport formext_engine as e\nsys.exit(e.main())\n"


def stand_in():
    return subprocess.Popen(["sleep", "120"])


def stop(*procs):
    for proc in procs:
        if proc.poll() is None:
            proc.kill()
        proc.wait(timeout=10)


def engine_env(data, **more):
    env = {k: v for k, v in os.environ.items() if not k.startswith("FORMEXT_")}
    env.update(FORMEXT_HOME=str(data), FORMEXT_PORT="0", PYTHONUNBUFFERED="1", **more)
    return env


def wait_for(check, seconds=20.0):
    until = time.monotonic() + seconds
    while time.monotonic() < until:
        if check():
            return True
        time.sleep(0.1)
    return False


def record(startup, engine, shell):
    return {"pid": engine.pid, "started": int(time.time()), "born": startup.created(engine.pid), "shell": shell.pid, "shellBorn": startup.created(shell.pid)}


class Scratch(unittest.TestCase):
    def setUp(self):
        self.assertTrue(stand_ins.SANDBOX.is_dir())
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.tmp = Path(self.folder.name).resolve()


@unittest.skipUnless(POSIX, "the stand-in programs are POSIX ones")
class Lock(Scratch):
    def setUp(self):
        super().setUp()
        from app.services import startup

        self.startup = startup
        self.lock = self.tmp / startup.LOCK_NAME

    def test_a_holder_whose_shell_is_alive_is_respected(self):
        engine, shell, mine = stand_in(), stand_in(), stand_in()
        try:
            self.lock.write_text(json.dumps(record(self.startup, engine, shell)))
            with self.assertRaises(self.startup.Busy) as refused:
                self.startup.claim(self.tmp, mine.pid)
            self.assertIn(f"is already running on {self.tmp} (engine process {engine.pid})", str(refused.exception))
            self.assertIsNone(engine.poll())
        finally:
            stop(engine, shell, mine)

    def test_a_holder_whose_shell_is_gone_is_ended_and_replaced(self):
        engine, shell, mine = stand_in(), stand_in(), stand_in()
        try:
            self.lock.write_text(json.dumps(record(self.startup, engine, shell)))
            stop(shell)
            path, replaced = self.startup.claim(self.tmp, mine.pid)
            self.assertEqual(replaced, engine.pid)
            self.assertIsNotNone(engine.wait(timeout=10))
            now = json.loads(path.read_text())
            self.assertEqual((now["pid"], now["shell"]), (os.getpid(), mine.pid))
            self.assertTrue(now["born"] > 0 and now["shellBorn"] > 0)
        finally:
            stop(engine, shell, mine)

    def test_a_holder_that_recorded_no_shell_is_replaced_only_by_an_engine_with_a_shell(self):
        engine, mine = stand_in(), stand_in()
        try:
            self.lock.write_text(json.dumps({"pid": engine.pid, "started": int(time.time())}))
            with self.assertRaises(self.startup.Busy):
                self.startup.claim(self.tmp, 0)
            self.assertIsNone(engine.poll())
            self.assertEqual(self.startup.claim(self.tmp, mine.pid)[1], engine.pid)
            self.assertIsNotNone(engine.wait(timeout=10))
        finally:
            stop(engine, mine)

    def test_a_damaged_lock_is_replaced(self):
        for text in ("not json at all", "[1, 2]", '{"pid": "x"}', ""):
            with self.subTest(text=text):
                self.lock.write_text(text)
                path, replaced = self.startup.claim(self.tmp, 0)
                self.assertEqual(replaced, 0)
                self.assertEqual(json.loads(path.read_text())["pid"], os.getpid())

    def test_a_lock_that_names_a_process_which_is_not_the_engine_is_replaced_and_the_process_is_left_alone(self):
        other, mine = stand_in(), stand_in()
        try:
            for held in ({"pid": other.pid, "started": int(time.time()) - 86400}, {"pid": other.pid, "started": 5, "born": 12345.5, "shell": 999999, "shellBorn": 5.0}):
                self.lock.write_text(json.dumps(held))
                self.assertEqual(self.startup.claim(self.tmp, mine.pid)[1], 0)
                self.assertIsNone(other.poll())
            self.lock.write_text(json.dumps({"pid": other.pid}))
            with self.assertRaises(self.startup.Busy):
                self.startup.claim(self.tmp, mine.pid)
            self.assertIsNone(other.poll())
        finally:
            stop(other, mine)

    def test_the_two_ways_of_reading_a_start_time_agree(self):
        first = self.startup.created(os.getpid())
        saved = self.startup.PROC
        self.startup.PROC = "/nonexistent"
        try:
            second = self.startup.created(os.getpid())
        finally:
            self.startup.PROC = saved
        self.assertTrue(first > 0 and abs(first - second) <= self.startup.SLACK)
        self.assertEqual(self.startup.created(4_000_000), 0.0)

    def test_a_holder_that_has_ended_and_was_not_collected_counts_as_gone_where_there_is_no_proc(self):
        engine, shell, mine = stand_in(), stand_in(), stand_in()
        saved = self.startup.PROC
        try:
            self.lock.write_text(json.dumps(record(self.startup, engine, shell)))
            stop(shell)
            self.startup.PROC = str(self.tmp / "no-proc")
            self.assertFalse(self.startup.finished(engine.pid))
            began = time.monotonic()
            self.assertEqual(self.startup.claim(self.tmp, mine.pid)[1], engine.pid)
            self.assertLess(time.monotonic() - began, self.startup.END_WAIT)
            self.assertTrue(self.startup.finished(engine.pid))
            self.startup.PROC = saved
            self.assertFalse(self.startup.finished(engine.pid))
        finally:
            self.startup.PROC = saved
            stop(engine, shell, mine)


@unittest.skipUnless(ENGINE, "needs the engine's packages (run with the backend's Python) and a POSIX shell")
class Entry(Scratch):
    def test_the_engine_serves_and_logs_with_its_three_streams_closed(self):
        proc = subprocess.Popen(["sh", "-c", 'exec "$0" formext_engine.py <&- >&- 2>&-', sys.executable], cwd=BACKEND, env=engine_env(self.tmp))
        log = self.tmp / "Logs" / "formext-engine.log"
        try:
            self.assertTrue(wait_for(lambda: (self.tmp / "engine.port").is_file() and log.is_file() and "Uvicorn running on http://127.0.0.1:" in log.read_text()))
            self.assertTrue(log.read_text().splitlines()[0].endswith(f"engine started, pid {proc.pid}, data folder {self.tmp}"))
            self.assertTrue((self.tmp / "Logs" / "formext-engine-errors.log").is_file())
        finally:
            proc.terminate()
            proc.wait(timeout=10)
        self.assertFalse((self.tmp / "engine.lock").exists() or (self.tmp / "engine.port").exists())

    def test_a_second_engine_is_refused_while_the_first_ones_shell_lives(self):
        first_shell, second_shell = stand_in(), stand_in()
        first = subprocess.Popen([sys.executable, "formext_engine.py"], cwd=BACKEND, env=engine_env(self.tmp, FORMEXT_SHELL_PID=str(first_shell.pid)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            self.assertTrue(wait_for(lambda: (self.tmp / "engine.port").is_file()))
            second = subprocess.run([sys.executable, "formext_engine.py"], cwd=BACKEND, env=engine_env(self.tmp, FORMEXT_SHELL_PID=str(second_shell.pid)), capture_output=True, text=True, timeout=30)
            self.assertEqual(second.returncode, 2)
            self.assertIn(f"formext is already running on {self.tmp} (engine process {first.pid}).", second.stderr)
            self.assertIsNone(first.poll())
            self.assertEqual(json.loads((self.tmp / "engine.lock").read_text())["pid"], first.pid)
            self.assertIn("is already running on", (self.tmp / "Logs" / "formext-engine.log").read_text())
        finally:
            stop(first_shell, second_shell)
            first.wait(timeout=10)

    def test_the_engine_stops_when_the_shell_it_was_given_ends(self):
        shell = stand_in()
        proc = subprocess.Popen([sys.executable, "formext_engine.py"], cwd=BACKEND, env=engine_env(self.tmp, FORMEXT_SHELL_PID=str(shell.pid)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            self.assertTrue(wait_for(lambda: (self.tmp / "engine.port").is_file()))
            self.assertEqual(json.loads((self.tmp / "engine.lock").read_text())["shell"], shell.pid)
            stop(shell)
            self.assertEqual(proc.wait(timeout=10), 0)
            self.assertFalse((self.tmp / "engine.lock").exists())
        finally:
            stop(shell, proc)

    def test_a_frozen_engine_started_alone_opens_the_app_beside_it_and_serves_nothing(self):
        install, data, mark = self.tmp / "install", self.tmp / "data", self.tmp / "opened"
        install.mkdir()
        data.mkdir()
        app = install / "formext"
        app.write_text(f'#!/bin/sh\nprintf "%s" "$(pwd)" > "{mark}"\n')
        app.chmod(0o755)
        code = FROZEN.format(engine=str(install / "formext-engine"))
        done = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, env=engine_env(data), capture_output=True, text=True, timeout=30)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertTrue(wait_for(lambda: mark.is_file() and mark.read_text() == str(install), 10))
        self.assertFalse((data / "engine.lock").exists() or (data / "engine.port").exists())
        self.assertIn("started without its app", (data / "Logs" / "formext-engine.log").read_text())

    def test_a_frozen_engine_started_alone_with_no_app_near_it_says_so_and_serves_nothing(self):
        data = self.tmp / "data"
        data.mkdir()
        code = FROZEN.format(engine=str(self.tmp / "engine" / "formext-engine"))
        done = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, env=engine_env(data), capture_output=True, text=True, timeout=30)
        self.assertEqual(done.returncode, 4)
        self.assertIn("serves nothing on its own", done.stderr)
        self.assertFalse((data / "engine.lock").exists())


if __name__ == "__main__":
    unittest.main()
