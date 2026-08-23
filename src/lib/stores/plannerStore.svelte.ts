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

  // Flattened layout helper for the execution runner
  get flatLayout() {
    const layout = this.activeSession?.layout;
    if (!layout) return [];
    
    return Object.keys(layout)
      .map(Number)
      .sort((a, b) => a - b)
      .flatMap(k => layout[k]);
  }

  // 1. The Timeline Grid (Slot-based)
  timelineBlocks = $derived.by(() => {
    if (!this.activeSession) return [];
    
    const blocks: (FlowBlock & { slotIndex: number })[] = [];
    const layout = this.activeSession.layout || {};

    Object.entries(layout).forEach(([slotStr, ids]) => {
      const slotIndex = parseInt(slotStr, 10);
      
      ids.forEach(id => {
        const t = this.tasks.find(x => x.id === id);
        if (t) {
          blocks.push({
            id: t.id,
            parentId: t.parentId, // Crucial for tracking back to sidebar
            type: 'custom_task',
            title: t.title,
            durationMinutes: t.durationMinutes,
            isCompleted: t.isCompleted,
            slotIndex
          });
        }
      });
    });
    return blocks;
  });

  // 2. The Side Panel Inbox (Dynamically calculates remaining time)
  inboxBlocks = $derived.by(() => {
    const available: FlowBlock[] = [];
    
    // Calculate how much time of each parent task is already spent on the timeline
    const timelineUsage: Record<string, number> = {};
    for (const tb of this.timelineBlocks) {
      const originalId = tb.parentId || tb.id;
      timelineUsage[originalId] = (timelineUsage[originalId] || 0) + tb.durationMinutes;
    }

    // Original Custom Tasks (Ignore timeline child chunks)
    for (const t of this.tasks) {
      if (!t.isCompleted && !t.parentId) {
        const used = timelineUsage[t.id] || 0;
        const remaining = t.durationMinutes - used;
        if (remaining > 0) {
          available.push({ id: t.id, type: 'custom_task', title: t.title, durationMinutes: remaining, isCompleted: false });
        }
      }
    }

    // Calendar Events
    const todayEvents = eventStore.getEventsForDateKey(this.activeDateKey);
    for (const e of todayEvents) {
      if (!e.isAllDay) {
        const totalDuration = differenceInMinutes(parseISO(e.endTime), parseISO(e.startTime));
        const used = timelineUsage[e.id] || 0;
        const remaining = totalDuration - used;
        
        if (remaining > 0) {
          available.push({ id: e.id, type: 'calendar_event', title: e.title, durationMinutes: remaining, isCompleted: false, colorHex: e.colorOverride, originalStartTime: e.startTime });
        }
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
      layout: {}, // Changed to an empty object for slots
      createdAt: new Date().toISOString()
    };
    this.sessions = [...this.sessions, session];
    this.activeSessionId = session.id;
    await saveFlowSession(session);
  }

  async createCustomTask(title: string, durationMinutes: number) {
    console.log('[Store] 🟢 Creating new custom task:', title, durationMinutes, 'mins');
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

  async deleteCustomTask(taskId: string) {
    console.log('[Store] 🔴 Deleting custom task from Inbox:', taskId);
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    await deleteFlowTask(taskId);
  }

  /* ==========================================================================
     TIMELINE MUTATIONS & GUILLOTINE SPLIT
     ========================================================================== */

  async addBlockToTimeline(block: FlowBlock, targetSlot: number = 0) {
    console.log(`[Store] 🟡 addBlockToTimeline TRIGGERED for block: ${block.id} into Slot: ${targetSlot}`);
    if (!this.activeSession) {
      console.warn('[Store] ❌ No active session found!');
      return;
    }

    const currentLayout = this.activeSession.layout || {};
    const slotTasks = currentLayout[targetSlot] || [];
    
    let slotUsedMinutes = 0;
    for (const id of slotTasks) {
      const t = this.tasks.find(x => x.id === id);
      if (t) slotUsedMinutes += t.durationMinutes;
    }

    const availableInSlot = 60 - slotUsedMinutes;
    console.log(`[Store] 📊 Slot ${targetSlot} Capacity -> Used: ${slotUsedMinutes}m, Available: ${availableInSlot}m`);
    
    if (availableInSlot <= 0) {
      console.warn('[Store] ❌ Slot is full! Rejected drop.');
      return; 
    }

    const chunkMinutes = Math.min(block.durationMinutes, 60, availableInSlot);
    console.log(`[Store] ✂️ Slicing task to ${chunkMinutes}m chunk`);

    const chunkId = 'task_' + Date.now() + Math.floor(Math.random() * 1000);
    const childTask: FlowTask = {
      id: chunkId,
      parentId: block.id,
      dateKey: this.activeDateKey,
      title: block.title,
      durationMinutes: chunkMinutes,
      isCompleted: false,
      createdAt: new Date().toISOString()
    };
    
    this.tasks = [...this.tasks, childTask];
    await saveFlowTask(childTask);

    const updatedSession = { 
      ...this.activeSession, 
      layout: { 
        ...currentLayout, 
        [targetSlot]: [...slotTasks, chunkId] 
      } 
    };
    
    this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
    await saveFlowSession(updatedSession);
    console.log(`[Store] ✅ Successfully added chunk ${chunkId} to Slot ${targetSlot}`);
  }

  async moveBlockToSlot(blockId: string, sourceSlot: number, targetSlot: number) {
    console.log(`[Store] 🔄 moveBlockToSlot TRIGGERED: ${blockId} from Slot ${sourceSlot} -> Slot ${targetSlot}`);
    if (!this.activeSession || sourceSlot === targetSlot) return;
    
    const currentLayout = this.activeSession.layout || {};
    const targetTasks = currentLayout[targetSlot] || [];
    
    let targetUsed = 0;
    for (const id of targetTasks) {
      const t = this.tasks.find(x => x.id === id);
      if (t) targetUsed += t.durationMinutes;
    }
    
    const movingTask = this.tasks.find(x => x.id === blockId);
    if (!movingTask) {
      console.warn('[Store] ❌ Could not find moving task in store:', blockId);
      return;
    }

    if (targetUsed + movingTask.durationMinutes > 60) {
      console.warn('[Store] ❌ Target slot is too full to accept this move!');
      return;
    }

    const updatedLayout = { ...currentLayout };
    updatedLayout[sourceSlot] = (updatedLayout[sourceSlot] || []).filter(id => id !== blockId);
    updatedLayout[targetSlot] = [...targetTasks, blockId];

    const updatedSession = { ...this.activeSession, layout: updatedLayout };
    this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
    await saveFlowSession(updatedSession);
    console.log(`[Store] ✅ Successfully moved ${blockId} to Slot ${targetSlot}`);
  }

  async removeBlockFromTimeline(blockId: string) {
    console.log(`[Store] 🗑️ removeBlockFromTimeline TRIGGERED for: ${blockId}`);
    if (!this.activeSession) return;
    
    const updatedLayout = { ...this.activeSession.layout };
    for (const slotStr in updatedLayout) {
       updatedLayout[slotStr] = updatedLayout[slotStr].filter(id => id !== blockId);
    }

    const updatedSession = { ...this.activeSession, layout: updatedLayout };
    this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
    await saveFlowSession(updatedSession);
    
    this.tasks = this.tasks.filter(t => t.id !== blockId);
    await deleteFlowTask(blockId);
    console.log(`[Store] ✅ Deleted child chunk ${blockId}. Parent time is restored in Inbox.`);
  }
  /* ==========================================================================
     EXECUTION RUNNER (THE DOMINO ENGINE)
     ========================================================================== */

  startSession() {
    if (!this.activeSession || this.flatLayout.length === 0) return;
    this.isExecutionMode = true;
    this.activeBlockId = this.flatLayout[0];
    
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
    const currentIndex = this.flatLayout.indexOf(this.activeBlockId);
    if (currentIndex >= 0 && currentIndex < this.flatLayout.length - 1) {
      this.activeBlockId = this.flatLayout[currentIndex + 1];
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
      
      const updatedLayout = { ...this.activeSession.layout };
      for (const slotStr in updatedLayout) {
        updatedLayout[slotStr] = updatedLayout[slotStr].map(id => id === blockId ? newId : id);
      }
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