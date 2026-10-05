"""A linked FIFO used by the production quality-check waiting line."""

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class Node:
    value: Any
    next: Optional["Node"] = None


class Queue:
    def __init__(self):
        self.head = None
        self.tail = None
        self.length = 0

    def enqueue(self, value):
        """Append at the tail in O(1) time."""
        node = Node(value)
        if self.tail is None:
            self.head = node
        else:
            self.tail.next = node
        self.tail = node
        self.length += 1
        return self.length

    def dequeue(self):
        """Remove the head in O(1) time; return None when empty."""
        if self.head is None:
            return None
        value = self.head.value
        self.head = self.head.next
        self.length -= 1
        if self.head is None:
            self.tail = None
        return value

    def peek(self):
        return None if self.head is None else self.head.value

    def is_empty(self):
        return self.length == 0

    def size(self):
        return self.length

    def clear(self):
        # Unlink explicitly: linear cleanup without a long chain of destructors.
        while not self.is_empty():
            self.dequeue()

    def to_list(self):
        values = []
        node = self.head
        while node is not None:
            values.append(node.value)
            node = node.next
        return values
