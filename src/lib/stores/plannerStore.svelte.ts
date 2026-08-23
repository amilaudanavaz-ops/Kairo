import { 
  loadFlowTasks, 
  saveFlowTask, 
  deleteFlowTask, 
  loadFlowSessions, 
  saveFlowSession 
} from '../db/plannerDb';
import { eventStore } from './eventStore.svelte';
import type { FlowTask, FlowSession, FlowBlock } from '../../types/planner';
import { format, parseISO, addMinutes, differenceInMinutes, setHours, setMinutes } from 'date-fns';


class PlannerStore {
  activeDateKey = $state<string>(format(new Date(), 'yyyy-MM-dd'));

  // UI States
  isOverflowManagerOpen = $state(false);
  
  // Data Layer
  tasks = $state<FlowTask[]>([]);
  sessions = $state<FlowSession[]>([]);
  activeSessionId = $state<string | null>(null);

  // Execution Runner State
  isExecutionMode = $state(false);
  activeBlockId = $state<string | null>(null);
  timerRemainingSeconds = $state<number>(0);
  isOvertime = $state(false);
  runnerInterval: number | undefined;

  /* ==========================================================================
     REACTIVE TIMELINE ENGINE
     ========================================================================== */

  activeSession = $derived.by(() => {
    return this.sessions.find(s => s.id === this.activeSessionId) || null;
  });

  // 1. The Timeline Grid (Calculates running times and overflow boundaries)
  timelineBlocks = $derived.by(() => {
    if (!this.activeSession) return [];
    
    const blocks: (FlowBlock & { calculatedStart: string; calculatedEnd: string; isOverflow: boolean })[] = [];
    let currentCursor = parseISO(this.activeSession.startTime);
    let accumulatedMinutes = 0;
    const capacity = this.activeSession.durationMinutes;

    for (const id of this.activeSession.layout) {
      if (id.startsWith('hide_')) continue; // Skip hidden markers used for calendar events

      let source: FlowBlock | null = null;
      
      if (id.startsWith('task_')) {
        const t = this.tasks.find(x => x.id === id);
        if (t) source = { id: t.id, type: 'custom_task', title: t.title, durationMinutes: t.durationMinutes, isCompleted: t.isCompleted };
      } else {
        const e = eventStore.events.find(x => x.id === id);
        if (e) {
          const duration = differenceInMinutes(parseISO(e.endTime), parseISO(e.startTime));
          source = { id: e.id, type: 'calendar_event', title: e.title, durationMinutes: duration, isCompleted: false, colorHex: e.colorOverride, originalStartTime: e.startTime };
        }
      }

      if (source) {
        const start = currentCursor;
        const end = addMinutes(currentCursor, source.durationMinutes);
        accumulatedMinutes += source.durationMinutes;
        
        blocks.push({
          ...source,
          calculatedStart: start.toISOString(),
          calculatedEnd: end.toISOString(),
          isOverflow: accumulatedMinutes > capacity // Highlights tasks pushed past the original finish line!
        });
        
        currentCursor = end;
      }
    }
    return blocks;
  });

  // 2. The Side Panel Inbox (Filters out things already on the timeline)
  inboxBlocks = $derived.by(() => {
    const layoutSet = new Set(this.activeSession?.layout || []);
    const available: FlowBlock[] = [];

    // Custom Tasks not in layout
    for (const t of this.tasks) {
      if (!layoutSet.has(t.id) && !t.isCompleted) {
        available.push({ id: t.id, type: 'custom_task', title: t.title, durationMinutes: t.durationMinutes, isCompleted: false });
      }
    }

    // Calendar Events for today not in layout
    const todayEvents = eventStore.getEventsForDateKey(this.activeDateKey);
    for (const e of todayEvents) {
      if (!layoutSet.has(e.id) && !e.isAllDay) {
        const duration = differenceInMinutes(parseISO(e.endTime), parseISO(e.startTime));
        available.push({ id: e.id, type: 'calendar_event', title: e.title, durationMinutes: duration, isCompleted: false, colorHex: e.colorOverride, originalStartTime: e.startTime });
      }
    }

    return available;
  });

  /* ==========================================================================
     INITIALIZATION & DB
     ========================================================================== */

  async init(dateKey: string) {
    this.activeDateKey = dateKey;
    this.tasks = await loadFlowTasks(dateKey);
    this.sessions = await loadFlowSessions(dateKey);
    
    // Auto-select the first session of the day if it exists, or create default 5-hour session
    if (this.sessions.length > 0) {
      if (!this.activeSessionId || !this.sessions.find(s => s.id === this.activeSessionId)) {
        this.activeSessionId = this.sessions[0].id;
      }
    } else {
      const startObj = setMinutes(setHours(parseISO(dateKey), 9), 0);
      await this.createSession(startObj.toISOString(), 300); // 5 hours default
    }
  }

  async updateSessionDuration(durationMinutes: number) {
    if (!this.activeSession) return;
    const updated = { ...this.activeSession, durationMinutes };
    this.sessions = this.sessions.map(s => s.id === updated.id ? updated : s);
    await saveFlowSession(updated);
  }

  async createSession(startTimeIso: string, durationMinutes: number) {
    const session: FlowSession = {
      id: 'session_' + Date.now(),
      dateKey: this.activeDateKey,
      startTime: startTimeIso,
      durationMinutes,
      status: 'planned',
      overtimeMinutes: 0,
      layout: [],
      createdAt: new Date().toISOString()
    };
    this.sessions = [...this.sessions, session];
    this.activeSessionId = session.id;
    await saveFlowSession(session);
  }

  async createCustomTask(title: string, durationMinutes: number) {
    const task: FlowTask = {
      id: 'task_' + Date.now(),
      dateKey: this.activeDateKey,
      title,
      durationMinutes,
      isCompleted: false,
      createdAt: new Date().toISOString()
    };
    this.tasks = [...this.tasks, task];
    await saveFlowTask(task);
  }

  /* ==========================================================================
     TIMELINE MUTATIONS & GUILLOTINE SPLIT
     ========================================================================== */

  async addBlockToTimeline(block: FlowBlock, requestedMinutes: number = 60) {
    if (!this.activeSession) return;

    // 1. Calculate remaining capacity and chunk size (Max 60 mins per drag)
    const currentUsed = this.timelineBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);
    const availableSpace = this.activeSession.durationMinutes - currentUsed;
    
    if (availableSpace <= 0) {
      console.warn("Session is at maximum capacity!");
      return; 
    }

    const chunkMinutes = Math.min(block.durationMinutes, requestedMinutes, availableSpace);
    const remainderMinutes = block.durationMinutes - chunkMinutes;

    let idToPush = block.id;

    // 2. The Guillotine Split: Slicing the block (due to 60-min cap or gap space)
    if (remainderMinutes > 0) {
      if (block.type === 'custom_task') {
        this.tasks = this.tasks.map(t => t.id === block.id ? { ...t, durationMinutes: chunkMinutes } : t);
        const updated = this.tasks.find(t => t.id === block.id)!;
        await saveFlowTask(updated);
      } else {
        // Calendar events can't be shrunk in KFlow, so we spawn a KFlow Task replica
        idToPush = 'task_' + Date.now();
        const clone: FlowTask = {
          id: idToPush, dateKey: this.activeDateKey, title: block.title,
          durationMinutes: chunkMinutes, isCompleted: false, createdAt: new Date().toISOString()
        };
        this.tasks = [...this.tasks, clone];
        await saveFlowTask(clone);
      }

      // Bounce-back the remaining time to Inbox
      const remainderTask: FlowTask = {
        id: 'task_rem_' + Date.now(), dateKey: this.activeDateKey, title: block.title,
        durationMinutes: remainderMinutes, isCompleted: false, createdAt: new Date().toISOString()
      };
      this.tasks = [...this.tasks, remainderTask];
      await saveFlowTask(remainderTask);
    } else if (block.type === 'calendar_event') {
       // Exact fit calendar events must still be cloned so they don't corrupt Google syncs
       idToPush = 'task_' + Date.now();
       const clone: FlowTask = {
         id: idToPush, dateKey: this.activeDateKey, title: block.title,
         durationMinutes: chunkMinutes, isCompleted: false, createdAt: new Date().toISOString()
       };
       this.tasks = [...this.tasks, clone];
       await saveFlowTask(clone);
    }

    // 3. Add to timeline
    const updatedSession = { ...this.activeSession, layout: [...this.activeSession.layout, idToPush] };
    this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
    await saveFlowSession(updatedSession);
  } 

  async removeBlockFromTimeline(blockId: string) {
    if (!this.activeSession) return;
    const updatedSession = { 
      ...this.activeSession, 
      layout: this.activeSession.layout.filter(id => id !== blockId) 
    };
    this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
    await saveFlowSession(updatedSession);
  }

  /* ==========================================================================
     EXECUTION RUNNER (THE DOMINO ENGINE)
     ========================================================================== */

  startSession() {
    if (!this.activeSession || this.activeSession.layout.length === 0) return;
    this.isExecutionMode = true;
    this.activeBlockId = this.activeSession.layout[0];
    
    const block = this.timelineBlocks.find(b => b.id === this.activeBlockId);
    if (block) {
      this.timerRemainingSeconds = block.durationMinutes * 60;
      this.isOvertime = false;
      this.startTimer();
    }
  }

  private startTimer() {
    if (this.runnerInterval) clearInterval(this.runnerInterval);
    this.runnerInterval = window.setInterval(() => {
      if (this.isOvertime) {
        // Stopwatch counting UP
        this.timerRemainingSeconds++;
      } else {
        // Countdown
        this.timerRemainingSeconds--;
        if (this.timerRemainingSeconds <= 0) {
          clearInterval(this.runnerInterval);
          // Trigger the 5-second UI decision overlay (handled via component reactivity)
        }
      }
    }, 1000);
  }

  triggerOvertime() {
    this.isOvertime = true;
    this.timerRemainingSeconds = 0;
    this.startTimer();
  }

  async add15MinutesToCurrent() {
    if (!this.activeBlockId || !this.activeSession) return;
    
    // The Domino Push: We update the task duration, which automatically pushes everything down in `timelineBlocks`
    if (this.activeBlockId.startsWith('task_')) {
      this.tasks = this.tasks.map(t => t.id === this.activeBlockId ? { ...t, durationMinutes: t.durationMinutes + 15 } : t);
      await saveFlowTask(this.tasks.find(t => t.id === this.activeBlockId)!);
    }
    
    // Update session overtime tracked metric
    const updatedSession = { ...this.activeSession, overtimeMinutes: this.activeSession.overtimeMinutes + 15 };
    this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
    await saveFlowSession(updatedSession);

    this.timerRemainingSeconds += 15 * 60;
    this.startTimer();
  }

  async completeCurrentTask() {
    if (!this.activeBlockId || !this.activeSession) return;
    
    if (this.runnerInterval) clearInterval(this.runnerInterval);

    // If we were in overtime, lock in the exact tracked minutes and push dominoes
    if (this.isOvertime) {
      const extraMinutes = Math.ceil(this.timerRemainingSeconds / 60);
      if (this.activeBlockId.startsWith('task_')) {
        this.tasks = this.tasks.map(t => t.id === this.activeBlockId ? { ...t, durationMinutes: t.durationMinutes + extraMinutes } : t);
        await saveFlowTask(this.tasks.find(t => t.id === this.activeBlockId)!);
      }
      const updatedSession = { ...this.activeSession, overtimeMinutes: this.activeSession.overtimeMinutes + extraMinutes };
      this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
      await saveFlowSession(updatedSession);
    }

    // Mark completed
    if (this.activeBlockId.startsWith('task_')) {
      this.tasks = this.tasks.map(t => t.id === this.activeBlockId ? { ...t, isCompleted: true } : t);
      await saveFlowTask(this.tasks.find(t => t.id === this.activeBlockId)!);
    }

    // Progress to next
    const currentIndex = this.activeSession.layout.indexOf(this.activeBlockId);
    if (currentIndex >= 0 && currentIndex < this.activeSession.layout.length - 1) {
      this.activeBlockId = this.activeSession.layout[currentIndex + 1];
      const nextBlock = this.timelineBlocks.find(b => b.id === this.activeBlockId);
      this.timerRemainingSeconds = (nextBlock?.durationMinutes || 0) * 60;
      this.isOvertime = false;
      this.startTimer();
    } else {
      // Session Finish Line!
      this.isExecutionMode = false;
      this.activeBlockId = null;
    }
  }
  /* ==========================================================================
     OVERFLOW & BOUNCE BACK LOGIC
     ========================================================================== */

  async bounceOverflow(blockId: string, overflowMinutes: number) {
    if (!this.activeSession) return;
    
    const block = this.timelineBlocks.find(b => b.id === blockId);
    if (!block) return;

    const keptMinutes = block.durationMinutes - overflowMinutes;

    if (keptMinutes <= 0) {
      // The entire block is in overflow, just remove it from the timeline
      await this.removeBlockFromTimeline(blockId);
      return;
    }

    // Shrink the current block on the timeline
    if (blockId.startsWith('task_')) {
      this.tasks = this.tasks.map(t => t.id === blockId ? { ...t, durationMinutes: keptMinutes } : t);
      await saveFlowTask(this.tasks.find(t => t.id === blockId)!);
    } else {
      // Calendar events can't be shrunk in KFlow, so we replace it with a scaled Task replica
      const newId = 'task_' + Date.now();
      const clone: FlowTask = {
        id: newId,
        dateKey: this.activeDateKey,
        title: block.title,
        durationMinutes: keptMinutes,
        isCompleted: false,
        createdAt: new Date().toISOString()
      };
      this.tasks = [...this.tasks, clone];
      await saveFlowTask(clone);
      
      const updatedLayout = this.activeSession.layout.map(id => id === blockId ? newId : id);
      this.activeSession.layout = updatedLayout;
    }

    // Spawn the bounced-back portion into the Inbox
    const remainderTask: FlowTask = {
      id: 'task_rem_' + Date.now(),
      dateKey: this.activeDateKey,
      title: `${block.title} (Overflow)`,
      durationMinutes: overflowMinutes,
      isCompleted: false,
      createdAt: new Date().toISOString()
    };
    this.tasks = [...this.tasks, remainderTask];
    await saveFlowTask(remainderTask);

    // Save session layout
    const updatedSession = { ...this.activeSession };
    this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
    await saveFlowSession(updatedSession);
  }
  
}

export const plannerStore = new PlannerStore();