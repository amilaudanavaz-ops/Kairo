import { 
  isPermissionGranted, 
  requestPermission, 
  sendNotification 
} from '@tauri-apps/plugin-notification';
import type { CalendarEvent } from '../../types/event';

export async function dispatchEventReminder(event: CalendarEvent) {
  let hasPermission = await isPermissionGranted();
  if (!hasPermission) {
    const permission = await requestPermission();
    hasPermission = permission === 'granted';
  }

  if (hasPermission) {
    sendNotification({
      title: event.title || 'Calendar Reminder',
      body: `Upcoming task at ${new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    });
  }
}