<script lang="ts">
  import { 
    X, 
    Settings, 
    User, 
    Bell, 
    Menu, 
    Video, 
    Plus, 
    ExternalLink, 
    Check, 
    Trash2, 
    Globe, 
    Link,
    ChevronDown
  } from 'lucide-svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';

  let newGoogleEmailInput = $state('');
  let isAddingAccountFormOpen = $state(false);
</script>

{#if settingsStore.isOpen}
  <!-- Backdrop -->
  <div 
    class="fixed inset-0 z-[150] bg-black/70 backdrop-blur-[2px] flex items-center justify-center select-none"
    onclick={() => settingsStore.close()}
    role="presentation"
  >
    <!-- Modal Window -->
    <div 
      class="w-[780px] h-[520px] bg-[#1a1a1a] border border-[#2b2b2b] rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.95)] flex overflow-hidden text-zinc-200 animate-in fade-in zoom-in-95 duration-150"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
    >
      <!-- Left Sidebar Navigation -->
      <aside class="w-56 bg-[#161616] border-r border-[#242424] p-3 flex flex-col justify-between shrink-0">
        <div class="flex flex-col gap-4">
          <!-- Account Nav Items -->
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] font-semibold text-zinc-400 px-2 py-1 uppercase tracking-wider">Account</span>
            
            <button
              onclick={() => settingsStore.activeTab = 'general'}
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer
                {settingsStore.activeTab === 'general' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202020]'}"
            >
              <Settings size={14} class="shrink-0" />
              <span>General</span>
            </button>

            <button
              onclick={() => settingsStore.activeTab = 'profile'}
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer
                {settingsStore.activeTab === 'profile' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202020]'}"
            >
              <User size={14} class="shrink-0" />
              <span>Profile</span>
            </button>

            <button
              onclick={() => settingsStore.activeTab = 'notifications'}
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer
                {settingsStore.activeTab === 'notifications' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202020]'}"
            >
              <Bell size={14} class="shrink-0" />
              <span>Notifications</span>
            </button>

            <button
              onclick={() => settingsStore.activeTab = 'menubar'}
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer
                {settingsStore.activeTab === 'menubar' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202020]'}"
            >
              <Menu size={14} class="shrink-0" />
              <span>Menu bar</span>
            </button>

            <button
              onclick={() => settingsStore.activeTab = 'conferencing'}
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer
                {settingsStore.activeTab === 'conferencing' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202020]'}"
            >
              <Video size={14} class="shrink-0" />
              <span>Conferencing</span>
            </button>
          </div>

          <!-- Calendar Accounts Section -->
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] font-semibold text-zinc-400 px-2 py-1 uppercase tracking-wider">Calendar accounts</span>
            {#each settingsStore.accounts as acc}
              <button 
                onclick={() => settingsStore.activeTab = 'accounts'}
                class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors truncate text-left cursor-pointer
                  {settingsStore.activeTab === 'accounts' ? 'bg-[#262626] text-white font-semibold' : 'text-zinc-300 hover:bg-[#202020]'}"
              >
                <div class="w-3.5 h-3.5 rounded-full bg-[#ea4335] text-white font-bold flex items-center justify-center text-[8px] shrink-0">
                  G
                </div>
                <span class="truncate">{acc.email}</span>
              </button>
            {/each}

            <button 
              onclick={() => { settingsStore.activeTab = 'accounts'; isAddingAccountFormOpen = true; }}
              class="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mt-1 cursor-pointer"
            >
              <Plus size={13} />
              <span>Add calendar account</span>
            </button>
          </div>

          <!-- Notion Workspaces Section -->
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] font-semibold text-zinc-400 px-2 py-1 uppercase tracking-wider">Notion workspaces</span>
            <button 
              onclick={() => settingsStore.activeTab = 'profile'}
              class="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Notion workspace</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- Right Tab Content Container -->
      <main class="flex-1 flex flex-col h-full bg-[#1a1a1a] relative">
        <!-- Close 'X' Button -->
        <button 
          onclick={() => settingsStore.close()}
          class="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#262626] transition-colors cursor-pointer z-10"
        >
          <X size={16} />
        </button>

        <div class="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6 custom-scrollbar text-xs">
          <!-- 1. GENERAL SETTINGS TAB (image_143f87.png & image_143f6b.png) -->
          {#if settingsStore.activeTab === 'general'}
            <div class="flex flex-col gap-5">
              <h2 class="text-sm font-bold text-zinc-100">Calendar view</h2>
              
              <div class="flex flex-col gap-3">
                <label class="flex items-center justify-between cursor-pointer">
                  <span class="text-zinc-300">Weekends</span>
                  <input type="checkbox" bind:checked={settingsStore.showWeekends} class="toggle-checkbox" />
                </label>

                <label class="flex items-center justify-between cursor-pointer">
                  <span class="text-zinc-300">Declined events</span>
                  <input type="checkbox" bind:checked={settingsStore.showDeclinedEvents} class="toggle-checkbox" />
                </label>

                <label class="flex items-center justify-between cursor-pointer">
                  <span class="text-zinc-300">Week numbers</span>
                  <input type="checkbox" bind:checked={settingsStore.showWeekNumbers} class="toggle-checkbox" />
                </label>
              </div>

              <div class="flex flex-col gap-1.5">
                <span class="text-zinc-400">Start week on:</span>
                <select 
                  bind:value={settingsStore.startWeekOn}
                  class="w-48 bg-[#202020] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                >
                  <option value="Sunday">Sunday</option>
                  <option value="Monday">Monday</option>
                </select>
              </div>

              <div class="h-[1px] bg-[#262626]"></div>

              <h2 class="text-sm font-bold text-zinc-100">Calendar navigation</h2>
              <div class="flex flex-col gap-1.5">
                <span class="text-zinc-400">Press <kbd class="px-1 py-0.5 rounded bg-[#292929] text-zinc-300 font-mono text-[10px]">T</kbd> to:</span>
                <select 
                  bind:value={settingsStore.pressTAction}
                  class="w-48 bg-[#202020] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                >
                  <option value="today">Go to today</option>
                  <option value="selected">Go to selected</option>
                </select>
                <span class="text-[11px] text-zinc-500">Press <kbd class="px-1 py-0.5 rounded bg-[#292929] text-zinc-300 font-mono text-[10px]">Alt</kbd> <kbd class="px-1 py-0.5 rounded bg-[#292929] text-zinc-300 font-mono text-[10px]">T</kbd> to left-align today (week) or top-align today (month).</span>
              </div>

              <div class="h-[1px] bg-[#262626]"></div>

              <h2 class="text-sm font-bold text-zinc-100">Time format & Language</h2>
              <div class="flex items-center gap-4">
                <div class="flex flex-col gap-1.5">
                  <span class="text-zinc-400">Language:</span>
                  <select 
                    bind:value={settingsStore.language}
                    class="w-40 bg-[#202020] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
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
                    class="w-48 bg-[#202020] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value="12h">12-hour time (5:16 PM)</option>
                    <option value="24h">24-hour time (17:16)</option>
                  </select>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-sm font-bold text-zinc-100">Theme</span>
                <div class="flex items-center gap-6">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="auto" bind:group={settingsStore.theme} class="accent-blue-500" />
                    <span>Auto</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="light" bind:group={settingsStore.theme} class="accent-blue-500" />
                    <span>Light mode</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value="dark" bind:group={settingsStore.theme} class="accent-blue-500" />
                    <span>Dark mode</span>
                  </label>
                </div>
              </div>
            </div>
          {/if}

          <!-- 2. PROFILE TAB (image_143f4a.png) -->
          {#if settingsStore.activeTab === 'profile'}
            <div class="flex flex-col gap-5">
              <h2 class="text-sm font-bold text-zinc-100">Notion profile</h2>
              
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-full bg-zinc-700 overflow-hidden border border-zinc-600 flex items-center justify-center font-bold text-base text-zinc-300">
                  AV
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-xs text-zinc-400 font-medium">Preferred name</span>
                  <input 
                    type="text" 
                    bind:value={settingsStore.preferredName}
                    class="bg-[#202020] border border-[#2e2e2e] rounded-lg px-2.5 py-1 text-xs text-zinc-100 focus:outline-none w-48"
                  />
                </div>
              </div>

              <div class="h-[1px] bg-[#262626]"></div>

              <h2 class="text-sm font-bold text-zinc-100">Username</h2>
              <p class="text-[11px] text-zinc-400">
                Your username is part of your scheduling links. Remember to update your shared links after changing your username, as old links will no longer work.
              </p>

              <input 
                type="text" 
                bind:value={settingsStore.username}
                class="w-64 bg-[#202020] border border-[#2e2e2e] rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
              />

              <div class="h-[1px] bg-[#262626]"></div>

              <div class="flex flex-col gap-2">
                <span class="text-xs text-zinc-400">Permanently delete your Notion Calendar account and associated user data.</span>
                <button class="w-fit px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-400 text-xs font-semibold hover:bg-rose-900/50 transition-colors cursor-pointer">
                  Delete Notion Calendar account
                </button>
              </div>
            </div>
          {/if}

          <!-- 3. MENU BAR TAB (image_143c7c.png) -->
          {#if settingsStore.activeTab === 'menubar'}
            <div class="flex flex-col gap-5">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-bold text-zinc-100">Menu bar calendar</h2>
                  <p class="text-[11px] text-zinc-400 mt-0.5">Shows upcoming events in the bottom right of your screen.</p>
                </div>
                <input type="checkbox" bind:checked={settingsStore.menuBarEnabled} class="toggle-checkbox" />
              </div>

              <div class="flex flex-col gap-1.5">
                <span class="text-zinc-400">Include events:</span>
                <select 
                  bind:value={settingsStore.menuBarDaysSpan}
                  class="w-36 bg-[#202020] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
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
                  <span>All-day events</span>
                </label>

                <label class="flex items-center gap-2 cursor-pointer text-zinc-300">
                  <input type="checkbox" bind:checked={settingsStore.menuBarIncludeNoParticipants} class="accent-blue-500" />
                  <span>Events without participants</span>
                </label>

                <label class="flex items-center gap-2 cursor-pointer text-zinc-300">
                  <input type="checkbox" bind:checked={settingsStore.menuBarIncludeNoConferencing} class="accent-blue-500" />
                  <span>Events without conferencing / location</span>
                </label>
              </div>

              <div class="h-[1px] bg-[#262626]"></div>

              <h2 class="text-sm font-bold text-zinc-100">System-wide keyboard shortcuts</h2>
              <div class="flex items-center justify-between p-2.5 bg-[#202020] border border-[#2b2b2b] rounded-xl">
                <span class="text-zinc-300">Show / hide menu bar calendar:</span>
                <div class="flex items-center gap-1 font-mono text-[11px] bg-[#161616] border border-[#2e2e2e] px-2 py-1 rounded">
                  <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd>
                </div>
              </div>
            </div>
          {/if}

          <!-- 4. CONFERENCING TAB (image_143c5e.png) -->
          {#if settingsStore.activeTab === 'conferencing'}
            <div class="flex flex-col gap-5">
              <div>
                <h2 class="text-sm font-bold text-zinc-100">Default conferencing</h2>
                <p class="text-[11px] text-zinc-400 mt-0.5">Set your primary conferencing option for new calendar meetings.</p>
              </div>

              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between p-3 rounded-xl bg-[#202020] border border-[#2c2c2c]">
                  <div class="flex items-center gap-2.5">
                    <div class="w-4 h-4 bg-blue-600 rounded flex items-center justify-center text-white text-[9px] font-bold">M</div>
                    <span class="font-semibold text-zinc-200">Google Meet</span>
                  </div>
                  <span class="text-blue-400 font-semibold text-[11px] flex items-center gap-1">
                    <Check size={12} /> Connected by default
                  </span>
                </div>

                <div class="flex items-center justify-between p-3 rounded-xl bg-[#202020] border border-[#2c2c2c]">
                  <div class="flex items-center gap-2.5">
                    <div class="w-4 h-4 bg-blue-500 rounded flex items-center justify-center text-white text-[9px] font-bold">Z</div>
                    <span class="font-semibold text-zinc-200">Zoom</span>
                  </div>
                  <button 
                    onclick={() => settingsStore.zoomConnected = !settingsStore.zoomConnected}
                    class="px-3 py-1 bg-[#2a2a2a] hover:bg-[#333333] rounded-lg text-zinc-200 font-medium transition-colors cursor-pointer"
                  >
                    {settingsStore.zoomConnected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          {/if}

          <!-- 5. CALENDAR ACCOUNTS TAB -->
          {#if settingsStore.activeTab === 'accounts'}
            <div class="flex flex-col gap-5">
              <h2 class="text-sm font-bold text-zinc-100">Connected Google Accounts</h2>

              <div class="flex flex-col gap-2">
                {#each settingsStore.accounts as acc}
                  <div class="flex items-center justify-between p-3 rounded-xl bg-[#202020] border border-[#2c2c2c]">
                    <div class="flex items-center gap-3">
                      <div class="w-5 h-5 rounded-full bg-[#ea4335] text-white font-bold flex items-center justify-center text-[10px]">
                        G
                      </div>
                      <div class="flex flex-col">
                        <span class="font-semibold text-zinc-200">{acc.name}</span>
                        <span class="text-[11px] text-zinc-400">{acc.email}</span>
                      </div>
                    </div>

                    {#if !acc.isPrimary}
                      <button 
                        onclick={() => settingsStore.removeAccount(acc.id)}
                        class="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove Account"
                      >
                        <Trash2 size={14} />
                      </button>
                    {:else}
                      <span class="text-[11px] text-blue-400 font-semibold px-2 py-0.5 rounded bg-blue-950/40 border border-blue-900/40">Primary</span>
                    {/if}
                  </div>
                {/each}
              </div>

              {#if isAddingAccountFormOpen}
                <div class="flex flex-col gap-2 p-3 rounded-xl bg-[#171717] border border-[#2e2e2e]">
                  <span class="text-xs font-semibold text-zinc-300">Connect new Google Account</span>
                  <input 
                    type="email"
                    placeholder="Enter email (e.g. user@gmail.com)"
                    bind:value={newGoogleEmailInput}
                    class="bg-[#202020] border border-[#2f2f2f] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
                  />
                  <div class="flex items-center justify-end gap-2 mt-1">
                    <button 
                      onclick={() => isAddingAccountFormOpen = false}
                      class="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button 
                      onclick={() => {
                        if (newGoogleEmailInput.trim()) {
                          settingsStore.addGoogleAccount(newGoogleEmailInput.trim());
                          newGoogleEmailInput = '';
                          isAddingAccountFormOpen = false;
                        }
                      }}
                      class="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow cursor-pointer"
                    >
                      Connect Account
                    </button>
                  </div>
                </div>
              {/if}
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