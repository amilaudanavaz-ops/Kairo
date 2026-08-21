import { invoke } from '@tauri-apps/api/core';
import type { UserAccount, CalendarCategory } from '../../types/event';
import { 
  loadDbSettings, 
  persistDbSetting, 
  loadDbAccounts, 
  persistDbAccount, 
  deleteDbAccount, 
  clearAllDbAccounts, 
  loadInitialCalendars,
  getDb
} from '../db/database';
import { eventStore } from './eventStore.svelte';
import { calendarState } from './calendarState.svelte';

export type SettingsTab = 
  | 'general' 
  | 'profile' 
  | 'notifications' 
  | 'menubar' 
  | 'conferencing' 
  | 'accounts' 
  | 'calendars' 
  | 'appearance' 
  | 'integrations' 
  | 'shortcuts';

export interface GoogleAuthResultPayload {
  profile: {
    id: string;
    email: string;
    name?: string;
    picture?: string;
  };
  access_token: string;
  refresh_token?: string;
  calendars: Array<{
    id: string;
    summary?: string;
    backgroundColor?: string;
    background_color?: string;
    primary?: boolean;
    accessRole?: string;
    access_role?: string;
  }>;
}

const ENV_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.GOOGLE_CLIENT_ID || '').trim();
const ENV_CLIENT_SECRET = (import.meta.env.VITE_GOOGLE_CLIENT_SECRET || import.meta.env.GOOGLE_CLIENT_SECRET || '').trim();

class SettingsStore {
  isCommandMenuOpen = $state(false);
  pressTAction = $state<'today' | 'view'>('today');

  toggleCommandMenu(): void {
    this.isCommandMenuOpen = !this.isCommandMenuOpen;
  }

  openCommandMenu(): void {
    this.isCommandMenuOpen = true;
  }

  closeCommandMenu(): void {
    this.isCommandMenuOpen = false;
  }
  // Modal & Navigation State
  isLoaded = $state(false);
  isLoggedIn = $state(false);
  isOpen = $state(false);
  isSettingsModalOpen = $state(false);
  activeTab = $state<SettingsTab>('general');

  // User Profile
  preferredName = $state<string>('Amila Vaz');
  username = $state<string>('amilavaz');

  // General & Time Preferences
  timeFormat = $state<'12h' | '24h'>('12h');
  weekStartsOn = $state<0 | 1>(0);
  startWeekOn = $state<'Sunday' | 'Monday'>('Sunday');
  language = $state<string>('English');
  showWeekends = $state<boolean>(true);
  showDeclinedEvents = $state<boolean>(false);
  showWeekNumbers = $state<boolean>(false);
  dimPastEvents = $state<boolean>(true);
  defaultEventDuration = $state<number>(30);
  defaultView = $state<'month' | 'week' | 'day'>('month');
  defaultCalendarId = $state<string>('');
  timeZone = $state<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Conferencing Preferences
  defaultConferencing = $state<'google_meet' | 'zoom' | 'custom'>('google_meet');
  zoomPmiLink = $state<string>('');

  // Menu Bar Preferences
  menuBarEnabled = $state<boolean>(true);
  menuBarDaysSpan = $state<string>('1 day');
  menuBarIncludeAllDay = $state<boolean>(true);
  menuBarIncludeNoParticipants = $state<boolean>(false);

  // Appearance Preferences
  theme = $state<'auto' | 'dark' | 'light' | 'system'>('auto');
  accentColor = $state<string>('#3b82f6');
  compactMode = $state<boolean>(false);

  // Notifications Preferences
  notificationsEnabled = $state<boolean>(true);
  playNotificationSound = $state<boolean>(true);
  soundEnabled = $state<boolean>(true);
  defaultReminderOffset = $state<string>('15m');
  defaultNotificationOffset = $state<string>('15m');

  // Integrations & Google OAuth Credentials
  googleClientId = $state<string>(ENV_CLIENT_ID);
  googleClientSecret = $state<string>(ENV_CLIENT_SECRET);
  isGoogleAuthInProgress = $state<boolean>(false);
  autoSyncIntervalMinutes = $state<number>(5);

  // Connected User Accounts
  accounts = $state<UserAccount[]>([]);

  /* ==========================================================================
     REACTIVE DERIVATIONS
     ========================================================================== */

  hasConnectedAccounts = $derived.by(() => this.isLoggedIn || this.accounts.length > 0);
  
  primaryAccount = $derived.by(() => {
    return this.accounts.find(a => a.isPrimary) || this.accounts[0] || null;
  });

  isGoogleConfigured = $derived.by(() => {
    return Boolean(
      (this.googleClientId.trim() || ENV_CLIENT_ID) && 
      (this.googleClientSecret.trim() || ENV_CLIENT_SECRET)
    );
  });

  /* ==========================================================================
     INITIALIZATION & DATABASE HYDRATION
     ========================================================================== */

  async init(): Promise<void> {
    try {
      await getDb();

      const settings = await loadDbSettings();

      if (settings['preferred_name'] || settings['preferredName']) {
        this.preferredName = settings['preferred_name'] || settings['preferredName'];
      }
      if (settings['username']) {
        this.username = settings['username'];
      }

      if (settings['time_format'] || settings['timeFormat']) {
        this.timeFormat = (settings['time_format'] || settings['timeFormat']) as '12h' | '24h';
      }
      if (settings['week_starts_on'] !== undefined || settings['weekStartsOn'] !== undefined) {
        this.weekStartsOn = parseInt(settings['week_starts_on'] ?? settings['weekStartsOn'] ?? '0', 10) as 0 | 1;
        this.startWeekOn = this.weekStartsOn === 1 ? 'Monday' : 'Sunday';
      }
      if (settings['start_week_on'] || settings['startWeekOn']) {
        this.startWeekOn = (settings['start_week_on'] || settings['startWeekOn']) as 'Sunday' | 'Monday';
        this.weekStartsOn = this.startWeekOn === 'Monday' ? 1 : 0;
      }
      if (settings['language']) {
        this.language = settings['language'];
      }
      if (settings['show_weekends'] !== undefined || settings['showWeekends'] !== undefined) {
        this.showWeekends = (settings['show_week_ends'] || settings['showWeekends']) !== 'false';
      }
      if (settings['show_declined_events'] !== undefined || settings['showDeclinedEvents'] !== undefined) {
        this.showDeclinedEvents = (settings['show_declined_events'] || settings['showDeclinedEvents']) === 'true';
      }

      if (settings['default_event_duration'] || settings['defaultEventDuration']) {
        this.defaultEventDuration = parseInt(settings['default_event_duration'] || settings['defaultEventDuration'] || '30', 10);
      }
      if (settings['default_view'] || settings['defaultView']) {
        this.defaultView = (settings['default_view'] || settings['defaultView']) as 'month' | 'week' | 'day';
      }
      if (settings['default_calendar_id'] || settings['defaultCalendarId']) {
        this.defaultCalendarId = settings['default_calendar_id'] || settings['defaultCalendarId'];
      }
      if (settings['time_zone'] || settings['timeZone']) {
        this.timeZone = settings['time_zone'] || settings['timeZone'];
      }

      if (settings['default_conferencing'] || settings['defaultConferencing']) {
        this.defaultConferencing = (settings['default_conferencing'] || settings['defaultConferencing']) as 'google_meet' | 'zoom' | 'custom';
      }
      if (settings['zoom_pmi_link'] || settings['zoomPmiLink']) {
        this.zoomPmiLink = settings['zoom_pmi_link'] || settings['zoomPmiLink'];
      }

      if (settings['menubar_enabled'] !== undefined || settings['menuBarEnabled'] !== undefined) {
        this.menuBarEnabled = (settings['menubar_enabled'] || settings['menuBarEnabled']) !== 'false';
      }
      if (settings['menubar_days_span'] || settings['menuBarDaysSpan']) {
        this.menuBarDaysSpan = settings['menubar_days_span'] || settings['menuBarDaysSpan'];
      }
      if (settings['menubar_include_all_day'] !== undefined || settings['menuBarIncludeAllDay'] !== undefined) {
        this.menuBarIncludeAllDay = (settings['menubar_include_all_day'] || settings['menuBarIncludeAllDay']) !== 'false';
      }
      if (settings['menubar_include_no_participants'] !== undefined || settings['menuBarIncludeNoParticipants'] !== undefined) {
        this.menuBarIncludeNoParticipants = (settings['menubar_include_no_participants'] || settings['menuBarIncludeNoParticipants']) === 'true';
      }

      if (settings['theme']) {
        this.theme = settings['theme'] as 'auto' | 'dark' | 'light' | 'system';
        this.applyTheme(this.theme);
      }
      if (settings['accent_color'] || settings['accentColor']) {
        this.accentColor = settings['accent_color'] || settings['accentColor'];
      }
      if (settings['compact_mode'] !== undefined || settings['compactMode'] !== undefined) {
        this.compactMode = (settings['compact_mode'] || settings['compactMode']) === 'true';
      }
      if (settings['show_week_numbers'] !== undefined || settings['showWeekNumbers'] !== undefined) {
        this.showWeekNumbers = (settings['show_week_numbers'] || settings['showWeekNumbers']) === 'true';
      }
      if (settings['dim_past_events'] !== undefined || settings['dimPastEvents'] !== undefined) {
        this.dimPastEvents = (settings['dim_past_events'] || settings['dimPastEvents']) !== 'false';
      }

      if (settings['notifications_enabled'] !== undefined || settings['notificationsEnabled'] !== undefined) {
        this.notificationsEnabled = (settings['notifications_enabled'] || settings['notificationsEnabled']) !== 'false';
      }
      if (settings['play_notification_sound'] !== undefined || settings['playNotificationSound'] !== undefined) {
        this.playNotificationSound = (settings['play_notification_sound'] || settings['playNotificationSound']) !== 'false';
        this.soundEnabled = this.playNotificationSound;
      }
      if (settings['default_reminder_offset'] || settings['defaultReminderOffset']) {
        this.defaultReminderOffset = settings['default_reminder_offset'] || settings['defaultReminderOffset'];
        this.defaultNotificationOffset = this.defaultReminderOffset;
      }

      this.googleClientId = ENV_CLIENT_ID || settings['google_client_id'] || settings['googleClientId'] || '';
      this.googleClientSecret = ENV_CLIENT_SECRET || settings['google_client_secret'] || settings['googleClientSecret'] || '';
      
      if (settings['auto_sync_interval'] || settings['autoSyncInterval']) {
        this.autoSyncIntervalMinutes = parseInt(settings['auto_sync_interval'] || settings['autoSyncInterval'] || '5', 10);
      }

      this.accounts = await loadDbAccounts();
      this.isLoggedIn = this.accounts.length > 0 || settings['isLoggedIn'] === 'true' || settings['is_logged_in'] === 'true';

      this.isLoaded = true;
    } catch (err) {
      console.error('Failed to load settings from DB:', err);
      this.isLoaded = true;
    }
  }

  /* ==========================================================================
     SETTINGS MUTATIONS & PERSISTENCE
     ========================================================================== */

  async setSetting(key: string, value: string): Promise<void> {
    try {
      await persistDbSetting(key, value);
    } catch (err) {
      console.error(`Failed to save setting ${key}:`, err);
    }
  }

  async updateSetting(key: string, value: string): Promise<void> {
    await this.setSetting(key, value);
  }

  setTimeFormat(format: '12h' | '24h'): void {
    this.timeFormat = format;
    this.setSetting('time_format', format);
  }

  setWeekStartsOn(start: 0 | 1): void {
    this.weekStartsOn = start;
    this.startWeekOn = start === 1 ? 'Monday' : 'Sunday';
    this.setSetting('week_starts_on', String(start));
    this.setSetting('start_week_on', this.startWeekOn);
  }

  setDefaultEventDuration(minutes: number): void {
    this.defaultEventDuration = minutes;
    this.setSetting('default_event_duration', String(minutes));
  }

  setDefaultView(view: 'month' | 'week' | 'day'): void {
    this.defaultView = view;
    this.setSetting('default_view', view);
  }

  setTimeZone(tz: string): void {
    this.timeZone = tz;
    this.setSetting('time_zone', tz);
  }

  applyTheme(theme: 'auto' | 'dark' | 'light' | 'system'): void {
    this.theme = theme;
    this.setSetting('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }

  setTheme(theme: 'auto' | 'dark' | 'light' | 'system'): void {
    this.applyTheme(theme);
  }

  setAccentColor(colorHex: string): void {
    this.accentColor = colorHex;
    this.setSetting('accent_color', colorHex);
    document.documentElement.style.setProperty('--accent-color', colorHex);
  }

  setCompactMode(enabled: boolean): void {
    this.compactMode = enabled;
    this.setSetting('compact_mode', String(enabled));
  }

  setShowWeekNumbers(enabled: boolean): void {
    this.showWeekNumbers = enabled;
    this.setSetting('show_week_numbers', String(enabled));
  }

  setDimPastEvents(enabled: boolean): void {
    this.dimPastEvents = enabled;
    this.setSetting('dim_past_events', String(enabled));
  }

  setNotificationsEnabled(enabled: boolean): void {
    this.notificationsEnabled = enabled;
    this.setSetting('notifications_enabled', String(enabled));
  }

  setDefaultNotificationOffset(offset: string): void {
    this.defaultReminderOffset = offset;
    this.defaultNotificationOffset = offset;
    this.setSetting('default_reminder_offset', offset);
    this.setSetting('default_notification_offset', offset);
  }

  setSoundEnabled(enabled: boolean): void {
    this.playNotificationSound = enabled;
    this.soundEnabled = enabled;
    this.setSetting('play_notification_sound', String(enabled));
    this.setSetting('sound_enabled', String(enabled));
  }

  setGoogleCredentials(clientId: string, clientSecret: string): void {
    this.googleClientId = clientId.trim();
    this.googleClientSecret = clientSecret.trim();
    this.setSetting('google_client_id', this.googleClientId);
    this.setSetting('google_client_secret', this.googleClientSecret);
  }

  setAutoSyncInterval(minutes: number): void {
    this.autoSyncIntervalMinutes = minutes;
    this.setSetting('auto_sync_interval', String(minutes));
  }

  /* ==========================================================================
     MODAL CONTROLS
     ========================================================================== */

  openSettingsModal(tab: SettingsTab = 'general'): void {
    this.activeTab = tab;
    this.isOpen = true;
    this.isSettingsModalOpen = true;
  }

  open(tab: SettingsTab = 'general'): void {
    this.openSettingsModal(tab);
  }

  closeSettingsModal(): void {
    this.isOpen = false;
    this.isSettingsModalOpen = false;
  }

  close(): void {
    this.closeSettingsModal();
  }

  /* ==========================================================================
     GOOGLE OAUTH AUTHENTICATION & ACCOUNT MANAGEMENT
     ========================================================================== */

  async syncGoogleAccount(): Promise<void> {
    await eventStore.syncGoogleEvents();
  }

  async startGoogleAuth(customClientId?: string, customClientSecret?: string): Promise<boolean> {
    const clientId = (customClientId || this.googleClientId || ENV_CLIENT_ID).trim();
    const clientSecret = (customClientSecret || this.googleClientSecret || ENV_CLIENT_SECRET).trim();

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials are missing. Please add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_SECRET to your .env file.');
    }

    this.setGoogleCredentials(clientId, clientSecret);
    this.isGoogleAuthInProgress = true;

    try {
      const authResult = await invoke<GoogleAuthResultPayload>('start_google_auth', {
        clientId,
        clientSecret
      });

      if (!authResult || !authResult.profile || !authResult.access_token) {
        throw new Error('Google authorization returned an incomplete response.');
      }

      const isFirstAccount = this.accounts.length === 0;
      const accountId = 'acc_' + authResult.profile.id.replace(/[^a-zA-Z0-9_]/g, '_');

      const newAccount: UserAccount = {
        id: accountId,
        email: authResult.profile.email,
        name: authResult.profile.name || authResult.profile.email.split('@')[0],
        provider: 'google',
        avatarUrl: authResult.profile.picture,
        isPrimary: isFirstAccount,
        syncEnabled: true
      };

      await persistDbAccount(newAccount, authResult.access_token, authResult.refresh_token);

      const existingIdx = this.accounts.findIndex(a => a.id === accountId || a.email === newAccount.email);
      if (existingIdx >= 0) {
        this.accounts[existingIdx] = newAccount;
      } else {
        this.accounts = [...this.accounts, newAccount];
      }

      // Mark logged in and update state immediately
      this.isLoggedIn = true;
      await this.setSetting('isLoggedIn', 'true');

      // Trigger sync
      eventStore.syncGoogleEvents().catch(err => {
        console.warn('Initial Google sync following authentication failed:', err);
      });

      return true;
    } catch (err: any) {
      console.error('Google OAuth Authentication failed:', err);
      throw err;
    } finally {
      this.isGoogleAuthInProgress = false;
    }
  }

  async removeAccount(accountId: string): Promise<void> {
    try {
      await deleteDbAccount(accountId);
      this.accounts = this.accounts.filter(a => a.id !== accountId);

      if (this.accounts.length === 0) {
        this.isLoggedIn = false;
        await this.setSetting('isLoggedIn', 'false');
      }

      calendarState.calendars = await loadInitialCalendars();
      await eventStore.init();
    } catch (err) {
      console.error(`Failed to delete account ${accountId}:`, err);
    }
  }

  async toggleAccountSync(accountId: string, syncEnabled: boolean): Promise<void> {
    const target = this.accounts.find(a => a.id === accountId);
    if (!target) return;

    const updated: UserAccount = { ...target, syncEnabled };
    try {
      await persistDbAccount(updated);
      this.accounts = this.accounts.map(a => a.id === accountId ? updated : a);

      if (syncEnabled) {
        eventStore.syncGoogleEvents().catch(console.warn);
      }
    } catch (err) {
      console.error(`Failed updating sync status for account ${accountId}:`, err);
    }
  }

  async setPrimaryAccount(accountId: string): Promise<void> {
    try {
      for (const acc of this.accounts) {
        const isPrimary = acc.id === accountId;
        const updated = { ...acc, isPrimary };
        await persistDbAccount(updated);
      }
      this.accounts = this.accounts.map(a => ({
        ...a,
        isPrimary: a.id === accountId
      }));
    } catch (err) {
      console.error(`Failed setting primary account to ${accountId}:`, err);
    }
  }

  async deleteAccountAndData(): Promise<void> {
    await this.clearAllData();
  }

  async clearAllData(): Promise<void> {
    try {
      await clearAllDbAccounts();
      this.accounts = [];
      this.isLoggedIn = false;
      await this.setSetting('isLoggedIn', 'false');
      calendarState.calendars = [];
      eventStore.events = [];
    } catch (err) {
      console.error('Failed clearing application data:', err);
    }
  }
}

export const settingsStore = new SettingsStore();