import type { SettingsTab, UserAccount } from '../../types/event';
import { calendarState } from './calendarState.svelte';

class SettingsStore {
  isOpen = $state(false);
  activeTab = $state<SettingsTab>('general');
  isLoginModalOpen = $state(false);

  // General Settings
  showWeekends = $state(true);
  showDeclinedEvents = $state(true);
  showWeekNumbers = $state(false);
  startWeekOn = $state<'Sunday' | 'Monday'>('Sunday');
  pressTAction = $state<'today' | 'selected'>('today');
  upcomingMeetingContext = $state<'15m' | '30m' | '1h' | '2h' | '4h'>('4h');
  language = $state('English');
  timeFormat = $state<'12h' | '24h'>('12h');
  askChangeTimeZone = $state(true);
  theme = $state<'auto' | 'light' | 'dark'>('dark');
  startMenuBarCalendar = $state(true);
  openCalendarWindow = $state(false);

  // Profile Settings
  preferredName = $state('amila vaz');
  email = $state('amilavaz2003@gmail.com');
  username = $state('amilavaz');
  userAvatar = $state('');
  isLoggedIn = $state(true);

  // Notifications Settings
  notificationsEnabled = $state(true);
  playNotificationSound = $state(true);
  defaultReminderOffset = $state('15m');

  // Menu bar Settings
  menuBarEnabled = $state(true);
  menuBarDaysSpan = $state<'1 day' | '2 days' | '3 days' | '7 days'>('3 days');
  menuBarIncludeAllDay = $state(false);
  menuBarIncludeNoParticipants = $state(true);
  menuBarIncludeNoConferencing = $state(true);

  // Conferencing Settings
  defaultConferencing = $state<'google_meet' | 'zoom' | 'custom'>('google_meet');
  zoomConnected = $state(false);
  customVideoUrl = $state('');

  // Connected Accounts List
  accounts = $state<UserAccount[]>([
    {
      id: 'acc_primary',
      email: 'amilavaz2003@gmail.com',
      name: 'amila vaz',
      provider: 'google',
      isPrimary: true,
      syncEnabled: true
    }
  ]);

  open(tab: SettingsTab = 'general') {
    this.activeTab = tab;
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }

  openLoginModal() {
    this.isLoginModalOpen = true;
  }

  closeLoginModal() {
    this.isLoginModalOpen = false;
  }

  addAccount(email: string, name: string = 'Google User') {
    if (!email.trim()) return;
    const exists = this.accounts.some(a => a.email.toLowerCase() === email.toLowerCase());
    if (!exists) {
      const newAcc: UserAccount = {
        id: 'acc_' + Date.now(),
        email: email.trim(),
        name: name.trim() || email.split('@')[0],
        provider: 'google',
        isPrimary: this.accounts.length === 0,
        syncEnabled: true
      };
      this.accounts.push(newAcc);

      // Add a calendar category for the new account
      calendarState.calendars.push({
        id: 'cal_' + Date.now(),
        accountId: newAcc.id,
        name: newAcc.email,
        colorId: 'blue',
        colorHex: '#3b82f6',
        isPrimary: newAcc.isPrimary,
        isVisible: true
      });
    }
    this.closeLoginModal();
  }

  removeAccount(id: string) {
    const acc = this.accounts.find(a => a.id === id);
    if (!acc || acc.isPrimary) return;
    this.accounts = this.accounts.filter(a => a.id !== id);
    calendarState.calendars = calendarState.calendars.filter(c => c.accountId !== id);
  }

  setPrimaryAccount(id: string) {
    this.accounts = this.accounts.map(a => ({
      ...a,
      isPrimary: a.id === id
    }));
    const primary = this.accounts.find(a => a.id === id);
    if (primary) {
      this.preferredName = primary.name;
      this.email = primary.email;
    }
  }

  logout() {
    this.isLoggedIn = false;
    this.preferredName = 'Guest';
    this.email = '';
  }

  login(email: string, name: string) {
    this.preferredName = name || email.split('@')[0];
    this.email = email;
    this.isLoggedIn = true;
    this.addAccount(email, name);
  }
}

export const settingsStore = new SettingsStore();