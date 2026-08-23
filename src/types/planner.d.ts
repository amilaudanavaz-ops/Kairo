export type FlowItemType = 'calendar_event' | 'custom_task';
export type FlowSessionStatus = 'planned' | 'active' | 'completed';

export interface FlowTask {
  id: string;             // Always starts with 'task_'
  dateKey: string;        // The YYYY-MM-DD it belongs to
  title: string;
  durationMinutes: number;
  isCompleted: boolean;
  createdAt: string;
}

export interface FlowSession {
  id: string;             // Always starts with 'session_'
  dateKey: string;        // The YYYY-MM-DD it belongs to
  startTime: string;      // ISO String of when the session kicks off
  durationMinutes: number;// The Original Finish Line capacity (e.g., 480 for 8 hours)
  status: FlowSessionStatus;
  overtimeMinutes: number;// Tracks +15 mins and Stopwatch overflow
  layout: string[];       // JSON array of event/task IDs in the exact order they sit on the timeline
  createdAt: string;
}

// A unified object used by the UI to render both Calendar Events and Custom Tasks seamlessly
export interface FlowBlock {
  id: string;
  type: FlowItemType;
  title: string;
  durationMinutes: number;
  isCompleted: boolean;
  colorHex?: string;      // Inherited from calendar for events, default color for tasks
  originalStartTime?: string; // Only exists for Calendar Events to enforce "Anchor" rules
}