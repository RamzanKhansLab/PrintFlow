"""Per-staff DSA lab instances using the production Python queue classes."""

from datetime import datetime, timezone
from time import monotonic

from .queue import Queue
from .priorityQueue import PriorityQueue
from .circularQueue import CircularQueue
from .errors import require


class DsaDemo:
    def __init__(self):
        self.sessions = {}

    def _session(self, user_id):
        now = monotonic()
        for key in list(self.sessions):
            if now - self.sessions[key]["touched"] > 3600:
                del self.sessions[key]
        key = str(user_id)
        if key not in self.sessions:
            require(len(self.sessions) < 100, 429, "The demonstration is busy; try again later")
            self.sessions[key] = {"fifo": Queue(), "priority": PriorityQueue(),
                                  "circular": CircularQueue(5)}
        state = self.sessions[key]
        state["touched"] = now
        return state

    def inspect(self, user_id):
        state = self._session(user_id)
        return {
            "fifo": state["fifo"].to_list(),
            "priority": {"heap": state["priority"].to_list(),
                         "ordered": state["priority"].ordered()},
            "circular": state["circular"].inspect(),
        }

    def operate(self, user_id, data):
        structure, operation = data["structure"], data["operation"]
        require(structure in ("fifo", "priority", "circular"), 400, "Unknown structure")
        require(operation in ("enqueue", "dequeue", "peek", "clear"), 400, "Unknown operation")
        queue = self._session(user_id)[structure]
        if operation == "enqueue":
            require(data.get("job"), 400, "Enter a job to enqueue")
            require(queue.size() < (5 if structure == "circular" else 30),
                    409, "The demonstration queue is full")
            result = queue.enqueue({**data["job"], "createdAt": datetime.now(timezone.utc).isoformat()})
        elif operation == "dequeue":
            result = queue.dequeue()
        elif operation == "peek":
            result = queue.peek()
        else:
            result = queue.clear()
        if operation == "clear":
            complexity = "O(c)" if structure == "circular" else "O(n)"
        elif structure == "priority" and operation in ("enqueue", "dequeue"):
            complexity = "O(log n)"
        else:
            complexity = "O(1)"
        return {"result": result, "operation": operation, "structure": structure,
                "state": self.inspect(user_id), "complexity": complexity}
