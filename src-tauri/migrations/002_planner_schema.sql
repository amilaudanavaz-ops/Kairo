CREATE TABLE IF NOT EXISTS kflow_tasks (
    id TEXT PRIMARY KEY,
    date_key TEXT NOT NULL,
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kflow_sessions (
    id TEXT PRIMARY KEY,
    date_key TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned',
    overtime_minutes INTEGER NOT NULL DEFAULT 0,
    layout TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kflow_tasks_date ON kflow_tasks(date_key);
CREATE INDEX IF NOT EXISTS idx_kflow_sessions_date ON kflow_sessions(date_key);