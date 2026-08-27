import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { eventStore } from '../stores/eventStore.svelte';
import { calendarState } from '../stores/calendarState.svelte';
import { resolveEventColorToken } from './colors';
import { createProjectedSnapshot } from './dateMath';
import { format, parseISO, subMinutes, isAfter, isValid, startOfDay, addDays } from 'date-fns';

export async function initializeNotifications() {
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }
  return permissionGranted;
}

export function scheduleNextReminder() {
    const now = new Date();
    let nextReminder: any = null;

    const futureLimit = addDays(now, 14);

    // We MUST loop through days explicitly to get the dateKey so we can project recurring events.
    // Otherwise, recurring events will report their original start time from years ago!
    let currentDay = startOfDay(now);

    while (currentDay <= futureLimit) {
        const dateKey = format(currentDay, 'yyyy-MM-dd');
        const dayEvents = eventStore.getEventsForDateKey(dateKey);

        for (const rawEvt of dayEvents) {
            if (!rawEvt.reminders || rawEvt.reminders.length === 0) continue;

            // CRITICAL FIX: Project the event so its startTime mathematically moves forward to the current day!
            const evt = createProjectedSnapshot(rawEvt, dateKey);

            const start = parseISO(evt.startTime);
            if (!isValid(start)) continue;

            for (const rem of evt.reminders) {
                let mins = 0;
                if (rem.endsWith('m')) mins = parseInt(rem);
                else if (rem.endsWith('h')) mins = parseInt(rem) * 60;
                else if (rem.endsWith('d')) mins = parseInt(rem) * 1440;

                const reminderTime = subMinutes(start, mins);

                if (isAfter(reminderTime, now)) {
                    if (!nextReminder || reminderTime.getTime() < nextReminder.timeMs) {
                        const cal = calendarState.calendars.find(c => c.id === evt.calendarId || c.googleCalendarId === evt.calendarId);
                        const color = resolveEventColorToken(evt.colorOverride || cal?.colorHex).hex;

                        nextReminder = {
                            title: evt.title || '(No Title)',
                            time_str: evt.isAllDay ? 'All Day' : format(start, 'h:mm a'),
                            time_until: rem,
                            color: color,
                            timeMs: reminderTime.getTime()
                        };
                    }
                }
            }
        }
        currentDay = addDays(currentDay, 1);
    }

    if (nextReminder) {
        invoke('schedule_next_notification', { 
            payload: {
                title: nextReminder.title,
                time_str: nextReminder.time_str,
                time_until: nextReminder.time_until,
                color: nextReminder.color
            }, 
            timeMs: nextReminder.timeMs
        }).catch(console.error);
    } else {
        invoke('schedule_next_notification', { payload: null, timeMs: null }).catch(console.error);
    }
}

// Reuse a single AudioContext so it never hits the browser hardware limit
let audioCtx: AudioContext | null = null;

export function unlockAudioEngine() {
    // This securely unlocks the browser Autoplay Policy when the user first clicks the app
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

export function playPremiumChime() {
    try {
        unlockAudioEngine();

        // Premium Double-Chime (Ding-Dong)
        const playNote = (freq: number, startTime: number) => {
            const osc = audioCtx!.createOscillator();
            const gain = audioCtx!.createGain();
            osc.connect(gain);
            gain.connect(audioCtx!.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05); // Louder volume
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);
            
            osc.start(startTime);
            osc.stop(startTime + 0.8);
        };

        const now = audioCtx!.currentTime;
        playNote(784, now);       // G5
        playNote(1046.50, now + 0.15); // C6
    } catch (e) {
        console.warn("Audio not supported", e);
    }
}

export function setupNotificationListener() {
    // We renamed this so the Main Window plays the sound instantly
    listen('play_chime', () => {
        playPremiumChime();
    });
}