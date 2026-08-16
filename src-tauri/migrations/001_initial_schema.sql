-- 1. Connected Accounts (Google / Local)
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL DEFAULT 'google',
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
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- 3. Calendar Events & Tasks
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY NOT NULL,
    calendar_id TEXT NOT NULL,
    google_event_id TEXT,
    recurring_event_id TEXT, -- References parent event id if this is an exception
    title TEXT NOT NULL DEFAULT '(No Title)',
    description TEXT,
    location TEXT,
    meeting_url TEXT,
    
    -- Timestamps stored in ISO 8601 UTC strings: "YYYY-MM-DDTHH:MM:SSZ"
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_all_day INTEGER NOT NULL DEFAULT 0,
    time_zone TEXT NOT NULL DEFAULT 'UTC',
    
    -- Recurrence & Status
    rrule TEXT, -- RFC 5545 format, e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR"
    original_start_time TEXT, -- Original timestamp for recurring exceptions
    status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'tentative' | 'cancelled'
    busy_status TEXT NOT NULL DEFAULT 'busy', -- 'busy' | 'free'
    
    -- Notion-like Custom Overrides
    color_override TEXT,
    
    -- Sync Metadata
    sync_status TEXT NOT NULL DEFAULT 'synced', -- 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete'
    etag TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

-- 4. Google Sync Tracking Tokens
CREATE TABLE IF NOT EXISTS sync_tokens (
    calendar_id TEXT PRIMARY KEY NOT NULL,
    next_sync_token TEXT,
    last_synced_at TEXT,
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

-- 5. Indexes for fast range queries and lookups
CREATE INDEX IF NOT EXISTS idx_events_range ON events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_events_calendar ON events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_sync_status ON events(sync_status);
CREATE INDEX IF NOT EXISTS idx_events_recurring ON events(recurring_event_id);