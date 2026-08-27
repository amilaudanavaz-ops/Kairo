<!-- ========================================== -->
<!-- TRAY UI COMPONENT (src/lib/components/tray/TrayPanel.svelte) -->
<!-- ========================================== -->

<script lang="ts">
    import { onMount } from 'svelte';
    import { listen } from '@tauri-apps/api/event';
    import { invoke } from '@tauri-apps/api/core';
    import { eventStore } from '../../stores/eventStore.svelte';
    import { calendarState } from '../../stores/calendarState.svelte';
    import { resolveEventColorToken } from '../../utils/colors';
    import { format, parseISO, addDays } from 'date-fns';

    type MinimalEvent = {
        id: string;
        title: string;
        timeStr: string;
        dateStr: string;
        color: string;
        timestamp: number;
    };

    // Reactively build the list based on visibility, colors, and recurring projections
    let trayData = $derived.by(() => {
        const visibleCalendarIds = new Set(
            calendarState.calendars
                .filter(c => c.isVisible !== false)
                .flatMap(c => [c.id, c.googleCalendarId].filter(Boolean))
        );

        const now = new Date();
        let today: MinimalEvent[] = [];
        let upcoming: MinimalEvent[] = [];

        // Scan the next 14 days using Kairo's exact date projection engine
        for (let i = 0; i < 14; i++) {
            const targetDate = addDays(now, i);
            const dayKey = format(targetDate, 'yyyy-MM-dd');
            // This gets ALL events, including generated recurring ones, for this exact day
            const dayEvents = eventStore.getEventsForDateKey(dayKey);

            for (const e of dayEvents) {
                // Respect Calendar Visibility Toggles
                if (calendarState.calendars.length > 0 && !visibleCalendarIds.has(e.calendarId)) continue;

                const cal = calendarState.calendars.find(c => c.id === e.calendarId || c.googleCalendarId === e.calendarId);
                const color = resolveEventColorToken(e.colorOverride || cal?.colorHex).hex;

                const originalStart = parseISO(e.startTime);
                
                // Map the time to the current projected targetDate
                const projectedStart = new Date(
                    targetDate.getFullYear(),
                    targetDate.getMonth(),
                    targetDate.getDate(),
                    originalStart.getHours(),
                    originalStart.getMinutes(),
                    originalStart.getSeconds()
                );

                const timeStr = e.isAllDay ? 'All Day' : format(projectedStart, 'h:mm a');
                const title = e.title || '(No Title)';
                
                // Recurring events share the same ID, so we append the date to make it unique for Svelte's #each block
                const uniqueId = `${e.id}_${dayKey}`;

                if (i === 0) {
                    today.push({ id: uniqueId, title, timeStr, dateStr: 'Today', color, timestamp: projectedStart.getTime() });
                } else {
                    let dateStr = format(targetDate, 'MMM d');
                    if (i === 1) dateStr = 'Tomorrow';
                    upcoming.push({ id: uniqueId, title, timeStr, dateStr, color, timestamp: projectedStart.getTime() });
                }
            }
        }

        // Sort items by time of day
        today.sort((a, b) => a.timestamp - b.timestamp);
        upcoming.sort((a, b) => a.timestamp - b.timestamp);

        return {
            today,
            upcoming: upcoming.slice(0, 15) // Show up to 15 upcoming items
        };
    });

    onMount(() => {
        const unlistenTrayOpened = listen('tray_opened', () => {
            // Force the window to grab focus from the OS so "click away" blur works
            window.focus(); 
        });

        return () => {
            unlistenTrayOpened.then((f) => f());
        };
    });
</script>

<div class="tray-panel">
    <header class="tray-header">
        <h2>Kairo</h2>
        <button class="open-app-btn" onclick={() => invoke('show_main_window')}>
            Open App
        </button>
    </header>

    <div class="tray-scroll-area">
        {#if eventStore.isLoading}
            <div class="loading">Loading schedule...</div>
        {:else}
            <!-- TODAY EVENTS -->
            <div class="section-title">Today</div>
            {#if trayData.today.length === 0}
                <div class="empty-state">No events today.</div>
            {:else}
                {#each trayData.today as event (event.id)}
                    <!-- Apply dynamic border color here -->
                    <div class="event-card" style="border-left-color: {event.color};">
                        <span class="event-time">{event.timeStr}</span>
                        <span class="event-title">{event.title}</span>
                    </div>
                {/each}
            {/if}

            <!-- UPCOMING EVENTS -->
            <div class="section-title">Upcoming</div>
            {#if trayData.upcoming.length === 0}
                <div class="empty-state">No upcoming events.</div>
            {:else}
                {#each trayData.upcoming as event (event.id)}
                    <!-- Apply dynamic border color here -->
                    <div class="event-card upcoming" style="border-left-color: {event.color};">
                        <div class="upcoming-date">{event.dateStr}</div>
                        <div class="upcoming-details">
                            <span class="event-time">{event.timeStr}</span>
                            <span class="event-title">{event.title}</span>
                        </div>
                    </div>
                {/each}
            {/if}
        {/if}
    </div>
</div>

<style>
    .tray-panel {
        width: 320px;
        max-height: 450px;
        background-color: #1a1a1a; 
        border: 1px solid #333;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        color: #fff;
        font-family: system-ui, -apple-system, sans-serif;
    }

    .tray-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #333;
        background-color: #222;
        border-top-left-radius: 12px;
        border-top-right-radius: 12px;
    }

    .tray-header h2 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .open-app-btn {
        background: transparent;
        border: 1px solid #555;
        color: #ccc;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
    }

    .open-app-btn:hover {
        background: #333;
        color: #fff;
    }

    .tray-scroll-area {
        flex: 1;
        overflow-y: auto;
        padding: 12px 16px;
        scrollbar-width: thin;
        scrollbar-color: #555 transparent;
    }

    .section-title {
        font-size: 12px;
        text-transform: uppercase;
        color: #888;
        font-weight: 700;
        margin-top: 16px;
        margin-bottom: 8px;
    }
    .section-title:first-child {
        margin-top: 0;
    }

    .event-card {
        display: flex;
        align-items: center;
        background-color: #252525;
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 6px;
        border-left: 3px solid #007acc; /* Fallback color */
    }

    .event-card.upcoming {
        flex-direction: column;
        align-items: flex-start;
    }

    .upcoming-date {
        font-size: 11px;
        color: #aaa;
        margin-bottom: 4px;
    }

    .upcoming-details {
        display: flex;
        align-items: center;
        width: 100%;
    }

    .event-time {
        font-size: 12px;
        color: #aaa;
        min-width: 65px;
        font-weight: 500;
    }

    .event-title {
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .empty-state, .loading {
        font-size: 13px;
        color: #666;
        text-align: center;
        padding: 20px 0;
        font-style: italic;
    }
</style>