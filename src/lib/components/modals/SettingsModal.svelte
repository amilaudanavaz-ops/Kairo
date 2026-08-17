<script lang="ts">
  import { 
    X, 
    Settings, 
    User, 
    Bell, 
    Menu, 
    Video, 
    Plus, 
    Check, 
    Trash2, 
    RefreshCw,
    Volume2
  } from 'lucide-svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';

  let localPreferredName = $state('');
  let localUsername = $state('');
  let isSavedMessage = $state(false);
  let isSyncing = $state(false);

  $effect(() => {
    localPreferredName = settingsStore.preferredName;
    localUsername = settingsStore.username;
  });

  function triggerGoogleSync() {
    isSyncing = true;
    setTimeout(() => {
      isSyncing = false;
    }, 1000);
  }

  function handleUpdateProfile() {
    settingsStore.preferredName = localPreferredName.trim() || 'Amila Vaz';
    settingsStore.username = localUsername.trim() || 'amilavaz';
    settingsStore.updateSetting('preferredName', settingsStore.preferredName);
    settingsStore.updateSetting('username', settingsStore.username);
    isSavedMessage = true;
    setTimeout(() => {
      isSavedMessage = false;
      settingsStore.close();
    }, 600);
  }

  function playTestSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.warn('AudioContext permission required:', e);
    }
  }

  async function testDesktopNotification() {
    if (settingsStore.playNotificationSound) {
      playTestSound();
    }
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Kairo Reminder', {
          body: 'This is a test notification for upcoming calendar meetings.',
          icon: '/favicon.png'
        });
      } else if (Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          new Notification('Kairo Reminder', {
            body: 'Desktop notifications enabled successfully!',
            icon: '/favicon.png'
          });
        }
      }
    }
  }
</script>

{#if settingsStore.isOpen}
  <div 
    class="fixed inset-0 z-[150] bg-black/75 backdrop-blur-[2px] flex items-center justify-center select-none"
    onclick={() => settingsStore.close()}
    role="presentation"
  >
    <div 
      class="w-[780px] h-[530px] bg-[#191919] border border-[#2b2b2b] rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.95)] flex overflow-hidden text-zinc-200 animate-in fade-in zoom-in-95 duration-150"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
    >
      <!-- Navigation Sidebar -->
      <aside class="w-56 bg-[#141414] border-r border-[#242424] p-3.5 flex flex-col justify-between shrink-0">
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] font-semibold text-zinc-500 px-2 py-1 uppercase tracking-wider">Account</span>
            
            <button
              onclick={() => settingsStore.activeTab = 'general'}
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer
                {settingsStore.activeTab === 'general' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f1f]'}"
            >
              <Settings size={14} />
              <span>General</span>
            </button>

            <button
              onclick={() => settingsStore.activeTab = 'profile'}
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer
                {settingsStore.activeTab === 'profile' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f1f]'}"
            >
              <User size={14} />
              <span>Profile</span>
            </button>

            <button
              onclick={() => settingsStore.activeTab = 'notifications'}
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer
                {settingsStore.activeTab === 'notifications' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f1f]'}"
            >
              <Bell size={14} />
              <span>Notifications</span>
            </button>

            <button
              onclick={() => settingsStore.activeTab = 'menubar'}
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer
                {settingsStore.activeTab === 'menubar' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f1f]'}"
            >
              <Menu size={14} />
              <span>Menu bar</span>
            </button>

            <button
              onclick={() => settingsStore.activeTab = 'conferencing'}
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer
                {settingsStore.activeTab === 'conferencing' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f1f1f]'}"
            >
              <Video size={14} />
              <span>Conferencing</span>
            </button>
          </div>

          <!-- Calendar Accounts Section -->
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] font-semibold text-zinc-500 px-2 py-1 uppercase tracking-wider">Calendar Accounts</span>
            {#each settingsStore.accounts as acc}
              <button 
                onclick={() => settingsStore.activeTab = 'accounts'}
                class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors truncate text-left cursor-pointer
                  {settingsStore.activeTab === 'accounts' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-300 hover:bg-[#1f1f1f]'}"
              >
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span class="truncate">{acc.email}</span>
              </button>
            {/each}

            <button 
              onclick={() => calendarState.openAddAccountModal()}
              class="flex items-center gap-1.5 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1 cursor-pointer"
            >
              <Plus size={13} />
              <span>Add calendar account</span>
            </button>
          </div>
        </div>

        <div class="text-[10px] text-zinc-600 px-2">Kairo v1.0 • Desktop Native</div>
      </aside>

      <!-- Content Area -->
      <main class="flex-1 flex flex-col h-full bg-[#181818] relative">
        <button 
          onclick={() => settingsStore.close()}
          class="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#262626] transition-colors cursor-pointer z-10"
        >
          <X size={16} />
        </button>

        <div class="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6 custom-scrollbar text-xs">
          
          <!-- 1. PROFILE TAB -->
          {#if settingsStore.activeTab === 'profile'}
            <div class="flex flex-col gap-5">
              <h2 class="text-sm font-bold text-zinc-100">Kairo profile</h2>
              
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-lg text-white shadow-md">
                  {localPreferredName ? localPreferredName.slice(0, 1).toUpperCase() : 'A'}
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-xs text-zinc-400 font-medium">Preferred name</span>
                  <input 
                    type="text" 
                    bind:value={localPreferredName}
                    class="bg-[#222222] border border-[#2e2e2e] rounded-lg px-2.5 py-1 text-xs text-zinc-100 focus:outline-none w-56"
                  />
                </div>
              </div>

              <div class="h-px bg-[#262626]"></div>

              <div class="flex flex-col gap-1.5">
                <h2 class="text-sm font-bold text-zinc-100">Username</h2>
                <p class="text-[11px] text-zinc-400 leading-relaxed">
                  Your username is part of your scheduling links. Remember to update your shared links after changing your username, as old links will no longer work.
                </p>
                <input 
                  type="text" 
                  bind:value={localUsername}
                  class="w-64 bg-[#222222] border border-[#2e2e2e] rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none mt-1"
                />
              </div>

              <div class="h-px bg-[#262626]"></div>

              <div class="flex flex-col gap-2">
                <p class="text-[11px] text-zinc-400">
                  Permanently delete your Kairo Calendar account and associated user data. Calendar and contacts data stored with Google won’t be deleted.
                </p>
                <button
                  onclick={() => settingsStore.logout()}
                  class="w-fit px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-400 hover:bg-rose-900/50 transition-colors text-xs font-semibold cursor-pointer"
                >
                  Delete Kairo Calendar account
                </button>
              </div>

              <div class="flex items-center justify-end gap-2 mt-auto pt-6 border-t border-[#262626]">
                <button 
                  onclick={() => settingsStore.close()} 
                  class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onclick={handleUpdateProfile}
                  class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {#if isSavedMessage}
                    <Check size={13} /> Updated
                  {:else}
                    Update
                  {/if}
                </button>
              </div>
            </div>
          {/if}

          <!-- 2. GENERAL TAB -->
          {#if settingsStore.activeTab === 'general'}
            <div class="flex flex-col gap-5">
              <h2 class="text-sm font-bold text-zinc-100">Calendar View</h2>
              
              <div class="flex flex-col gap-3">
                <label class="flex items-center justify-between cursor-pointer">
                  <span class="text-zinc-300">Show weekends</span>
                  <input 
                    type="checkbox" 
                    bind:checked={settingsStore.showWeekends} 
                    onchange={() => settingsStore.updateSetting('showWeekends', String(settingsStore.showWeekends))}
                    class="toggle-checkbox" 
                  />
                </label>

                <label class="flex items-center justify-between cursor-pointer">
                  <span class="text-zinc-300">Show declined events</span>
                  <input 
                    type="checkbox" 
                    bind:checked={settingsStore.showDeclinedEvents} 
                    onchange={() => settingsStore.updateSetting('showDeclinedEvents', String(settingsStore.showDeclinedEvents))}
                    class="toggle-checkbox" 
                  />
                </label>

                <label class="flex items-center justify-between cursor-pointer">
                  <span class="text-zinc-300">Show week numbers</span>
                  <input 
                    type="checkbox" 
                    bind:checked={settingsStore.showWeekNumbers} 
                    onchange={() => settingsStore.updateSetting('showWeekNumbers', String(settingsStore.showWeekNumbers))}
                    class="toggle-checkbox" 
                  />
                </label>
              </div>

              <div class="flex flex-col gap-1.5">
                <span class="text-zinc-400">Start week on:</span>
                <select 
                  bind:value={settingsStore.startWeekOn}
                  onchange={() => settingsStore.updateSetting('startWeekOn', settingsStore.startWeekOn)}
                  class="w-48 bg-[#222222] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                >
                  <option value="Sunday">Sunday</option>
                  <option value="Monday">Monday</option>
                </select>
              </div>

              <div class="h-px bg-[#262626]"></div>

              <h2 class="text-sm font-bold text-zinc-100">Time format & Language</h2>
              <div class="flex items-center gap-4">
                <div class="flex flex-col gap-1.5">
                  <span class="text-zinc-400">Language:</span>
                  <select 
                    bind:value={settingsStore.language}
                    onchange={() => settingsStore.updateSetting('language', settingsStore.language)}
                    class="w-40 bg-[#222222] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Español</option>
                    <option value="German">Deutsch</option>
                    <option value="French">Français</option>
                  </select>
                </div>

                <div class="flex flex-col gap-1.5">
                  <span class="text-zinc-400">Time format:</span>
                  <select 
                    bind:value={settingsStore.timeFormat}
                    onchange={() => settingsStore.updateSetting('timeFormat', settingsStore.timeFormat)}
                    class="w-48 bg-[#222222] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value="12h">12-hour (5:16 PM)</option>
                    <option value="24h">24-hour (17:16)</option>
                  </select>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-sm font-bold text-zinc-100">Theme</span>
                <div class="flex items-center gap-6">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="auto" bind:group={settingsStore.theme} onchange={() => settingsStore.applyTheme('auto')} class="accent-blue-500" />
                    <span>System</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="light" bind:group={settingsStore.theme} onchange={() => settingsStore.applyTheme('light')} class="accent-blue-500" />
                    <span>Light</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="dark" bind:group={settingsStore.theme} onchange={() => settingsStore.applyTheme('dark')} class="accent-blue-500" />
                    <span>Dark</span>
                  </label>
                </div>
              </div>
            </div>
          {/if}

          <!-- 3. NOTIFICATIONS TAB -->
          {#if settingsStore.activeTab === 'notifications'}
            <div class="flex flex-col gap-5">
              <h2 class="text-sm font-bold text-zinc-100">Event Notifications</h2>

              <div class="flex flex-col gap-3">
                <label class="flex items-center justify-between cursor-pointer">
                  <div>
                    <span class="text-zinc-200 font-medium">Desktop Notifications</span>
                    <p class="text-[11px] text-zinc-500">Show system banner alerts before events</p>
                  </div>
                  <input 
                    type="checkbox" 
                    bind:checked={settingsStore.notificationsEnabled} 
                    onchange={() => settingsStore.updateSetting('notificationsEnabled', String(settingsStore.notificationsEnabled))}
                    class="toggle-checkbox" 
                  />
                </label>

                <label class="flex items-center justify-between cursor-pointer">
                  <div>
                    <span class="text-zinc-200 font-medium">Play Alert Sound</span>
                    <p class="text-[11px] text-zinc-500">Play an audio chime when a reminder triggers</p>
                  </div>
                  <input 
                    type="checkbox" 
                    bind:checked={settingsStore.playNotificationSound} 
                    onchange={() => settingsStore.updateSetting('playNotificationSound', String(settingsStore.playNotificationSound))}
                    class="toggle-checkbox" 
                  />
                </label>
              </div>

              <div class="flex items-center justify-between">
                <div class="flex flex-col gap-1">
                  <span class="text-zinc-400">Default Reminder Offset:</span>
                  <select 
                    bind:value={settingsStore.defaultReminderOffset}
                    onchange={() => settingsStore.updateSetting('defaultReminderOffset', settingsStore.defaultReminderOffset)}
                    class="w-44 bg-[#222222] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value="5m">5 minutes before</option>
                    <option value="10m">10 minutes before</option>
                    <option value="15m">15 minutes before</option>
                    <option value="30m">30 minutes before</option>
                    <option value="1h">1 hour before</option>
                  </select>
                </div>

                <button
                  onclick={testDesktopNotification}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2c2c2c] border border-[#2f2f2f] text-xs font-semibold text-zinc-200 cursor-pointer"
                >
                  <Volume2 size={13} />
                  <span>Test Sound & Notification</span>
                </button>
              </div>
            </div>
          {/if}

          <!-- 4. MENUBAR TAB -->
          {#if settingsStore.activeTab === 'menubar'}
            <div class="flex flex-col gap-5">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-bold text-zinc-100">Menu Bar Widget</h2>
                  <p class="text-[11px] text-zinc-400 mt-0.5">Displays upcoming schedule in the desktop system tray.</p>
                </div>
                <input 
                  type="checkbox" 
                  bind:checked={settingsStore.menuBarEnabled} 
                  onchange={() => settingsStore.updateSetting('menuBarEnabled', String(settingsStore.menuBarEnabled))}
                  class="toggle-checkbox" 
                />
              </div>

              <div class="flex flex-col gap-1.5">
                <span class="text-zinc-400">Include events up to:</span>
                <select 
                  bind:value={settingsStore.menuBarDaysSpan}
                  class="w-36 bg-[#222222] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                >
                  <option value="1 day">1 day</option>
                  <option value="2 days">2 days</option>
                  <option value="3 days">3 days</option>
                  <option value="7 days">7 days</option>
                </select>
              </div>

              <div class="flex flex-col gap-2.5">
                <label class="flex items-center gap-2 cursor-pointer text-zinc-300">
                  <input type="checkbox" bind:checked={settingsStore.menuBarIncludeAllDay} class="accent-blue-500" />
                  <span>Include all-day events</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-zinc-300">
                  <input type="checkbox" bind:checked={settingsStore.menuBarIncludeNoParticipants} class="accent-blue-500" />
                  <span>Include events without participants</span>
                </label>
              </div>
            </div>
          {/if}

          <!-- 5. CONFERENCING TAB -->
          {#if settingsStore.activeTab === 'conferencing'}
            <div class="flex flex-col gap-5">
              <div>
                <h2 class="text-sm font-bold text-zinc-100">Video Conferencing</h2>
                <p class="text-[11px] text-zinc-400 mt-0.5">Select your default conferencing provider and configure personal links.</p>
              </div>

              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between p-3.5 rounded-xl bg-[#222222] border border-[#2c2c2c]">
                  <div class="flex items-center gap-3">
                    <svg class="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#00832d" d="M12 7v5l4.5 2.5.8-1.2-3.8-2.3V7z"/>
                      <path fill="#0066da" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 15c-3.9 0-7-3.1-7-7s3.1-7 7-7 7 3.1 7 7-3.1 7-7 7z"/>
                    </svg>
                    <div class="flex flex-col">
                      <span class="font-semibold text-zinc-200">Google Meet</span>
                      <span class="text-[10px] text-zinc-500">Auto-generates Google Meet links via Google Calendar</span>
                    </div>
                  </div>
                  <button
                    onclick={() => {
                      settingsStore.defaultConferencing = 'google_meet';
                      settingsStore.updateSetting('defaultConferencing', 'google_meet');
                    }}
                    class="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors
                      {settingsStore.defaultConferencing === 'google_meet' ? 'bg-blue-600 text-white' : 'bg-[#2a2a2a] text-zinc-300 hover:text-white'}"
                  >
                    {settingsStore.defaultConferencing === 'google_meet' ? 'Default' : 'Set as Default'}
                  </button>
                </div>

                <div class="flex flex-col gap-2 p-3.5 rounded-xl bg-[#222222] border border-[#2c2c2c]">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <svg class="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#2D8CFF" d="M4.5 4h10c1.38 0 2.5 1.12 2.5 2.5v7c0 1.38-1.12 2.5-2.5 2.5h-10A2.5 2.5 0 0 1 2 13.5v-7C2 5.12 3.12 4 4.5 4zm14.5 3.5 4-2.5v12l-4-2.5v-7z"/>
                      </svg>
                      <div class="flex flex-col">
                        <span class="font-semibold text-zinc-200">Zoom Meetings</span>
                        <span class="text-[10px] text-zinc-500">Configure your personal Zoom meeting ID link</span>
                      </div>
                    </div>
                    <button
                      onclick={() => {
                        settingsStore.defaultConferencing = 'zoom';
                        settingsStore.updateSetting('defaultConferencing', 'zoom');
                      }}
                      class="px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors
                        {settingsStore.defaultConferencing === 'zoom' ? 'bg-blue-600 text-white' : 'bg-[#2a2a2a] text-zinc-300 hover:text-white'}"
                    >
                      {settingsStore.defaultConferencing === 'zoom' ? 'Default' : 'Set as Default'}
                    </button>
                  </div>

                  <div class="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      placeholder="Personal Meeting URL (e.g. https://zoom.us/j/123456789)"
                      bind:value={settingsStore.zoomPmiLink}
                      onblur={() => settingsStore.updateSetting('zoomPmiLink', settingsStore.zoomPmiLink)}
                      class="flex-1 bg-[#181818] border border-[#2e2e2e] rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- 6. ACCOUNTS TAB -->
          {#if settingsStore.activeTab === 'accounts'}
            <div class="flex flex-col gap-5">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-bold text-zinc-100">Connected Accounts</h2>
                  <p class="text-[11px] text-zinc-400 mt-0.5">Manage accounts and sync calendars.</p>
                </div>
                <button 
                  onclick={triggerGoogleSync}
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2c2c2c] text-xs text-zinc-200 font-medium transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} class={isSyncing ? 'animate-spin text-blue-400' : ''} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>

              <div class="flex flex-col gap-2">
                {#each settingsStore.accounts as acc}
                  <div class="flex items-center justify-between p-3.5 rounded-xl bg-[#222222] border border-[#2c2c2c]">
                    <div class="flex items-center gap-3">
                      <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <div class="flex flex-col">
                        <span class="font-semibold text-zinc-100">{acc.name}</span>
                        <span class="text-[11px] text-zinc-400">{acc.email}</span>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      {#if acc.isPrimary}
                        <span class="text-[10px] text-blue-400 font-bold px-2 py-0.5 rounded bg-blue-950/60 border border-blue-900/60">PRIMARY</span>
                      {:else}
                        <button 
                          onclick={() => settingsStore.setPrimaryAccount(acc.id)}
                          class="px-2 py-0.5 text-[11px] text-zinc-400 hover:text-white bg-[#282828] rounded transition-colors cursor-pointer"
                        >
                          Make Primary
                        </button>
                        <button 
                          onclick={() => settingsStore.removeAccount(acc.id)}
                          class="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Disconnect Account"
                        >
                          <Trash2 size={13} />
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>

              <button
                onclick={() => calendarState.openAddAccountModal()}
                class="w-fit flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 bg-[#222222] hover:bg-[#282828] border border-[#2e2e2e] rounded-lg transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>Connect Google Account</span>
              </button>
            </div>
          {/if}
        </div>
      </main>
    </div>
  </div>
{/if}

<style>
  .toggle-checkbox {
    appearance: none;
    width: 28px;
    height: 16px;
    background-color: #2b2b2b;
    border-radius: 9999px;
    position: relative;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .toggle-checkbox:checked {
    background-color: #2563eb;
  }
  .toggle-checkbox::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 9999px;
    background-color: #ffffff;
    transition: transform 0.2s;
  }
  .toggle-checkbox:checked::before {
    transform: translateX(12px);
  }
</style>