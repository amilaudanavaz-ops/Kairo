export type FlowItemType = 'calendar_event' | 'custom_task';
export type FlowSessionStatus = 'planned' | 'active' | 'completed';

export interface FlowTask {
  id: string;             // Always starts with 'task_'
  parentId?: string;      // Links a child chunk back to its parent
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
  overtimeMinutes: number;
  layout: Record<number, string[]>; // Maps 1-hour Slot Index to an array of task chunk IDs
  createdAt: string;
}

export interface FlowBlock {
  id: string;
  parentId?: string; // Links a timeline chunk back to its original Sidebar task
  type: FlowItemType;
  title: string;
  durationMinutes: number;
  isCompleted: boolean;
  colorHex?: string;      // Inherited from calendar for events, default color for tasks
  originalStartTime?: string; // Only exists for Calendar Events to enforce "Anchor" rules
}