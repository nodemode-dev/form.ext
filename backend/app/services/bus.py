import asyncio
import threading
import time
from typing import Any


class Bus:
    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._clients: set[asyncio.Queue] = set()
        self._lock = threading.Lock()

    def attach(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        with self._lock:
            self._clients.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        with self._lock:
            self._clients.discard(queue)

    def clients(self) -> int:
        with self._lock:
            return len(self._clients)

    def _deliver(self, message: dict) -> None:
        with self._lock:
            targets = list(self._clients)
        for queue in targets:
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                pass

    def emit(self, name: str, data: Any = None) -> None:
        message = {"name": name, "data": data, "at": time.time()}
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is loop:
            self._deliver(message)
        else:
            loop.call_soon_threadsafe(self._deliver, message)


bus = Bus()
