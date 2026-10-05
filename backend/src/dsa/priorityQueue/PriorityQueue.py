"""A custom stable binary heap. No heapq or sorted-list replacement."""

from datetime import datetime, timezone
from math import inf


def timestamp(value, fallback):
    if not value:
        return fallback
    if isinstance(value, datetime):
        parsed = value
    else:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


def compare_jobs(first, second):
    """Negative means first wins: score, deadline, arrival, then identifier."""
    def key(job):
        return (
            -job["priorityScore"],
            timestamp(job.get("deadline"), inf),
            timestamp(job.get("createdAt"), 0),
            str(job.get("_id", job.get("id", ""))),
        )

    first_key, second_key = key(first), key(second)
    return (first_key > second_key) - (first_key < second_key)


class PriorityQueue:
    def __init__(self, compare=compare_jobs):
        self.compare = compare
        self.heap = []
        self.sequence = 0

    def _before(self, first, second):
        order = self.compare(first[0], second[0])
        return order < 0 or (order == 0 and first[1] < second[1])

    def enqueue(self, value):
        self.heap.append((value, self.sequence))
        self.sequence += 1
        index = len(self.heap) - 1
        while index > 0:
            parent = (index - 1) // 2
            if not self._before(self.heap[index], self.heap[parent]):
                break
            self.heap[index], self.heap[parent] = self.heap[parent], self.heap[index]
            index = parent
        return self.size()

    def dequeue(self):
        if self.is_empty():
            return None
        first = self.heap[0][0]
        last = self.heap.pop()
        if self.heap:
            self.heap[0] = last
            index = 0
            while True:
                left, right = 2 * index + 1, 2 * index + 2
                best = index
                if left < self.size() and self._before(self.heap[left], self.heap[best]):
                    best = left
                if right < self.size() and self._before(self.heap[right], self.heap[best]):
                    best = right
                if best == index:
                    break
                self.heap[index], self.heap[best] = self.heap[best], self.heap[index]
                index = best
        return first

    def peek(self):
        return None if self.is_empty() else self.heap[0][0]

    def is_empty(self):
        return len(self.heap) == 0

    def size(self):
        return len(self.heap)

    def clear(self):
        self.heap.clear()
        self.sequence = 0

    def to_list(self):
        """Physical heap order; this is not the dequeue order."""
        return [entry[0] for entry in self.heap]

    def ordered(self):
        """Inspect removal order using a copied heap in O(n log n)."""
        copy = PriorityQueue(self.compare)
        copy.heap = self.heap.copy()
        copy.sequence = self.sequence
        values = []
        while not copy.is_empty():
            values.append(copy.dequeue())
        return values
