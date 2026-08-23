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
  
  // Pointer Drag State (Bypasses HTML5)
  isDragging = $state(false);
  dragPayload = $state<{type: 'inbox' | 'timeline', id: string, sourceSlot?: number} | null>(null);

  startDrag(payload: {type: 'inbox' | 'timeline', id: string, sourceSlot?: number}) {
    this.isDragging = true;
    this.dragPayload = payload;
    document.body.style.cursor = 'grabbing';
  }

  clearDrag() {
    this.isDragging = false;
    this.dragPayload = null;
    document.body.style.cursor = '';
  }
  
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

  // Grouped execution sequence (Merges consecutive chunks of the same task)
  get executionSequence() {
    const rawIds = this.flatLayout;
    const sequence: { id: string, title: string, parentId: string, durationMinutes: number, chunkIds: string[] }[] = [];

    for (const id of rawIds) {
      const block = this.timelineBlocks.find(b => b.id === id);
      if (!block) continue;

      const parentId = block.parentId || block.id;
      const last = sequence[sequence.length - 1];

      // If the current block shares a parent with the previous block, merge them!
      if (last && last.parentId === parentId) {
        last.durationMinutes += block.durationMinutes;
        last.chunkIds.push(block.id);
      } else {
        sequence.push({
          id: block.id, // Primary active ID for HUD lookup
          parentId,
          title: block.title,
          durationMinutes: block.durationMinutes,
          chunkIds: [block.id]
        });
      }
    }
    return sequence;
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

  async updateBlockDuration(blockId: string, blockType: string, newDurationMinutes: number) {
    console.log(`[Store] ⏱️ Updating duration for ${blockId} to ${newDurationMinutes}m`);
    if (blockType === 'custom_task') {
      this.tasks = this.tasks.map(t => t.id === blockId ? { ...t, durationMinutes: newDurationMinutes } : t);
      const updated = this.tasks.find(t => t.id === blockId);
      if (updated) await saveFlowTask(updated);
    } else if (blockType === 'calendar_event') {
      const events = eventStore.getEventsForDateKey(this.activeDateKey);
      const e = events.find(x => x.id === blockId);
      if (e) {
        const start = parseISO(e.startTime);
        const newEnd = addMinutes(start, newDurationMinutes);
        const updated = { ...e, endTime: newEnd.toISOString(), updatedAt: new Date().toISOString() };
        eventStore.updateEvent(updated);
      }
    }
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
    console.log(`[Store] 🔄 moveBlockToSlot: ${blockId} from Slot ${sourceSlot} -> Slot ${targetSlot}`);
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
      console.warn('[Store] ❌ Could not find moving task:', blockId);
      return;
    }

    const availableInTarget = 60 - targetUsed;
    
    if (availableInTarget <= 0) {
      console.warn('[Store] ❌ Target slot is completely full!');
      return;
    }

    if (movingTask.durationMinutes <= availableInTarget) {
      // Standard Move - Fits completely
      const updatedLayout = { ...currentLayout };
      updatedLayout[sourceSlot] = (updatedLayout[sourceSlot] || []).filter(id => id !== blockId);
      updatedLayout[targetSlot] = [...targetTasks, blockId];

      const updatedSession = { ...this.activeSession, layout: updatedLayout };
      this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
      await saveFlowSession(updatedSession);
      console.log(`[Store] ✅ Successfully moved ${blockId} to Slot ${targetSlot}`);
    } else {
      // Splitting Logic - Chunk the task
      console.log(`[Store] ✂️ Splitting moved task to fit ${availableInTarget}m space`);
      const chunkForTarget = availableInTarget;
      const remainingInSource = movingTask.durationMinutes - availableInTarget;
      
      // 1. Shrink original chunk in source slot
      this.tasks = this.tasks.map(t => t.id === blockId ? { ...t, durationMinutes: remainingInSource } : t);
      await saveFlowTask(this.tasks.find(t => t.id === blockId)!);
      
      // 2. Create new chunk for target slot
      const newChunkId = 'task_' + Date.now() + Math.floor(Math.random() * 1000);
      const newChunk: FlowTask = {
        ...movingTask,
        id: newChunkId,
        durationMinutes: chunkForTarget,
        createdAt: new Date().toISOString()
      };
      
      this.tasks = [...this.tasks, newChunk];
      await saveFlowTask(newChunk);
      
      // 3. Add new chunk to target slot layout
      const updatedLayout = { ...currentLayout };
      updatedLayout[targetSlot] = [...targetTasks, newChunkId];
      
      const updatedSession = { ...this.activeSession, layout: updatedLayout };
      this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
      await saveFlowSession(updatedSession);
    }
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
    if (!this.activeSession || this.executionSequence.length === 0) return;
    this.isExecutionMode = true;
    
    const firstStep = this.executionSequence[0];
    this.activeBlockId = firstStep.id;
    this.timerRemainingSeconds = firstStep.durationMinutes * 60;
    this.isOvertime = false;
    this.startTimer();
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
    
    const currentStep = this.executionSequence.find(s => s.id === this.activeBlockId);
    if (!currentStep) return;

    // The Domino Push: Update the duration of the LAST chunk in the merged group
    const lastChunkId = currentStep.chunkIds[currentStep.chunkIds.length - 1];
    
    if (lastChunkId.startsWith('task_')) {
      this.tasks = this.tasks.map(t => t.id === lastChunkId ? { ...t, durationMinutes: t.durationMinutes + 15 } : t);
      await saveFlowTask(this.tasks.find(t => t.id === lastChunkId)!);
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

    const currentStepIndex = this.executionSequence.findIndex(s => s.id === this.activeBlockId);
    const currentStep = this.executionSequence[currentStepIndex];
    if (!currentStep) return;

    // If we were in overtime, lock in the exact tracked minutes to the LAST chunk
    if (this.isOvertime) {
      const extraMinutes = Math.ceil(this.timerRemainingSeconds / 60);
      const lastChunkId = currentStep.chunkIds[currentStep.chunkIds.length - 1];
      
      if (lastChunkId.startsWith('task_')) {
        this.tasks = this.tasks.map(t => t.id === lastChunkId ? { ...t, durationMinutes: t.durationMinutes + extraMinutes } : t);
        await saveFlowTask(this.tasks.find(t => t.id === lastChunkId)!);
      }
      const updatedSession = { ...this.activeSession, overtimeMinutes: this.activeSession.overtimeMinutes + extraMinutes };
      this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
      await saveFlowSession(updatedSession);
    }

    // Mark ALL chunks in the merged group as completed
    for (const chunkId of currentStep.chunkIds) {
      if (chunkId.startsWith('task_')) {
        this.tasks = this.tasks.map(t => t.id === chunkId ? { ...t, isCompleted: true } : t);
        const t = this.tasks.find(x => x.id === chunkId);
        if (t) await saveFlowTask(t);
      }
    }

    // Progress to next grouped step
    if (currentStepIndex >= 0 && currentStepIndex < this.executionSequence.length - 1) {
      const nextStep = this.executionSequence[currentStepIndex + 1];
      this.activeBlockId = nextStep.id;
      this.timerRemainingSeconds = nextStep.durationMinutes * 60;
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

  async reorderTimeline(fromIndex: number, toIndex: number) {
    if (!this.activeSession) return;
    
    // 1. Reorder the merged execution sequence
    const seq = [...this.executionSequence];
    const [moved] = seq.splice(fromIndex, 1);
    seq.splice(toIndex, 0, moved);

    // 2. Identify all chunk IDs currently on the timeline to clear them
    const chunksToDelete = this.executionSequence.flatMap(s => s.chunkIds).filter(id => {
      const t = this.tasks.find(x => x.id === id);
      return t && t.parentId; // Only target child chunks, protecting original inbox tasks
    });
    
    let newTasks = this.tasks.filter(t => !chunksToDelete.includes(t.id));
    
    // Delete old chunks from DB
    for (const id of chunksToDelete) {
      await deleteFlowTask(id);
    }
    
    // 3. Sequentially repack the entire timeline!
    const newLayout: Record<number, string[]> = {};
    let currentSlot = 0;
    let currentSlotUsed = 0;

    for (const item of seq) {
      let remainingMins = item.durationMinutes;
      
      while (remainingMins > 0) {
        const availableInSlot = 60 - currentSlotUsed;
        if (availableInSlot === 0) {
          currentSlot++;
          currentSlotUsed = 0;
          continue;
        }

        const chunkMins = Math.min(remainingMins, availableInSlot);
        const chunkId = 'task_' + Date.now() + Math.floor(Math.random() * 100000);
        
        const childTask: FlowTask = {
          id: chunkId,
          parentId: item.parentId, // Keep it linked to the original task
          dateKey: this.activeDateKey,
          title: item.title,
          durationMinutes: chunkMins,
          isCompleted: false,
          createdAt: new Date().toISOString()
        };
        
        newTasks.push(childTask);
        await saveFlowTask(childTask);

        if (!newLayout[currentSlot]) newLayout[currentSlot] = [];
        newLayout[currentSlot].push(chunkId);
        
        currentSlotUsed += chunkMins;
        remainingMins -= chunkMins;
      }
    }

    this.tasks = newTasks;
    
    // 4. Save and trigger reactivity
    const updatedSession = { ...this.activeSession, layout: newLayout };
    this.sessions = this.sessions.map(s => s.id === updatedSession.id ? updatedSession : s);
    await saveFlowSession(updatedSession);
  }
  
}


export const plannerStore = new PlannerStore();