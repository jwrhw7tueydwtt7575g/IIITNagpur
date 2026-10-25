"""Future-data leakage guards."""

class LeakageError(Exception):
    pass


def assert_no_future_data(records, current_t, time_field="t"):
    for r in records:
        if r.get(time_field, 0) > current_t:
            raise LeakageError(f"Future record at t={r.get(time_field)} > current t={current_t}")


def filter_past(records, current_t, time_field="t"):
    return [r for r in records if r.get(time_field, 0) <= current_t]
