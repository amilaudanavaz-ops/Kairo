import { getDb } from './database';
import type { FlowTask, FlowSession } from '../../types/planner';

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
export async function initPlannerDb() {
  const db = await getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS kflow_tasks (
        id TEXT PRIMARY KEY, date_key TEXT NOT NULL, title TEXT NOT NULL, 
        duration_minutes INTEGER NOT NULL, is_completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS kflow_sessions (
        id TEXT PRIMARY KEY, date_key TEXT NOT NULL, start_time TEXT NOT NULL, 
        duration_minutes INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'planned', 
        overtime_minutes INTEGER NOT NULL DEFAULT 0, layout TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
    );
  `);
}

/* ==========================================================================
   KFLOW TASKS
   ========================================================================== */

export async function loadFlowTasks(dateKey: string): Promise<FlowTask[]> {
  await initPlannerDb(); // Ensure tables exist
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM kflow_tasks WHERE date_key = $1 ORDER BY created_at ASC', [dateKey]);
  
  return rows.map(row => ({
    id: row.id,
    dateKey: row.date_key,
    title: row.title,
    durationMinutes: row.duration_minutes,
    isCompleted: row.is_completed === 1,
    createdAt: row.created_at
  }));
}

export async function saveFlowTask(task: FlowTask): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO kflow_tasks (id, date_key, title, duration_minutes, is_completed, created_at) 
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(id) DO UPDATE SET 
      title = excluded.title,
      duration_minutes = excluded.duration_minutes,
      is_completed = excluded.is_completed`,
    [
      task.id,
      task.dateKey,
      task.title,
      task.durationMinutes,
      task.isCompleted ? 1 : 0,
      task.createdAt
    ]
  );
}

export async function deleteFlowTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM kflow_tasks WHERE id = $1', [id]);
}

/* ==========================================================================
   KFLOW SESSIONS
   ========================================================================== */

export async function loadFlowSessions(dateKey: string): Promise<FlowSession[]> {
  await initPlannerDb(); // Ensure tables exist
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM kflow_sessions WHERE date_key = $1 ORDER BY start_time ASC', [dateKey]);
  
  return rows.map(row => ({
    id: row.id,
    dateKey: row.date_key,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    status: row.status,
    overtimeMinutes: row.overtime_minutes,
    layout: JSON.parse(row.layout || '[]'),
    createdAt: row.created_at
  }));
}

export async function saveFlowSession(session: FlowSession): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO kflow_sessions (id, date_key, start_time, duration_minutes, status, overtime_minutes, layout, created_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(id) DO UPDATE SET 
      start_time = excluded.start_time,
      duration_minutes = excluded.duration_minutes,
      status = excluded.status,
      overtime_minutes = excluded.overtime_minutes,
      layout = excluded.layout`,
    [
      session.id,
      session.dateKey,
      session.startTime,
      session.durationMinutes,
      session.status,
      session.overtimeMinutes,
      JSON.stringify(session.layout),
      session.createdAt
    ]
  );
}

export async function deleteFlowSession(id: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM kflow_sessions WHERE id = $1', [id]);
}