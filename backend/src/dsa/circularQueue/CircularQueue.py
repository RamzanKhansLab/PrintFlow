"""A bounded ring buffer for each printer's waiting jobs."""


class CircularQueue:
    def __init__(self, capacity):
        if type(capacity) is not int or capacity < 1:
            raise ValueError("Capacity must be a positive integer")
        self.capacity = capacity
        self.clear()

    def enqueue(self, value):
        if self.is_full():
            raise OverflowError("Circular queue is full")
        self.buffer[self.rear] = value
        self.rear = (self.rear + 1) % self.capacity
        self.length += 1
        return self.length

    def dequeue(self):
        if self.is_empty():
            return None
        value = self.buffer[self.front]
        self.buffer[self.front] = None
        self.front = (self.front + 1) % self.capacity
        self.length -= 1
        return value

    def peek(self):
        return None if self.is_empty() else self.buffer[self.front]

    def is_full(self):
        return self.length == self.capacity

    def is_empty(self):
        return self.length == 0

    def size(self):
        return self.length

    def clear(self):
        self.buffer = [None] * self.capacity
        self.front = 0
        self.rear = 0  # Next insertion slot, not the last occupied slot.
        self.length = 0

    def to_list(self):
        return [self.buffer[(self.front + index) % self.capacity]
                for index in range(self.length)]

    def inspect(self):
        return {
            "capacity": self.capacity,
            "front": self.front,
            "rear": self.rear,
            "size": self.length,
            "slots": self.buffer.copy(),
            "items": self.to_list(),
        }
