-- 1. Connected Accounts (Google / Local)
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT 'google',
    avatar_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sync_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Calendars / Categories
CREATE TABLE IF NOT EXISTS calendars (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL,
    google_calendar_id TEXT,
    name TEXT NOT NULL,
    color_id TEXT NOT NULL DEFAULT 'charcoal',
    color_hex TEXT NOT NULL DEFAULT '#3b82f6',
    is_primary INTEGER NOT NULL DEFAULT 0,
    is_visible INTEGER NOT NULL DEFAULT 1,
    access_role TEXT NOT NULL DEFAULT 'owner',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    UNIQUE (account_id, google_calendar_id)
);

-- 3. Calendar Events & Tasks
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY NOT NULL,
    calendar_id TEXT NOT NULL,
    google_event_id TEXT,
    recurring_event_id TEXT,
    title TEXT NOT NULL DEFAULT '(No Title)',
    description TEXT,
    location TEXT,
    meeting_url TEXT,
    conferencing_provider TEXT DEFAULT 'google_meet',
    
    -- Timestamps stored in ISO 8601 UTC strings: "YYYY-MM-DDTHH:MM:SSZ"
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_all_day INTEGER NOT NULL DEFAULT 0,
    time_zone TEXT NOT NULL DEFAULT 'UTC',
    
    -- Recurrence & Status
    rrule TEXT,
    exdates TEXT,
    until_date TEXT,
    original_start_time TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed',
    busy_status TEXT NOT NULL DEFAULT 'busy',
    visibility TEXT NOT NULL DEFAULT 'default',
    reminders TEXT NOT NULL DEFAULT '["15m"]',
    
    -- Custom Overrides
    color_override TEXT,
    creator_email TEXT,
    participants TEXT,
    attachments TEXT,
    
    -- Sync Metadata
    sync_status TEXT NOT NULL DEFAULT 'synced',
    etag TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
    UNIQUE (calendar_id, google_event_id)
);

-- 4. Google Sync Tracking Tokens
CREATE TABLE IF NOT EXISTS sync_tokens (
    calendar_id TEXT PRIMARY KEY NOT NULL,
    next_sync_token TEXT,
    last_synced_at TEXT,
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

-- 5. Indexes for fast range queries and lookups
CREATE INDEX IF NOT EXISTS idx_calendars_account ON calendars(account_id);
CREATE INDEX IF NOT EXISTS idx_calendars_google_id ON calendars(google_calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_range ON events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_events_calendar ON events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_google_id ON events(google_event_id);
CREATE INDEX IF NOT EXISTS idx_events_sync_status ON events(sync_status);
CREATE INDEX IF NOT EXISTS idx_events_recurring ON events(recurring_event_id);