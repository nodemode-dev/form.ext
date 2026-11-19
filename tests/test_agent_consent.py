import sys
import threading
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.services import consent


class Recorder:
    def __init__(self):
        self.events = []

    def emit(self, name, data=None):
        self.events.append((name, data))

    def wait(self, name, timeout=5.0):
        end = time.time() + timeout
        while time.time() < end:
            found = [d for n, d in self.events if n == name]
            if found:
                return found[-1]
            time.sleep(0.01)
        return None


class AgentConsent(unittest.TestCase):
    def setUp(self):
        self.saved = (consent.access, consent.bus, consent.WAIT)
        self.bus = Recorder()
        consent.bus = self.bus
        consent.window_opened()

    def tearDown(self):
        consent.access, consent.bus, consent.WAIT = self.saved
        consent.window_closed()

    def mode(self, value):
        consent.access = lambda: value

    def call(self, agent="probe agent", args=None):
        box = {}

        def run():
            mark = consent.from_agent(agent)
            try:
                box["answer"] = consent.check("new", "New extension", args or {})
            finally:
                consent.end_agent(mark)

        thread = threading.Thread(target=run)
        thread.start()
        return box, thread

    def test_a_request_carries_what_the_dialog_needs_and_deny_refuses(self):
        self.mode("ask")
        box, thread = self.call("probe agent", {"id": "beat-markers"})
        asked = self.bus.wait("agents.ask")
        self.assertEqual(set(asked), {"id", "expires"})
        item = consent.pending()[0]
        self.assertEqual(item["id"], asked["id"])
        self.assertEqual(item["agent"], "probe agent")
        self.assertEqual(item["what"], "run New extension (new) in the project beat-markers")
        self.assertEqual(item["answers"], ["deny", "once", "always"])
        self.assertEqual(item["always"], "all")
        self.assertEqual(item["expires"], asked["expires"])
        self.assertAlmostEqual(item["expires"] - item["at"], consent.WAIT, places=3)
        self.assertEqual((item["tool"], item["title"], item["project"]), ("new", "New extension", "beat-markers"))
        self.assertTrue(consent.answer(item["id"], "deny"))
        thread.join(5)
        self.assertEqual(box["answer"], consent.DENIED)
        self.assertEqual(self.bus.wait("agents.answered"), {"id": item["id"], "reason": "answered"})
        self.assertEqual(consent.pending(), [])

    def test_once_runs_this_call_and_the_next_call_asks_again(self):
        self.mode("ask")
        box, thread = self.call()
        first = self.bus.wait("agents.ask")["id"]
        self.assertTrue(consent.answer(first, "once"))
        thread.join(5)
        self.assertIsNone(box["answer"])
        self.bus.events.clear()
        box, thread = self.call()
        second = self.bus.wait("agents.ask")["id"]
        self.assertNotEqual(second, first)
        self.assertEqual([r["id"] for r in consent.pending()], [second])
        self.assertTrue(consent.answer(second, "deny"))
        thread.join(5)
        self.assertEqual(box["answer"], consent.DENIED)

    def test_a_request_nobody_answers_is_withdrawn_by_id(self):
        self.mode("ask")
        consent.WAIT = 0.2
        box, thread = self.call()
        asked = self.bus.wait("agents.ask")
        thread.join(5)
        self.assertEqual(box["answer"], consent.TIMED_OUT)
        self.assertEqual(self.bus.wait("agents.answered"), {"id": asked["id"], "reason": "expired"})
        self.assertEqual(consent.pending(), [])
        self.assertFalse(consent.answer(asked["id"], "once"))


if __name__ == "__main__":
    unittest.main()
