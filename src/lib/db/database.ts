import Database from '@tauri-apps/plugin-sql';
import type { 
  CalendarEvent, 
  CalendarCategory, 
  UserAccount, 
  ParticipantContact,
  SyncStatus
} from '../../types/event';

let dbInstance: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;

async function runInitMigrations(db: Database): Promise<void> {
  // 1. Settings Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 2. User Accounts Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      avatar_url TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sync_enabled INTEGER NOT NULL DEFAULT 1,
      access_token TEXT,
      refresh_token TEXT
    );
  `);

  // 3. Calendars Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS calendars (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      google_calendar_id TEXT,
      name TEXT NOT NULL,
      color_id TEXT,
      color_hex TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1,
      access_role TEXT NOT NULL DEFAULT 'owner'
    );
  `);

  // 4. Events Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      calendar_id TEXT NOT NULL,
      google_event_id TEXT,
      recurring_event_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      conferencing_url TEXT,
      conferencing_provider TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_all_day INTEGER NOT NULL DEFAULT 0,
      time_zone TEXT,
      rrule TEXT,
      exdates TEXT,
      until_date TEXT,
      status TEXT,
      busy_status TEXT,
      visibility TEXT,
      reminders TEXT,
      creator_email TEXT,
      participants TEXT,
      attachments TEXT,
      color_override TEXT,
      sync_status TEXT,
      updated_at TEXT
    );
  `);

  // 5. Contacts Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contacts (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar_url TEXT
    );
  `);

  // Non-destructive schema column migrations
  const migrations = [
    'ALTER TABLE events ADD COLUMN conferencing_url TEXT;',
    'ALTER TABLE events ADD COLUMN conferencing_provider TEXT;',
    'ALTER TABLE events ADD COLUMN until_date TEXT;',
    'ALTER TABLE events ADD COLUMN color_override TEXT;',
    'ALTER TABLE events ADD COLUMN participants TEXT;',
    'ALTER TABLE events ADD COLUMN attachments TEXT;',
    'ALTER TABLE events ADD COLUMN exdates TEXT;',
    'ALTER TABLE events ADD COLUMN rrule TEXT;',
    'ALTER TABLE events ADD COLUMN time_zone TEXT;',
    'ALTER TABLE events ADD COLUMN sync_status TEXT;',
    'ALTER TABLE events ADD COLUMN updated_at TEXT;'
  ];

  for (const migration of migrations) {
    try {
      await db.execute(migration);
    } catch {
      // Column already exists
    }
  }
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const db = await Database.load('sqlite:kairo.db');
      await runInitMigrations(db);
      dbInstance = db;
      return db;
    })();
  }
  return dbInitPromise;
}

export async function initDatabase(): Promise<Database> {
  return getDb();
}

/* ==========================================================================
   SETTINGS OPERATIONS
   ========================================================================== */

export async function loadDbSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(`SELECT key, value FROM settings;`);
  const result: Record<string, string> = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
}

export async function persistDbSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES (?1, ?2)
     ON CONFLICT(key) DO UPDATE SET value = ?2;`,
    [key, value]
  );
}

/* ==========================================================================
   ACCOUNT OPERATIONS
   ========================================================================== */

export async function loadDbAccounts(): Promise<UserAccount[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(`
    SELECT id, email, name, provider, avatar_url, is_primary, sync_enabled 
    FROM accounts 
    ORDER BY is_primary DESC, email ASC;
  `);

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    provider: r.provider,
    avatarUrl: r.avatar_url,
    isPrimary: Boolean(r.is_primary),
    syncEnabled: Boolean(r.sync_enabled)
  }));
}

export async function persistDbAccount(
  account: UserAccount, 
  accessToken?: string, 
  refreshToken?: string
): Promise<UserAccount> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO accounts (id, email, name, provider, avatar_url, is_primary, sync_enabled, access_token, refresh_token)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(id) DO UPDATE SET
       email = ?2,
       name = ?3,
       provider = ?4,
       avatar_url = ?5,
       is_primary = ?6,
       sync_enabled = ?7,
       access_token = COALESCE(?8, access_token),
       refresh_token = COALESCE(?9, refresh_token);`,
    [
      account.id,
      account.email,
      account.name,
      account.provider,
      account.avatarUrl || null,
      account.isPrimary ? 1 : 0,
      account.syncEnabled ? 1 : 0,
      accessToken || null,
      refreshToken || null
    ]
  );
  return account;
}

export async function deleteDbAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM accounts WHERE id = ?1;`, [id]);
  await db.execute(`DELETE FROM calendars WHERE account_id = ?1;`, [id]);
}

export async function clearAllDbAccounts(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM accounts;`);
  await db.execute(`DELETE FROM calendars;`);
  await db.execute(`DELETE FROM events;`);
}

export async function getAccountAccessToken(accountId: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ access_token: string | null }[]>(
    `SELECT access_token FROM accounts WHERE id = ?1 LIMIT 1;`,
    [accountId]
  );
  return rows[0]?.access_token || null;
}

export async function getAccountTokens(accountId: string): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const db = await getDb();
  const rows = await db.select<{ access_token: string | null; refresh_token: string | null }[]>(
    `SELECT access_token, refresh_token FROM accounts WHERE id = ?1 LIMIT 1;`,
    [accountId]
  );
  return {
    accessToken: rows[0]?.access_token || null,
    refreshToken: rows[0]?.refresh_token || null
  };
}

export async function loadAllAccountsWithTokens(): Promise<Array<UserAccount & { accessToken?: string; refreshToken?: string }>> {
  const db = await getDb();
  const rows = await db.select<any[]>(`
    SELECT id, email, name, provider, avatar_url, is_primary, sync_enabled, access_token, refresh_token 
    FROM accounts;
  `);

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    provider: r.provider,
    avatarUrl: r.avatar_url,
    isPrimary: Boolean(r.is_primary),
    syncEnabled: Boolean(r.sync_enabled),
    accessToken: r.access_token || undefined,
    refreshToken: r.refresh_token || undefined
  }));
}

export async function updateAccountTokens(accountId: string, accessToken: string, refreshToken?: string): Promise<void> {
  const db = await getDb();
  if (refreshToken) {
    await db.execute(
      `UPDATE accounts SET access_token = ?1, refresh_token = ?2 WHERE id = ?3;`,
      [accessToken, refreshToken, accountId]
    );
  } else {
    await db.execute(
      `UPDATE accounts SET access_token = ?1 WHERE id = ?2;`,
      [accessToken, accountId]
    );
  }
}

/* ==========================================================================
   CALENDAR CATEGORY OPERATIONS
   ========================================================================== */

export async function loadInitialCalendars(): Promise<CalendarCategory[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(`
    SELECT id, account_id, google_calendar_id, name, color_id, color_hex, is_primary, is_visible, access_role 
    FROM calendars 
    ORDER BY is_primary DESC, name ASC;
  `);

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    googleCalendarId: r.google_calendar_id || undefined,
    name: r.name,
    colorId: r.color_id || 'blue',
    colorHex: r.color_hex || '#3b82f6',
    isPrimary: Boolean(r.is_primary),
    isVisible: Boolean(r.is_visible),
    accessRole: r.access_role || 'owner'
  }));
}

export async function persistCalendarCategory(cal: CalendarCategory): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO calendars (id, account_id, google_calendar_id, name, color_id, color_hex, is_primary, is_visible, access_role)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(id) DO UPDATE SET
       account_id = ?2,
       google_calendar_id = ?3,
       name = ?4,
       color_id = ?5,
       color_hex = COALESCE(color_hex, ?6),
       is_primary = ?7,
       is_visible = COALESCE(is_visible, ?8),
       access_role = ?9;`,
    [
      cal.id,
      cal.accountId,
      cal.googleCalendarId || null,
      cal.name,
      cal.colorId || null,
      cal.colorHex,
      cal.isPrimary ? 1 : 0,
      cal.isVisible ? 1 : 0,
      cal.accessRole || 'owner'
    ]
  );
}

export async function updateCalendarVisibilityInDb(calendarId: string, isVisible: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE calendars SET is_visible = ?1 WHERE id = ?2 OR google_calendar_id = ?2;`,
    [isVisible ? 1 : 0, calendarId]
  );
}

export async function updateCalendarColorInDb(calendarId: string, colorHex: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE calendars SET color_hex = ?1 WHERE id = ?2 OR google_calendar_id = ?2;`,
    [colorHex, calendarId]
  );
}

export async function setExclusiveDefaultCalendarInDb(calendarId: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE calendars SET is_primary = 0;`);
  await db.execute(
    `UPDATE calendars SET is_primary = 1 WHERE id = ?1 OR google_calendar_id = ?1;`,
    [calendarId]
  );
}

export async function deleteCalendarFromDb(calendarId: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM calendars WHERE id = ?1 OR google_calendar_id = ?1;`, [calendarId]);
  await db.execute(`DELETE FROM events WHERE calendar_id = ?1;`, [calendarId]);
}

/* ==========================================================================
   EVENT OPERATIONS
   ========================================================================== */

function safeJsonParse<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (Array.isArray(val)) return val as unknown as T;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

export async function loadStoredEvents(): Promise<CalendarEvent[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(`
    SELECT 
      id, calendar_id, google_event_id, recurring_event_id, title, description, location, 
      conferencing_url, conferencing_provider, start_time, end_time, is_all_day, 
      time_zone, rrule, exdates, until_date, status, busy_status, visibility, reminders, 
      creator_email, participants, attachments, color_override, sync_status, updated_at
    FROM events;
  `);

  return rows.map((r) => ({
    id: r.id,
    calendarId: r.calendar_id,
    googleEventId: r.google_event_id || undefined,
    recurringEventId: r.recurring_event_id || undefined,
    title: r.title || '(No Title)',
    description: r.description || '',
    location: r.location || '',
    conferencingUrl: r.conferencing_url || '',
    conferencingProvider: r.conferencing_provider || 'google_meet',
    startTime: r.start_time,
    endTime: r.end_time,
    isAllDay: Boolean(r.is_all_day),
    timeZone: r.time_zone || 'GMT+5:30 Colombo',
    rrule: r.rrule || 'none',
    exdates: safeJsonParse<string[]>(r.exdates, []),
    untilDate: r.until_date || undefined,
    status: r.status || 'confirmed',
    busyStatus: r.busy_status || 'busy',
    visibility: r.visibility || 'default',
    reminders: safeJsonParse<string[]>(r.reminders, ['15m']),
    creatorEmail: r.creator_email || '',
    participants: safeJsonParse<string[]>(r.participants, []),
    attachments: safeJsonParse<string[]>(r.attachments, []),
    colorOverride: r.color_override || undefined,
    syncStatus: (r.sync_status as SyncStatus) || 'synced',
    updatedAt: r.updated_at || new Date().toISOString()
  }));
}

export async function persistUpsertEvent(event: CalendarEvent): Promise<void> {
  const db = await getDb();
  
  // 1. If google_event_id is present, check if a row with this google_event_id or id already exists
  if (event.googleEventId) {
    const existing = await db.select<{ id: string }[]>(
      `SELECT id FROM events WHERE google_event_id = ?1 OR id = ?2 LIMIT 1;`,
      [event.googleEventId, event.id]
    );
    if (existing.length > 0) {
      event.id = existing[0].id;
    }
  }

  await db.execute(
    `INSERT INTO events (
      id, calendar_id, google_event_id, recurring_event_id, original_start_time,
      rrule, exdates, until_date, title, description, location, conferencing_url,
      conferencing_provider, start_time, end_time, is_all_day, time_zone, status,
      busy_status, color_override, reminders, participants, attachments, sync_status,
      creator_email, updated_at
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
      ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26
    )
    ON CONFLICT(id) DO UPDATE SET
      calendar_id = excluded.calendar_id,
      google_event_id = COALESCE(excluded.google_event_id, events.google_event_id),
      recurring_event_id = excluded.recurring_event_id,
      original_start_time = excluded.original_start_time,
      rrule = excluded.rrule,
      exdates = excluded.exdates,
      until_date = excluded.until_date,
      title = excluded.title,
      description = excluded.description,
      location = excluded.location,
      conferencing_url = excluded.conferencing_url,
      conferencing_provider = excluded.conferencing_provider,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      is_all_day = excluded.is_all_day,
      time_zone = excluded.time_zone,
      status = excluded.status,
      busy_status = excluded.busy_status,
      color_override = excluded.color_override,
      reminders = excluded.reminders,
      participants = excluded.participants,
      attachments = excluded.attachments,
      sync_status = excluded.sync_status,
      creator_email = excluded.creator_email,
      updated_at = excluded.updated_at;`,
    [
      event.id,
      event.calendarId,
      event.googleEventId || null,
      event.recurringEventId || null,
      event.originalStartTime || null,
      event.rrule || null,
      JSON.stringify(event.exdates || []),
      event.untilDate || null,
      event.title || '',
      event.description || null,
      event.location || null,
      event.conferencingUrl || null,
      event.conferencingProvider || null,
      event.startTime,
      event.endTime,
      event.isAllDay ? 1 : 0,
      event.timeZone || 'GMT+5:30 Colombo',
      event.status || 'confirmed',
      event.busyStatus || 'busy',
      event.colorOverride || null,
      JSON.stringify(event.reminders || []),
      JSON.stringify(event.participants || []),
      JSON.stringify(event.attachments || []),
      event.syncStatus || 'synced',
      event.creatorEmail || null,
      event.updatedAt || new Date().toISOString()
    ]
  );
}

export async function persistDeleteEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM events WHERE id = ?1;`, [id]);
}

export async function persistBatchEvents(events: CalendarEvent[]): Promise<void> {
  for (const evt of events) {
    await persistUpsertEvent(evt);
  }
}

export async function clearAllGoogleEvents(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM events WHERE google_event_id IS NOT NULL OR sync_status = 'synced';`);
}

export async function deleteSeriesFromDb(rootMasterGoogleId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `DELETE FROM events WHERE id = ?1 OR google_event_id = ?1 OR recurring_event_id = ?1;`,
    [rootMasterGoogleId]
  );
}

export async function deleteFutureInstancesFromDb(rootMasterGoogleId: string, fromIsoDate: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `DELETE FROM events WHERE (id = ?1 OR google_event_id = ?1 OR recurring_event_id = ?1) AND start_time >= ?2;`,
    [rootMasterGoogleId, fromIsoDate]
  );
}

/* ==========================================================================
   CONTACTS OPERATIONS
   ========================================================================== */

export async function loadStoredContacts(): Promise<ParticipantContact[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(`SELECT email, name, avatar_url FROM contacts ORDER BY name ASC;`);
  return rows.map((r) => ({
    email: r.email,
    name: r.name,
    avatarUrl: r.avatar_url || undefined
  }));
}

export async function persistContact(contact: ParticipantContact): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO contacts (email, name, avatar_url) VALUES (?1, ?2, ?3)
     ON CONFLICT(email) DO UPDATE SET name = ?2, avatar_url = ?3;`,
    [contact.email, contact.name, contact.avatarUrl || null]
  );
}
/**
 * Deletes an event by Google ID or local ID, and removes any child exception records.
 */
export async function deleteDbEventByGoogleId(googleEventId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `DELETE FROM events WHERE google_event_id = ?1 OR id = ?1 OR recurring_event_id = ?1;`,
    [googleEventId]
  );
}

/**
 * Loads the latest Google sync token for a given calendar category.
 */
export async function getCalendarSyncToken(calendarId: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    `SELECT value FROM settings WHERE key = ?1 LIMIT 1;`,
    [`sync_token_${calendarId}`]
  );
  return rows.length > 0 ? rows[0].value : null;
}

/**
 * Saves the latest Google sync token for incremental delta sync.
 */
export async function saveCalendarSyncToken(calendarId: string, syncToken: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES (?1, ?2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [`sync_token_${calendarId}`, syncToken]
  );
}

/**
 * Clears the stored sync token if a full refresh is required.
 */
export async function clearCalendarSyncToken(calendarId: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM settings WHERE key = ?1;`, [`sync_token_${calendarId}`]);
}