import Database from '@tauri-apps/plugin-sql';
import type { CalendarEvent, CalendarCategory } from '../../types/event';

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:kairo.db');
    // Ensure columns exist in SQLite schema
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN exdates TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN until_date TEXT;`).catch(() => {});
    await dbInstance.execute(`ALTER TABLE events ADD COLUMN recurring_event_id TEXT;`).catch(() => {});
  }
  return dbInstance;
}

export async function loadInitialCalendars(): Promise<CalendarCategory[]> {
  const db = await getDb();

  await db.execute(
    `INSERT OR IGNORE INTO accounts (id, email, provider, sync_enabled)
     VALUES ('acc_primary', 'amilavaz2003@gmail.com', 'google', 1)`
  );

  const rows = await db.select<any[]>('SELECT * FROM calendars ORDER BY created_at ASC');
  
  if (rows.length === 0) {
    const defaults = [
      { id: '1', account_id: 'acc_primary', name: 'Personal & Work', color_id: 'blue', color_hex: '#3b82f6', is_primary: 1, is_visible: 1 },
      { id: '2', account_id: 'acc_primary', name: 'Scraping & Dev', color_id: 'amber', color_hex: '#f59e0b', is_primary: 0, is_visible: 1 },
      { id: '3', account_id: 'acc_primary', name: 'Holidays', color_id: 'emerald', color_hex: '#10b981', is_primary: 0, is_visible: 1 }
    ];

    for (const d of defaults) {
      await db.execute(
        `INSERT OR IGNORE INTO calendars (id, account_id, name, color_id, color_hex, is_primary, is_visible)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [d.id, d.account_id, d.name, d.color_id, d.color_hex, d.is_primary, d.is_visible]
      );
    }
    return defaults.map((d) => ({
      id: d.id,
      accountId: d.account_id,
      name: d.name,
      colorId: d.color_id,
      colorHex: d.color_hex,
      isPrimary: Boolean(d.is_primary),
      isVisible: Boolean(d.is_visible)
    }));
  }

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

    return {
      id: r.id,
      calendarId: r.calendar_id,
      googleEventId: r.google_event_id,
      recurringEventId: r.recurring_event_id,
      title: r.title || '',
      description: r.description || '',
      location: r.location || '',
      conferencingUrl: r.meeting_url || '',
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
      creatorEmail: r.creator_email || 'amilavaz2003@gmail.com',
      colorOverride: r.color_override || undefined,
      syncStatus: r.sync_status,
      updatedAt: r.updated_at
    };
  });
}

export async function persistUpsertEvent(event: CalendarEvent): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO events (
      id, calendar_id, google_event_id, recurring_event_id, title, description, location,
      meeting_url, start_time, end_time, is_all_day, time_zone, rrule, exdates, until_date,
      color_override, status, busy_status, reminders, sync_status, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    ON CONFLICT(id) DO UPDATE SET
      calendar_id = excluded.calendar_id,
      recurring_event_id = excluded.recurring_event_id,
      title = excluded.title,
      description = excluded.description,
      location = excluded.location,
      meeting_url = excluded.meeting_url,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      is_all_day = excluded.is_all_day,
      time_zone = excluded.time_zone,
      rrule = excluded.rrule,
      exdates = excluded.exdates,
      until_date = excluded.until_date,
      color_override = excluded.color_override,
      busy_status = excluded.busy_status,
      reminders = excluded.reminders,
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
      JSON.stringify(event.reminders || ['15m']),
      event.syncStatus,
      event.updatedAt
    ]
  );
}

export async function persistDeleteEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM events WHERE id = $1', [id]);
}