import Database from '@tauri-apps/plugin-sql';
import type { CalendarEvent, CalendarCategory, UserAccount, ParticipantContact } from '../../types/event';

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:kairo.db');

    // 1. Settings key-value table
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // 2. Accounts table
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        avatar_url TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        sync_enabled INTEGER NOT NULL DEFAULT 1
      );
    `);

    // 3. Contacts directory for participants
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        avatar_url TEXT
      );
    `);

    // 4. Calendars table
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS calendars (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        google_calendar_id TEXT,
        name TEXT NOT NULL,
        color_id TEXT NOT NULL,
        color_hex TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0,
        is_visible INTEGER NOT NULL DEFAULT 1
      );
    `);

    // 5. Events table
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        calendar_id TEXT NOT NULL,
        google_event_id TEXT,
        recurring_event_id TEXT,
        title TEXT,
        description TEXT,
        location TEXT,
        meeting_url TEXT,
        conferencing_provider TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        is_all_day INTEGER NOT NULL DEFAULT 0,
        time_zone TEXT NOT NULL,
        rrule TEXT,
        exdates TEXT,
        until_date TEXT,
        color_override TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        busy_status TEXT NOT NULL DEFAULT 'busy',
        visibility TEXT NOT NULL DEFAULT 'default',
        reminders TEXT NOT NULL,
        creator_email TEXT,
        participants TEXT,
        attachments TEXT,
        sync_status TEXT NOT NULL DEFAULT 'synced',
        updated_at TEXT NOT NULL
      );
    `);
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

export async function loadDbAccounts(): Promise<UserAccount[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM accounts ORDER BY is_primary DESC, id ASC');
  return rows.map(r => ({
    id: r.id,
    email: r.email,
    name: r.name,
    provider: r.provider,
    avatarUrl: r.avatar_url,
    isPrimary: Boolean(r.is_primary),
    syncEnabled: Boolean(r.sync_enabled)
  }));
}

export async function persistDbAccount(acc: UserAccount): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO accounts (id, email, name, provider, avatar_url, is_primary, sync_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       provider = excluded.provider,
       avatar_url = excluded.avatar_url,
       is_primary = excluded.is_primary,
       sync_enabled = excluded.sync_enabled`,
    [acc.id, acc.email, acc.name, acc.provider, acc.avatarUrl || null, acc.isPrimary ? 1 : 0, acc.syncEnabled ? 1 : 0]
  );
}

export async function deleteDbAccount(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM accounts WHERE id = $1', [id]);
  await db.execute('DELETE FROM calendars WHERE account_id = $1', [id]);
}

// =================== CONTACTS CRUD ===================

export async function loadDbContacts(): Promise<ParticipantContact[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM contacts ORDER BY name ASC');
  return rows.map(r => ({
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
     ON CONFLICT(email) DO UPDATE SET name = excluded.name`,
    ['cnt_' + Date.now(), c.name, c.email, c.avatarUrl || null]
  );
}

// =================== CALENDARS CRUD ===================

export async function loadInitialCalendars(): Promise<CalendarCategory[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM calendars ORDER BY is_primary DESC, id ASC');

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    googleCalendarId: r.google_calendar_id,
    name: r.name,
    colorId: r.color_id,
    colorHex: r.color_hex,
    isPrimary: Boolean(r.is_primary),
    isVisible: Boolean(r.is_visible)
  }));
}

export async function persistCalendarCategory(cal: CalendarCategory): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO calendars (id, account_id, google_calendar_id, name, color_id, color_hex, is_primary, is_visible)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       color_id = excluded.color_id,
       color_hex = excluded.color_hex,
       is_primary = excluded.is_primary,
       is_visible = excluded.is_visible`,
    [cal.id, cal.accountId, cal.googleCalendarId || null, cal.name, cal.colorId, cal.colorHex, cal.isPrimary ? 1 : 0, cal.isVisible ? 1 : 0]
  );
}

// =================== EVENTS CRUD ===================

export async function loadStoredEvents(): Promise<CalendarEvent[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM events ORDER BY start_time ASC');

  return rows.map((r) => {
    let parsedReminders: string[] = ['15m'];
    try {
      if (r.reminders) {
        parsedReminders = r.reminders.startsWith('[') ? JSON.parse(r.reminders) : [r.reminders];
      }
    } catch {
      parsedReminders = ['15m'];
    }

    let parsedExdates: string[] = [];
    try {
      if (r.exdates) {
        parsedExdates = JSON.parse(r.exdates);
      }
    } catch {
      parsedExdates = [];
    }

    let parsedParticipants: string[] = [];
    try {
      if (r.participants) {
        parsedParticipants = JSON.parse(r.participants);
      }
    } catch {
      parsedParticipants = [];
    }

    let parsedAttachments: string[] = [];
    try {
      if (r.attachments) {
        parsedAttachments = JSON.parse(r.attachments);
      }
    } catch {
      parsedAttachments = [];
    }

    return {
      id: r.id,
      calendarId: r.calendar_id,
      googleEventId: r.google_event_id,
      recurringEventId: r.recurring_event_id,
      title: r.title || '',
      description: r.description || '',
      location: r.location || '',
      conferencingUrl: r.meeting_url || '',
      conferencingProvider: r.conferencing_provider || 'google_meet',
      meetingUrl: r.meeting_url || '',
      startTime: r.start_time,
      endTime: r.end_time,
      isAllDay: Boolean(r.is_all_day),
      timeZone: r.time_zone || 'GMT+5:30 Colombo',
      rrule: r.rrule || 'none',
      exdates: parsedExdates,
      untilDate: r.until_date || undefined,
      status: r.status || 'confirmed',
      busyStatus: r.busy_status || 'busy',
      visibility: r.visibility || 'default',
      reminders: Array.isArray(parsedReminders) ? parsedReminders : ['15m'],
      creatorEmail: r.creator_email || '',
      participants: parsedParticipants,
      attachments: parsedAttachments,
      colorOverride: r.color_override || undefined,
      syncStatus: r.sync_status || 'synced',
      updatedAt: r.updated_at
    };
  });
}

export async function persistUpsertEvent(event: CalendarEvent): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO events (
      id, calendar_id, google_event_id, recurring_event_id, title, description, location,
      meeting_url, conferencing_provider, start_time, end_time, is_all_day, time_zone, rrule, exdates, until_date,
      color_override, status, busy_status, visibility, reminders, creator_email, participants, attachments, sync_status, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
    ON CONFLICT(id) DO UPDATE SET
      calendar_id = excluded.calendar_id,
      recurring_event_id = excluded.recurring_event_id,
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
      event.id,
      event.calendarId,
      event.googleEventId || null,
      event.recurringEventId || null,
      event.title,
      event.description || null,
      event.location || null,
      event.conferencingUrl || event.meetingUrl || null,
      event.conferencingProvider || 'google_meet',
      event.startTime,
      event.endTime,
      event.isAllDay ? 1 : 0,
      event.timeZone,
      event.rrule || 'none',
      JSON.stringify(event.exdates || []),
      event.untilDate || null,
      event.colorOverride || null,
      event.status,
      event.busyStatus,
      event.visibility,
      JSON.stringify(event.reminders || ['15m']),
      event.creatorEmail || '',
      JSON.stringify(event.participants || []),
      JSON.stringify(event.attachments || []),
      event.syncStatus,
      event.updatedAt
    ]
  );
}

export async function persistDeleteEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM events WHERE id = $1', [id]);
}