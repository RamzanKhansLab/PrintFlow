"""Production scheduling algorithms; Node handles database commits and sockets."""

from ..queue import Queue
from ..priorityQueue import PriorityQueue
from ..circularQueue import CircularQueue
from ..errors import require


def priority_for(config, reprint=False):
    return (100 if config["urgency"] == "rush" else 10) + (20 if reprint else 0)


def compatible(printer, job):
    config = job["config"]
    return ((not config["color"] or printer["color"])
            and (not config["duplex"] or printer["duplex"])
            and config["paperSize"] in printer["paperSizes"])


class PrintScheduler:
    def __init__(self):
        self.pending = PriorityQueue()
        self.qc = Queue()
        self.stations = {}
        self.qc_active = None
        self.planned = {}
        self.ready = False

    def restore(self, printers, jobs, qc_jobs):
        """Input lists follow persisted assignment/completion order from MongoDB."""
        self.ready = False
        self.pending.clear()
        self.qc.clear()
        self.stations.clear()
        self.qc_active = None
        self.planned.clear()
        requeued = []
        for printer in printers:
            self.add_printer(printer)
        for job in jobs:
            status = job["status"]
            if status == "QUEUED":
                self.pending.enqueue(job)
            elif status == "ASSIGNED":
                station = self.stations.get(str(job.get("printer")))
                if station and not station["buffer"].is_full():
                    station["buffer"].enqueue(job)
                else:
                    job.update(status="QUEUED", printer=None, assignedAt=None)
                    self.pending.enqueue(job)
                    requeued.append(job["_id"])
            elif status == "PRINTING":
                station = self.stations.get(str(job.get("printer")))
                require(station is not None and station["active"] is None, 503,
                        "Inconsistent active printer jobs require database repair")
                station["active"] = job
            elif status == "QUALITY_CHECK":
                require(self.qc_active is None, 503,
                        "Multiple active quality checks require database repair")
                self.qc_active = job
        for job in qc_jobs:
            self.qc.enqueue(job)
        self.ready = True
        return requeued

    def _station(self, printer_id):
        station = self.stations.get(str(printer_id))
        require(station is not None, 404, "Printer not found")
        return station

    def add_printer(self, printer):
        self.stations[str(printer["_id"])] = {
            "printer": printer,
            "buffer": CircularQueue(printer["capacity"]),
            "active": None,
        }

    def station(self, printer_id):
        station = self._station(printer_id)
        return {"printer": station["printer"], "active": station["active"],
                "next": station["buffer"].peek()}

    def choose_printer(self, job):
        best, load = None, float("inf")
        for station in self.stations.values():
            if (station["printer"]["status"] != "online"
                    or station["buffer"].is_full()
                    or not compatible(station["printer"], job)):
                continue
            candidate = station["buffer"].size() + (1 if station["active"] else 0)
            if candidate < load:
                best, load = station, candidate
        return best

    def plan_dispatch(self):
        """Move heap roots into rings. Node must persist/confirm or restore."""
        require(not self.planned, 503, "Unconfirmed assignments require recovery")
        waiting = PriorityQueue()
        assignments = []
        while not self.pending.is_empty():
            job = self.pending.dequeue()
            station = self.choose_printer(job)
            if station is None:
                waiting.enqueue(job)
                continue
            job.update(status="ASSIGNED", printer=station["printer"]["_id"])
            station["buffer"].enqueue(job)
            self.planned[str(job["_id"])] = job
            assignments.append({"jobId": job["_id"], "printerId": job["printer"]})
        self.pending = waiting
        return assignments

    def confirm_assignment(self, job):
        reference = self.planned.pop(str(job["_id"]), None)
        require(reference is not None, 503, "Unknown assignment requires recovery")
        reference.update(job)

    def enqueue(self, job):
        self.pending.enqueue(job)

    def remove_pending(self, job_id):
        retained = PriorityQueue()
        while not self.pending.is_empty():
            job = self.pending.dequeue()
            if str(job["_id"]) != str(job_id):
                retained.enqueue(job)
        self.pending = retained
        for station in self.stations.values():
            buffer = station["buffer"]
            for _ in range(buffer.size()):
                job = buffer.dequeue()
                if str(job["_id"]) != str(job_id):
                    buffer.enqueue(job)

    def set_printer_status(self, printer):
        station = self._station(printer["_id"])
        station["printer"] = printer
        requeued = []
        if printer["status"] != "online":
            while not station["buffer"].is_empty():
                job = station["buffer"].dequeue()
                job.update(status="QUEUED", printer=None, assignedAt=None)
                self.pending.enqueue(job)
                requeued.append(job)
        return requeued

    def start_print(self, job):
        station = self._station(job["printer"])
        head = station["buffer"].peek()
        require(head is not None and head["_id"] == job["_id"]
                and station["active"] is None, 409, "Printer head changed")
        station["buffer"].dequeue()
        station["active"] = job

    def progress(self, job):
        station = self._station(job["printer"])
        require(station["active"] and station["active"]["_id"] == job["_id"],
                409, "Printer active job changed")
        station["active"] = job

    def finish_print(self, job):
        station = self._station(job["printer"])
        require(station["active"] and station["active"]["_id"] == job["_id"],
                409, "Printer active job changed")
        station["active"] = None
        if job["status"] == "PRINTED":
            self.qc.enqueue(job)

    def quality_check(self):
        return {"active": self.qc_active, "next": self.qc.peek()}

    def start_quality_check(self, job):
        head = self.qc.peek()
        require(self.qc_active is None and head is not None
                and head["_id"] == job["_id"], 409, "Quality check head changed")
        self.qc.dequeue()
        self.qc_active = job

    def finish_quality_check(self, job):
        require(self.qc_active and self.qc_active["_id"] == job["_id"],
                409, "Quality check active job changed")
        self.qc_active = None

    def snapshot(self):
        require(self.ready and not self.planned, 503, "Scheduler is recovering")
        return {
            "ready": True,
            "pending": self.pending.ordered(),
            "heap": self.pending.to_list(),
            "stations": [
                {"printer": station["printer"], "buffer": station["buffer"].inspect(),
                 "active": station["active"]}
                for station in self.stations.values()
            ],
            "qualityCheck": {"waiting": self.qc.to_list(), "active": self.qc_active},
        }
