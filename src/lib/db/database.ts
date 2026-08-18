import Database from '@tauri-apps/plugin-sql';
import type { CalendarEvent, CalendarCategory, UserAccount, ParticipantContact } from '../../types/event';

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:kairo.db');

    // Clean legacy placeholder calendars
    await dbInstance.execute(`DELETE FROM calendars WHERE name IN ('Personal & Work', 'Scraping & Dev', 'Holidays') AND google_calendar_id IS NULL;`).catch(() => {});
    await dbInstance.execute(`DELETE FROM accounts WHERE id = 'acc_primary' AND access_token IS NULL;`).catch(() => {});

    // 1. Settings Table
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // 2. Accounts Table
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        provider TEXT NOT NULL DEFAULT 'google',
        avatar_url TEXT,
        access_token TEXT,
        refresh_token TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        sync_enabled INTEGER NOT NULL DEFAULT 1
      );
    `);

    // 3. Contacts Table
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        avatar_url TEXT
      );
    `);

    // 4. Calendars Table
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS calendars (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        google_calendar_id TEXT,
        name TEXT NOT NULL,
        color_id TEXT NOT NULL DEFAULT 'blue',
        color_hex TEXT NOT NULL DEFAULT '#3b82f6',
        is_primary INTEGER NOT NULL DEFAULT 0,
        is_visible INTEGER NOT NULL DEFAULT 1,
        access_role TEXT NOT NULL DEFAULT 'owner',
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
    `);

    // 5. Events Table
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        calendar_id TEXT NOT NULL,
        google_event_id TEXT,
        recurring_event_id TEXT,
        original_start_time TEXT,
        title TEXT DEFAULT '(No Title)',
        description TEXT,
        location TEXT,
        meeting_url TEXT,
        conferencing_provider TEXT DEFAULT 'google_meet',
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        is_all_day INTEGER NOT NULL DEFAULT 0,
        time_zone TEXT NOT NULL DEFAULT 'UTC',
        rrule TEXT,
        exdates TEXT,
        until_date TEXT,
        color_override TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        busy_status TEXT NOT NULL DEFAULT 'busy',
        visibility TEXT NOT NULL DEFAULT 'default',
        reminders TEXT NOT NULL DEFAULT '["15m"]',
        creator_email TEXT,
        participants TEXT,
        attachments TEXT,
        sync_status TEXT NOT NULL DEFAULT 'synced',
        updated_at TEXT NOT NULL,
        FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
      );
    `);

    // Self-Healing Column Migrations
    await dbInstance.execute(`ALTER TABLE accounts ADD COLUMN name TEXT NOT NULL DEFAULT '';`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE accounts ADD COLUMN avatar_url TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE accounts ADD COLUMN access_token TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE accounts ADD COLUMN refresh_token TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE accounts ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE accounts ADD COLUMN sync_enabled INTEGER NOT NULL DEFAULT 1;`).catch(() => {});

    await dbInstance.execute(`ALTER TABLE calendars ADD COLUMN google_calendar_id TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE calendars ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE calendars ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE calendars ADD COLUMN access_role TEXT NOT NULL DEFAULT 'owner';`).catch(() => {});

    await dbInstance.execute(`ALTER TABLE events ADD COLUMN google_event_id TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN recurring_event_id TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN original_start_time TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN meeting_url TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN conferencing_provider TEXT DEFAULT 'google_meet';`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN exdates TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN until_date TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN color_override TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed';`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN busy_status TEXT NOT NULL DEFAULT 'busy';`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN visibility TEXT DEFAULT 'default';`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN reminders TEXT NOT NULL DEFAULT '["15m"]';`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN creator_email TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN participants TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN attachments TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'synced';`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN updated_at TEXT;`).catch(() => {});

    // Ensure only one calendar is primary
    const primaryCalendars = await dbInstance.select<{ id: string }[]>(
      'SELECT id FROM calendars WHERE is_primary = 1 ORDER BY rowid ASC'
    );
    if (primaryCalendars.length > 1) {
      const keepPrimaryId = primaryCalendars[0].id;
      await dbInstance.execute('UPDATE calendars SET is_primary = 0 WHERE id != $1', [keepPrimaryId]);
    }
  }
  return dbInstance;
}

// =================== SETTINGS CRUD ===================

export async function loadDbSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>('SELECT key, value FROM settings');
  const result: Record<string, string> = {};
  for (const r of rows) {
    result[r.key] = r.value;
  }
  return result;
}

export async function persistDbSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

// =================== ACCOUNTS CRUD ===================

export interface AccountWithTokens extends UserAccount {
  accessToken?: string;
  refreshToken?: string;
}

export async function loadDbAccounts(): Promise<UserAccount[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM accounts ORDER BY is_primary DESC, id ASC');
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name || r.email.split('@')[0],
    provider: r.provider || 'google',
    avatarUrl: r.avatar_url,
    isPrimary: Boolean(r.is_primary),
    syncEnabled: Boolean(r.sync_enabled)
  }));
}

export async function loadAllAccountsWithTokens(): Promise<{ id: string; email: string; name: string; accessToken?: string; refreshToken?: string }[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT id, email, name, access_token, refresh_token FROM accounts WHERE sync_enabled = 1 ORDER BY is_primary DESC');
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name || r.email.split('@')[0],
    accessToken: r.access_token || undefined,
    refreshToken: r.refresh_token || undefined
  }));
}

export async function updateAccountTokens(accountId: string, accessToken: string, refreshToken?: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE accounts SET access_token = $1, refresh_token = COALESCE($2, refresh_token) WHERE id = $3',
    [accessToken, refreshToken || null, accountId]
  );
}

export async function getAccountAccessToken(accountId: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ access_token: string }[]>('SELECT access_token FROM accounts WHERE id = $1', [accountId]);
  return rows.length > 0 ? rows[0].access_token : null;
}

export async function persistDbAccount(
  acc: UserAccount, 
  accessToken?: string, 
  refreshToken?: string
): Promise<UserAccount> {
  const db = await getDb();
  
  const existing = await db.select<any[]>('SELECT id FROM accounts WHERE email = $1', [acc.email]);
  const resolvedId = existing.length > 0 ? existing[0].id : acc.id;

  await db.execute(
    `INSERT INTO accounts (id, email, name, provider, avatar_url, access_token, refresh_token, is_primary, sync_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name,
       provider = excluded.provider,
       avatar_url = excluded.avatar_url,
       access_token = COALESCE(excluded.access_token, accounts.access_token),
       refresh_token = COALESCE(excluded.refresh_token, accounts.refresh_token),
       is_primary = excluded.is_primary,
       sync_enabled = excluded.sync_enabled`,
    [
      resolvedId,
      acc.email,
      acc.name,
      acc.provider,
      acc.avatarUrl || null,
      accessToken || null,
      refreshToken || null,
      acc.isPrimary ? 1 : 0,
      acc.syncEnabled ? 1 : 0
    ]
  );

  return { ...acc, id: resolvedId };
}

export async function deleteDbAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM events WHERE calendar_id IN (SELECT id FROM calendars WHERE account_id = $1)', [id]);
  await db.execute('DELETE FROM calendars WHERE account_id = $1', [id]);
  await db.execute('DELETE FROM accounts WHERE id = $1', [id]);
}

export async function clearAllDbAccounts(): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM events');
  await db.execute('DELETE FROM calendars');
  await db.execute('DELETE FROM accounts');
}

export async function clearAllGoogleEvents(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM events WHERE id LIKE 'evt_g_%' OR google_event_id IS NOT NULL");
}

// =================== CALENDARS CRUD ===================

export async function loadInitialCalendars(): Promise<CalendarCategory[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM calendars ORDER BY is_primary DESC, id ASC');

  const seen = new Set<string>();
  const results: CalendarCategory[] = [];

  for (const r of rows) {
    const key = r.google_calendar_id || r.id;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        id: r.id,
        accountId: r.account_id,
        googleCalendarId: r.google_calendar_id,
        name: r.name,
        colorId: r.color_id || 'blue',
        colorHex: r.color_hex || '#3b82f6',
        isPrimary: Boolean(r.is_primary),
        isVisible: Boolean(r.is_visible),
        accessRole: r.access_role || 'owner'
      });
    }
  }

  return results;
}

export async function persistCalendarCategory(cal: CalendarCategory): Promise<void> {
  const db = await getDb();
  
  const accCheck = await db.select<any[]>('SELECT id FROM accounts WHERE id = $1', [cal.accountId]);
  if (accCheck.length === 0) return;

  let existingId = cal.id;
  if (cal.googleCalendarId) {
    const existing = await db.select<any[]>(
      'SELECT id FROM calendars WHERE account_id = $1 AND google_calendar_id = $2',
      [cal.accountId, cal.googleCalendarId]
    );
    if (existing.length > 0) {
      existingId = existing[0].id;
    }
  }

  const accessRole = cal.accessRole || 'owner';

  await db.execute(
    `INSERT INTO calendars (id, account_id, google_calendar_id, name, color_id, color_hex, is_primary, is_visible, access_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT(id) DO UPDATE SET
       account_id = excluded.account_id,
       google_calendar_id = excluded.google_calendar_id,
       name = excluded.name,
       color_id = excluded.color_id,
       color_hex = excluded.color_hex,
       is_primary = excluded.is_primary,
       is_visible = excluded.is_visible,
       access_role = excluded.access_role`,
    [
      existingId, 
      cal.accountId, 
      cal.googleCalendarId || null, 
      cal.name, 
      cal.colorId, 
      cal.colorHex, 
      cal.isPrimary ? 1 : 0, 
      cal.isVisible ? 1 : 0,
      accessRole
    ]
  );
}

export async function setDefaultCalendar(calendarId: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE calendars SET is_primary = 0');
  await db.execute('UPDATE calendars SET is_primary = 1 WHERE id = $1', [calendarId]);
}

export async function setExclusiveDefaultCalendarInDb(calendarId: string): Promise<void> {
  await setDefaultCalendar(calendarId);
}

export async function updateCalendarColorInDb(calendarId: string, colorHex: string): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE calendars SET color_hex = $1 WHERE id = $2', [colorHex, calendarId]);
}

export async function updateCalendarVisibilityInDb(calendarId: string, isVisible: boolean): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE calendars SET is_visible = $1 WHERE id = $2', [isVisible ? 1 : 0, calendarId]);
}

export async function deleteCalendarFromDb(calendarId: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM events WHERE calendar_id = $1', [calendarId]);
  await db.execute('DELETE FROM calendars WHERE id = $1', [calendarId]);
}

// =================== CONTACTS CRUD ===================

export async function loadDbContacts(): Promise<ParticipantContact[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM contacts ORDER BY name ASC');
  return rows.map((r) => ({
    name: r.name,
    email: r.email,
    avatarUrl: r.avatar_url
  }));
}

export async function persistDbContact(c: ParticipantContact): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO contacts (id, name, email, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(email) DO UPDATE SET name = excluded.name, avatar_url = COALESCE(excluded.avatar_url, contacts.avatar_url)`,
    ['cnt_' + Date.now(), c.name, c.email, c.avatarUrl || null]
  );
}

// =================== EVENTS CRUD ===================

export async function loadStoredEvents(): Promise<CalendarEvent[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM events ORDER BY start_time ASC');

  return rows.map((r) => {
    let parsedReminders: string[] = ['15m'];
    try {
      if (r.reminders) parsedReminders = r.reminders.startsWith('[') ? JSON.parse(r.reminders) : [r.reminders];
    } catch {
      parsedReminders = ['15m'];
    }

    let parsedExdates: string[] = [];
    try {
      if (r.exdates) parsedExdates = JSON.parse(r.exdates);
    } catch {
      parsedExdates = [];
    }

    let parsedParticipants: string[] = [];
    try {
      if (r.participants) parsedParticipants = JSON.parse(r.participants);
    } catch {
      parsedParticipants = [];
    }

    let parsedAttachments: string[] = [];
    try {
      if (r.attachments) parsedAttachments = JSON.parse(r.attachments);
    } catch {
      parsedAttachments = [];
    }

    return {
      id: r.id,
      calendarId: r.calendar_id,
      googleEventId: r.google_event_id,
      recurringEventId: r.recurring_event_id,
      originalStartTime: r.original_start_time,
      title: r.title || '(No Title)',
      description: r.description || '',
      location: r.location || '',
      conferencingUrl: r.meeting_url || '',
      conferencingProvider: r.conferencing_provider || 'google_meet',
      meetingUrl: r.meeting_url || '',
      startTime: r.start_time,
      endTime: r.end_time,
      isAllDay: Boolean(r.is_all_day),
      timeZone: r.time_zone || 'UTC',
      rrule: r.rrule || 'none',
      exdates: parsedExdates,
      untilDate: r.until_date || undefined,
      isRecurringInstance: Boolean(r.recurring_event_id || (r.rrule && r.rrule !== 'none')),
      status: r.status || 'confirmed',
      busyStatus: r.busy_status || 'busy',
      visibility: r.visibility || 'default',
      reminders: Array.isArray(parsedReminders) ? parsedReminders : ['15m'],
      creatorEmail: r.creator_email || '',
      participants: parsedParticipants,
      attachments: parsedAttachments,
      colorOverride: r.color_override || undefined,
      syncStatus: r.sync_status || 'synced',
      updatedAt: r.updated_at || new Date().toISOString()
    };
  });
}

export async function persistUpsertEvent(event: CalendarEvent): Promise<void> {
  const db = await getDb();
  
  const calCheck = await db.select<any[]>('SELECT id FROM calendars WHERE id = $1', [event.calendarId]);
  let targetCalendarId = event.calendarId;
  if (calCheck.length === 0) {
    const anyCal = await db.select<any[]>('SELECT id FROM calendars LIMIT 1');
    if (anyCal.length > 0) {
      targetCalendarId = anyCal[0].id;
    } else {
      console.warn(`Cannot persist event ${event.id}: No calendars exist.`);
      return;
    }
  }

  let resolvedEventId = event.id;
  if (event.googleEventId) {
    const existing = await db.select<any[]>(
      'SELECT id FROM events WHERE calendar_id = $1 AND google_event_id = $2',
      [targetCalendarId, event.googleEventId]
    );
    if (existing.length > 0) {
      resolvedEventId = existing[0].id;
    }
  }

  // If saving Google expanded instances, remove temporary local draft master to prevent duplicate rows
  if (event.recurringEventId) {
    await db.execute(
      `DELETE FROM events WHERE calendar_id = $1 AND google_event_id = $2 AND recurring_event_id IS NULL AND id LIKE 'evt_%' AND id NOT LIKE 'evt_g_%'`,
      [targetCalendarId, event.recurringEventId]
    );
  }

  await db.execute(
    `INSERT INTO events (
      id, calendar_id, google_event_id, recurring_event_id, original_start_time, title, description, location,
      meeting_url, conferencing_provider, start_time, end_time, is_all_day, time_zone, rrule, exdates, until_date,
      color_override, status, busy_status, visibility, reminders, creator_email, participants, attachments, sync_status, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
    ON CONFLICT(id) DO UPDATE SET
      calendar_id = excluded.calendar_id,
      google_event_id = excluded.google_event_id,
      recurring_event_id = excluded.recurring_event_id,
      original_start_time = excluded.original_start_time,
      title = excluded.title,
      description = excluded.description,
      location = excluded.location,
      meeting_url = excluded.meeting_url,
      conferencing_provider = excluded.conferencing_provider,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      is_all_day = excluded.is_all_day,
      time_zone = excluded.time_zone,
      rrule = excluded.rrule,
      exdates = excluded.exdates,
      until_date = excluded.until_date,
      color_override = excluded.color_override,
      status = excluded.status,
      busy_status = excluded.busy_status,
      visibility = excluded.visibility,
      reminders = excluded.reminders,
      creator_email = excluded.creator_email,
      participants = excluded.participants,
      attachments = excluded.attachments,
      sync_status = excluded.sync_status,
      updated_at = excluded.updated_at`,
    [
      resolvedEventId,
      targetCalendarId,
      event.googleEventId || null,
      event.recurringEventId || null,
      event.originalStartTime || null,
      event.title || '(No Title)',
      event.description || null,
      event.location || null,
      event.conferencingUrl || event.meetingUrl || null,
      event.conferencingProvider || 'google_meet',
      event.startTime,
      event.endTime,
      event.isAllDay ? 1 : 0,
      event.timeZone || 'UTC',
      event.rrule || 'none',
      JSON.stringify(event.exdates || []),
      event.untilDate || null,
      event.colorOverride || null,
      event.status || 'confirmed',
      event.busyStatus || 'busy',
      event.visibility || 'default',
      JSON.stringify(event.reminders || ['15m']),
      event.creatorEmail || '',
      JSON.stringify(event.participants || []),
      JSON.stringify(event.attachments || []),
      event.syncStatus || 'synced',
      event.updatedAt || new Date().toISOString()
    ]
  );
}

export async function persistBatchEvents(eventsList: CalendarEvent[]): Promise<void> {
  for (const ev of eventsList) {
    await persistUpsertEvent(ev);
  }
}

export async function persistDeleteEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM events WHERE id = $1', [id]);
}