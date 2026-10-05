"""Private JSON-lines bridge over stdin/stdout. No network port or pip packages."""

import json
import sys
import traceback

from .demo import DsaDemo
from .errors import DsaError
from .scheduler import PrintScheduler, priority_for


def main():
    if sys.version_info < (3, 10):
        raise RuntimeError("PrintFlow requires Python 3.10 or newer")
    scheduler = PrintScheduler()
    demo = DsaDemo()
    operations = {
        "ping": lambda p: {"python": sys.version.split()[0]},
        "restore": lambda p: scheduler.restore(p["printers"], p["jobs"], p["qcJobs"]),
        "priority": lambda p: priority_for(p["config"], p.get("reprint", False)),
        "enqueue": lambda p: scheduler.enqueue(p["job"]),
        "remove_pending": lambda p: scheduler.remove_pending(p["id"]),
        "add_printer": lambda p: scheduler.add_printer(p["printer"]),
        "station": lambda p: scheduler.station(p["id"]),
        "set_printer_status": lambda p: scheduler.set_printer_status(p["printer"]),
        "plan_dispatch": lambda p: scheduler.plan_dispatch(),
        "confirm_assignment": lambda p: scheduler.confirm_assignment(p["job"]),
        "start_print": lambda p: scheduler.start_print(p["job"]),
        "progress": lambda p: scheduler.progress(p["job"]),
        "finish_print": lambda p: scheduler.finish_print(p["job"]),
        "quality_check": lambda p: scheduler.quality_check(),
        "start_quality_check": lambda p: scheduler.start_quality_check(p["job"]),
        "finish_quality_check": lambda p: scheduler.finish_quality_check(p["job"]),
        "snapshot": lambda p: scheduler.snapshot(),
        "demo_inspect": lambda p: demo.inspect(p["userId"]),
        "demo_operate": lambda p: demo.operate(p["userId"], p["data"]),
    }
    for line in sys.stdin:
        request_id = None
        try:
            request = json.loads(line)
            request_id = request["id"]
            operation = operations.get(request["operation"])
            if operation is None:
                raise DsaError(400, "Unknown DSA operation")
            result = operation(request.get("payload", {}))
            response = {"id": request_id, "result": result}
        except DsaError as error:
            response = {"id": request_id, "error": str(error), "status": error.status}
        except Exception:
            traceback.print_exc(file=sys.stderr)
            response = {"id": request_id, "error": "Python DSA operation failed; refresh before retrying", "status": 503}
        sys.stdout.write(json.dumps(response, ensure_ascii=False, allow_nan=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
