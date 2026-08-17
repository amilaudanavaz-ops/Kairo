import type { SettingsTab, UserAccount } from '../../types/event';

class SettingsStore {
  isOpen = $state(false);
  activeTab = $state<SettingsTab>('general');

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
  username = $state('amilavaz');
  userAvatar = $state('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces');

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

  // Connected Accounts
  accounts = $state<UserAccount[]>([
    {
      id: 'acc_primary',
      email: 'amilavaz2003@gmail.com',
      name: 'Amila Vaz',
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

  addGoogleAccount(email: string, name: string = 'Google User') {
    if (this.accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) return;
    this.accounts.push({
      id: 'acc_' + Date.now(),
      email,
      name,
      provider: 'google',
      isPrimary: false,
      syncEnabled: true
    });
  }

  removeAccount(id: string) {
    this.accounts = this.accounts.filter(a => a.id !== id);
  }
}

export const settingsStore = new SettingsStore();