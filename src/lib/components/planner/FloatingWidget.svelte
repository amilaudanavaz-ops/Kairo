<!-- ==========================================================================
     SCRIPT SECTION
     ========================================================================== -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { plannerStore } from '../../stores/plannerStore.svelte';
  import { Play, Pause, Square, Check, Plus, Timer } from 'lucide-svelte';
  import { emit } from '@tauri-apps/api/event';
  import { getCurrentWindow, primaryMonitor } from '@tauri-apps/api/window';
  import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';

  const appWindow = getCurrentWindow();

  let isHovered = $state(false);
  let isHidden = $state(false); 
  let activeState = $derived(plannerStore.widgetState);
  let isDecisionTime = $derived(activeState?.timerRemainingSeconds <= 0 && !activeState?.isOvertime);

  let needsExpansion = $derived(isHovered || isDecisionTime);
  let isVisualExpanded = $state(false); 
  let expansionTimer: number;

  function sendCommand(action: string) {
    emit('kflow_command', action);
  }

  // Reactive Engine for Window Bounds & Animations
  $effect(() => {
    if (!activeState) return;

    const adjustWindow = async () => {
      const monitor = await primaryMonitor();
      if (!monitor) return;
      
      const scale = monitor.scaleFactor;
      const logicalWidth = monitor.size.width / scale;
      const logicalHeight = monitor.size.height / scale;

      clearTimeout(expansionTimer);

      if (needsExpansion) {
        const w = 410;
        const x = logicalWidth - w - 30; // 30px right margin
        const y = logicalHeight - 60 - 50;
        
        // 1. Force the OS to widen the window FIRST.
        // Because the OS anchors top-left, this extends the window rightward (off-screen),
        // preventing the pill from ever jumping into the middle of the screen.
        await appWindow.setSize(new LogicalSize(w, 60));
        
        // 2. Wait exactly 2 frames (30ms) for the OS graphics compositor to catch up
        await new Promise(r => setTimeout(r, 15));
        
        // 3. Now move the window safely to the left
        await appWindow.setPosition(new LogicalPosition(x, y));
        
        // 4. Trigger the smooth CSS animation inside the now-stable window
        expansionTimer = window.setTimeout(() => {
          isVisualExpanded = true;
        }, 30);

      } else {
        // 1. Shrink visually via CSS first
        isVisualExpanded = false;
        
        // 2. Wait 300ms for CSS transition to finish
        expansionTimer = window.setTimeout(async () => {
          if (needsExpansion) return; // Abort if user hovered back over
          
          const w = 180; // Compact width
          const x = logicalWidth - w - 30;
          const y = logicalHeight - 60 - 50;

          // 3. When shrinking, do the reverse: Move the window right FIRST
          await appWindow.setPosition(new LogicalPosition(x, y));
          
          // 4. Wait 2 frames for OS
          await new Promise(r => setTimeout(r, 10));
          
          // 5. Finally, chop the width back down to 180px
          await appWindow.setSize(new LogicalSize(w, 60));
        }, 300);
      }
    };

    adjustWindow();
  });

  onMount(() => {
    const handshake = setInterval(() => {
      if (activeState) clearInterval(handshake);
      else sendCommand('request_sync');
    }, 250);

    async function setupInitialPosition() {
      const monitor = await primaryMonitor();
      if (monitor) {
        const logicalWidth = monitor.size.width / monitor.scaleFactor;
        const logicalHeight = monitor.size.height / monitor.scaleFactor;
        const x = logicalWidth - 210 - 30;
        const y = logicalHeight - 60 - 50; 
        
        await appWindow.setSize(new LogicalSize(210, 60));
        await appWindow.setPosition(new LogicalPosition(x, y));
      }
    }
    setupInitialPosition();

    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.key === 'Control' || e.key === 'Meta') && !isHidden) {
        isHidden = true;
        await appWindow.setIgnoreCursorEvents(true); 
      }
    };
    
    const handleKeyUp = async (e: KeyboardEvent) => {
      if ((e.key === 'Control' || e.key === 'Meta') && isHidden) {
        isHidden = false;
        await appWindow.setIgnoreCursorEvents(false); 
      }
    };

    const handleBlur = async () => {
      if (isHidden) {
        isHidden = false;
        await appWindow.setIgnoreCursorEvents(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  });

  let formattedTime = $derived.by(() => {
    if (!activeState) return '00:00';
    const totalSeconds = Math.abs(activeState.timerRemainingSeconds || 0);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (num: number) => num.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  });
</script>

<!-- ==========================================================================
     GLOBAL OS WINDOW STYLES
     ========================================================================== -->
<svelte:head>
  <style>
    html, body {
      background-color: transparent !important;
      overflow: hidden;
      margin: 0;
      padding: 0;
    }
  </style>
</svelte:head>

<!-- ==========================================================================
     LOCAL VANILLA CSS
     ========================================================================== -->
<style>
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* --- Main Wrapper --- */
  .widget-wrapper {
    position: fixed; /* THE MAGIC FIX: Anchors layout to the OS window edge */
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0rem 0rem 1rem 0rem;
    background-color: transparent;
    user-select: none;
    transition: opacity 0.2s ease;
    pointer-events: none; 
  }
  .widget-wrapper.is-hidden { opacity: 0; }
  .widget-wrapper.is-visible { opacity: 1; }

  /* --- Syncing Pill --- */
  .sync-pill {
    width: 200px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    border: 1px solid #333;
    background-color: rgba(26, 26, 26, 0.95);
    backdrop-filter: blur(12px);
    pointer-events: auto;
  }
  .sync-text {
    font-size: 0.75rem;
    font-weight: 700;
    color: #818cf8;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  /* --- Dynamic Layout Pill --- */
  .pill-container {
    position: relative;
    display: flex;
    align-items: center;
    height: 2.5rem;
    padding: 0 1.25rem;
    gap: 1rem;
    border-radius: 9999px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    border: 1px solid #333;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    pointer-events: auto;
    background-color: rgba(26, 26, 26, 0.95);
  }
  .pill-container.expanded { width: 340px; }
  .pill-container.compact { width: 180px; }
  
  .pill-container.decision {
    background-color: rgba(67, 20, 7, 0.9);
    border-color: rgba(249, 115, 22, 0.5);
  }
  .pill-container.overtime {
    border-color: #f43f5e;
  }

  /* --- Left Anchor: Dot & Timer --- */
  .left-anchor {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .status-dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 9999px;
  }
  .status-dot.paused { background-color: #f59e0b; }
  .status-dot.decision {
    background-color: #f97316;
    animation: pulse 2s infinite;
    box-shadow: 0 0 10px rgba(249, 115, 22, 0.8);
  }
  .status-dot.overtime {
    background-color: #f43f5e;
    box-shadow: 0 0 10px rgba(244, 63, 94, 0.8);
  }
  .status-dot.running {
    background-color: #10b981;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.8);
  }

  .timer-text {
    font-size: 0.875rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.05em;
    color: #f4f4f5;
    transition: color 0.3s;
  }
  .timer-text.overtime { color: #f43f5e; }
  .timer-text.decision { color: #fb923c; }

  /* --- Center: Text Block --- */
  .text-block {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
    justify-content: center;
    transition: all 0.3s;
  }

  .subtitle {
    font-size: 9px;
    font-weight: 900;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    line-height: 1;
    margin-bottom: 0.25rem;
    animation: fadeIn 0.3s ease-in-out;
  }

  .title {
    font-size: 0.75rem;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.25;
    transition: transform 0.3s;
  }
  .title.centered { transform: translateY(1px); }
  .title.overtime { color: #ffe4e6; }
  .title.decision { color: #ffedd5; }

  /* --- Right Anchor: Actions --- */
  .actions-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }
  .actions-wrapper.hidden {
    opacity: 0;
    max-width: 0;
    gap: 0;
    padding: 0;
    pointer-events: none;
  }
  .actions-wrapper.visible { 
    opacity: 1; 
    max-width: 150px; 
  }

  .btn-base {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    font-weight: 400;
    font-size: 0.55rem;
    cursor: pointer;
    transition: background-color 0.2s, border-color 0.2s, color 0.2s;
    outline: none;
    border: 1px solid transparent;
  }

  .btn-decision { padding: 0.375rem 0.375rem; gap: 6px; }
  
  .btn-done {
    background-color: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.5);
    color: #34d399;
  }
  .btn-done:hover { background-color: rgba(16, 185, 129, 0.3); }

  .btn-add {
    background-color: #2a2a2a;
    color: #d4d4d8;
  }
  .btn-add:hover {
    background-color: #333333;
    border-color: #71717a;
  }

  .btn-overtime {
    background-color: rgba(244, 63, 94, 0.2);
    border-color: rgba(244, 63, 94, 0.5);
    color: #fb7185;
  }
  .btn-overtime:hover { background-color: rgba(244, 63, 94, 0.3); }

  .btn-icon-sq { width: 1.5rem; height: 1.5rem; }

  .btn-sq-complete {
    background-color: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #10b981;
  }
  .btn-sq-complete:hover { background-color: rgba(16, 185, 129, 0.2); }

  .btn-sq-pause {
    background-color: #2a2a2a;
    color: #d4d4d8;
  }
  .btn-sq-pause:hover { background-color: #f59f0b2a; color: #f59e0b; }

  .btn-sq-stop {
    background-color: #2a2a2a;
    color: #d4d4d8;
  }
  .btn-sq-stop:hover {
    background-color: rgba(244, 63, 94, 0.2);
    color: #fb7185;
  }
</style>

<!-- ==========================================================================
     TEMPLATE SECTION
     ========================================================================== -->
<main 
  class="widget-wrapper" 
  class:is-hidden={isHidden} 
  class:is-visible={!isHidden}
>
  
  {#if !activeState}
    <div class="sync-pill">
      <span class="sync-text">Syncing...</span>
    </div>
  
  {:else if activeState.isExecutionMode}
    <div 
      onmouseenter={() => isHovered = true}
      onmouseleave={() => isHovered = false}
      class="pill-container"
      class:expanded={isVisualExpanded}
      class:compact={!isVisualExpanded}
      class:decision={isDecisionTime}
      class:overtime={!isDecisionTime && activeState.isOvertime}
    >
      
      <div class="left-anchor">
        <div class="status-dot"
             class:paused={activeState.isPaused}
             class:decision={isDecisionTime}
             class:overtime={!isDecisionTime && activeState.isOvertime}
             class:running={!isDecisionTime && !activeState.isOvertime && !activeState.isPaused}>
        </div>
        <div class="timer-text"
             class:decision={isDecisionTime}
             class:overtime={!isDecisionTime && activeState.isOvertime}>
          {activeState.isOvertime ? '+' : ''}{formattedTime}
        </div>
      </div>

      <div class="text-block">
        {#if isVisualExpanded}
          <span class="subtitle">
            {isDecisionTime ? 'Waiting for input' : activeState.isPaused ? 'Paused' : 'Working On'}
          </span>
        {/if}
        <span class="title"
              class:centered={!isVisualExpanded}
              class:decision={isDecisionTime}
              class:overtime={!isDecisionTime && activeState.isOvertime}>
          {activeState.activeTitle}
        </span>
      </div>

      <div class="actions-wrapper"
           class:visible={isVisualExpanded}
           class:hidden={!isVisualExpanded}>
        
        {#if isDecisionTime}
          <button onclick={() => sendCommand('complete')} class="btn-base btn-decision btn-done">
            <Check size={7} strokeWidth={1} /> Done
          </button>
          <button onclick={() => sendCommand('add_15')} class="btn-base btn-decision btn-add">
            +15m
          </button>
          <button onclick={() => sendCommand('overtime')} class="btn-base btn-decision btn-overtime">
            Overtime
          </button>
        
        {:else}
          <button onclick={() => sendCommand('complete')} class="btn-base btn-icon-sq btn-sq-complete" title="Complete Task">
            <Check size={16} strokeWidth={3} />
          </button>
          <button onclick={() => sendCommand('pause_play')} class="btn-base btn-icon-sq btn-sq-pause" title={activeState.isPaused ? "Resume" : "Pause"}>
            {#if activeState.isPaused}
              <Play size={14} fill="currentColor" />
            {:else}
              <Pause size={14} fill="currentColor" />
            {/if}
          </button>
          <button onclick={() => sendCommand('stop')} class="btn-base btn-icon-sq btn-sq-stop" title="Stop Session">
            <Square size={12} fill="currentColor" />
          </button>
        {/if}

      </div>
    </div>
  {/if}
</main>