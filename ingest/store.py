from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Iterable, List, Dict, Any

import duckdb


class EventTimeStore:
    """DuckDB-backed event-time store. All reads enforce arrival_time <= t."""

    def __init__(self, db_path: str | Path = "data/ingest.duckdb", parquet_dir: str | Path = "data/parquet"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.parquet_dir = Path(parquet_dir)
        self.parquet_dir.mkdir(parents=True, exist_ok=True)
        self.con = duckdb.connect(str(self.db_path))
        self._init_schema()

    def _init_schema(self):
        self.con.execute(
            """
            CREATE TABLE IF NOT EXISTS records (
                source VARCHAR,
                stream VARCHAR,
                station_id VARCHAR,
                variable VARCHAR,
                value DOUBLE,
                unit VARCHAR,
                event_time BIGINT,
                arrival_time BIGINT,
                quality_flags VARCHAR
            )
            """
        )

    def insert(self, records: Iterable[Dict[str, Any]]):
        rows = []
        for r in records:
            rows.append((
                r["source"],
                r["stream"],
                r.get("station_id") or r.get("zone_id"),
                r["variable"],
                float(r["value"]) if r["value"] is not None else None,
                r["unit"],
                int(r["event_time"]),
                int(r["arrival_time"]),
                json.dumps(r.get("quality_flags", [])),
            ))
        if rows:
            self.con.executemany(
                "INSERT INTO records VALUES (?,?,?,?,?,?,?,?,?)", rows
            )

    def read_at(self, t: int, variable: str | None = None, station_id: str | None = None):
        q = "SELECT * FROM records WHERE arrival_time <= ?"
        params = [int(t)]
        if variable is not None:
            q += " AND variable = ?"
            params.append(variable)
        if station_id is not None:
            q += " AND station_id = ?"
            params.append(station_id)
        q += " ORDER BY arrival_time, event_time"
        return self.con.execute(q, params).fetchdf().to_dict("records")

    def watermark(self) -> int:
        res = self.con.execute("SELECT COALESCE(MAX(arrival_time), 0) FROM records").fetchone()[0]
        return int(res or 0)

    def reprocess_last_hours(self, now: int, hours: int = 6, minutes_per_hour: int = 60):
        window = hours * minutes_per_hour
        q = "SELECT * FROM records WHERE arrival_time <= ? AND event_time >= ?"
        df = self.con.execute(q, [int(now), int(now - window)]).fetchdf()
        return df.to_dict("records")

    def persist_parquet(self, path: str | Path | None = None):
        p = Path(path) if path else self.parquet_dir / "records.parquet"
        p.parent.mkdir(parents=True, exist_ok=True)
        self.con.execute(f"COPY records TO '{p}' (FORMAT PARQUET)")
        return p

    def close(self):
        self.con.close()
