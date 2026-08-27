<script lang="ts">
  import { onMount } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';
  import { Calendar, Clock, X, Bell } from 'lucide-svelte';

  // Flat state variables guarantee DOM updates
  let title = $state('Loading...');
  let timeStr = $state('');
  let timeUntil = $state('');
  let color = $state('#3b82f6'); // Default color while loading

  onMount(() => {
    const unlisten = listen<any>('show_reminder', (event) => {
      if (event.payload) {
        // Parse the exact data Rust sent over
        const data = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
        title = data.title || title;
        timeStr = data.time_str || timeStr;
        timeUntil = data.time_until || timeUntil;
        color = data.color || color;
      }
    });
    return () => { unlisten.then(f => f()); };
  });

  async function dismiss() {
    await invoke('hide_notification_window');
  }

  async function openApp() {
    await invoke('show_main_window');
    await invoke('hide_notification_window');
  }
</script>

<!-- We pass the dynamic color into the CSS as a global variable -->
<div class="notification-card" style="--event-color: {color};">
  <div class="color-strip"></div>

  <div class="content">
    <div class="header">
      <div class="icon-ring">
        <Bell size={12} style="color: var(--event-color);" />
      </div>
      <span class="label">KAIRO REMINDER</span>
      {#if timeUntil}
        <span class="time-badge">in {timeUntil}</span>
      {/if}
    </div>
    
    <div class="title" title={title}>{title}</div>
    
    {#if timeStr}
      <div class="details">
        <Clock size={12} />
        <span>{timeStr}</span>
      </div>
    {/if}
  </div>
  
  <div class="actions">
    <button class="btn btn-icon" onclick={dismiss} title="Dismiss">
      <X size={15} />
    </button>
    <button class="btn btn-primary" onclick={openApp}>
      <Calendar size={13} />
      <span>Open</span>
    </button>
  </div>
</div>

<style>
  :global(body, html) {
    background: transparent !important;
    overflow: hidden;
    margin: 0;
    padding: 0;
  }

  .notification-card {
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    background-color: #1c1c1c;
    border: 1px solid #333;
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: stretch;
    overflow: hidden;
    color: white;
    font-family: system-ui, -apple-system, sans-serif;
    user-select: none;
  }

  .color-strip {
    width: 6px;
    flex-shrink: 0; /* Never squish the color strip */
    background-color: var(--event-color);
    transition: background-color 0.3s ease;
  }

  .content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 12px 14px;
    flex: 1;
    min-width: 0; /* CRITICAL FIX: Forces long text to truncate instead of breaking the layout! */
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .icon-ring {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--event-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--event-color) 30%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0; /* Never squish the icon */
  }

  .label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #888;
    white-space: nowrap; /* CRITICAL FIX: Stops text from wrapping to 2 lines */
  }

  .time-badge {
    font-size: 10px;
    font-weight: 700;
    color: var(--event-color);
    background: color-mix(in srgb, var(--event-color) 15%, transparent);
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap; /* CRITICAL FIX: Stops text from wrapping */
    flex-shrink: 0; 
  }

  .title {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis; /* Adds the "..." if the title is too long */
    margin-bottom: 4px;
  }

  .details {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #aaa;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 14px;
    flex-shrink: 0; /* Prevents the buttons from getting squished by long titles */
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    white-space: nowrap;
  }

  .btn-icon {
    background-color: transparent;
    color: #888;
    padding: 8px;
  }

  .btn-icon:hover {
    background-color: #333;
    color: #fff;
  }

  .btn-primary {
    background-color: var(--event-color);
    color: #fff;
    padding: 8px 12px;
    font-size: 12px;
    transition: background-color 0.3s ease, box-shadow 0.3s ease;
  }

  .btn-primary:hover {
    background-color: color-mix(in srgb, var(--event-color) 80%, white);
    box-shadow: 0 0 12px color-mix(in srgb, var(--event-color) 50%, transparent);
  }
</style>