<script lang="ts">
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { X } from 'lucide-svelte';

  let isConnecting = $state(false);

  async function handleConnectGoogle() {
    isConnecting = true;
    try {
      // In desktop runtime, trigger the Tauri OAuth PKCE handler
      // Simulating connected Google account syncing
      setTimeout(() => {
        const googleCal = {
          id: 'cal_google_' + Date.now(),
          accountId: 'acc_google',
          googleCalendarId: 'primary',
          name: 'amilavaz2003@gmail.com',
          colorId: 'blue',
          colorHex: '#3b82f6',
          isPrimary: true,
          isVisible: true
        };

        calendarState.calendars = [...calendarState.calendars, googleCal];
        isConnecting = false;
        calendarState.closeAddAccountModal();
      }, 750);
    } catch (e) {
      console.error(e);
      isConnecting = false;
    }
  }
</script>

{#if calendarState.isAddAccountModalOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center select-none"
    onclick={() => calendarState.closeAddAccountModal()}
    role="presentation"
  >
    <!-- Modal Card -->
    <div
      class="w-[420px] bg-[#1a1a1a] border border-[#2c2c2c] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8)] p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="0"
    >
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-base font-bold text-zinc-100">Add Calendar account</h2>
          <p class="text-xs text-zinc-400 mt-1">Manage your personal and work calendars all in one place</p>
        </div>
        <button
          onclick={() => calendarState.closeAddAccountModal()}
          class="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#252525] rounded-md transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <!-- Account Providers List -->
      <div class="flex flex-col gap-2.5">
        <!-- Google Calendar Button -->
        <button
          onclick={handleConnectGoogle}
          disabled={isConnecting}
          class="flex items-center gap-3 w-full p-3 rounded-xl bg-[#222222] hover:bg-[#292929] border border-[#2d2d2d] transition-all text-xs font-semibold text-zinc-100 group"
        >
          <!-- Google G Icon -->
          <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span class="flex-1 text-left">{isConnecting ? 'Connecting to Google...' : 'Connect Google Calendar'}</span>
        </button>

        <!-- iCloud Calendar Button -->
        <button
          class="flex items-center gap-3 w-full p-3 rounded-xl bg-[#222222] hover:bg-[#292929] border border-[#2d2d2d] transition-all text-xs font-semibold text-zinc-100 group"
        >
          <svg class="w-5 h-5 fill-current text-zinc-300 shrink-0" viewBox="0 0 24 24">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 1.01-2.87-.96.04-2.08.64-2.73 1.4-.57.65-1.07 1.71-.98 2.76 1.05.08 2.09-.54 2.7-1.29z"/>
          </svg>
          <span class="flex-1 text-left">Connect iCloud Calendar</span>
        </button>

        <!-- Outlook Calendar Button -->
        <button
          class="flex items-center gap-3 w-full p-3 rounded-xl bg-[#222222] hover:bg-[#292929] border border-[#2d2d2d] transition-all text-xs font-semibold text-zinc-100 group"
        >
          <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#0078D4" d="M22 6.5v11a1.5 1.5 0 0 1-1.5 1.5H8.5A1.5 1.5 0 0 1 7 17.5v-11A1.5 1.5 0 0 1 8.5 5h12A1.5 1.5 0 0 1 22 6.5z"/>
            <path fill="#28A8EA" d="M14.5 5h6a1.5 1.5 0 0 1 1.5 1.5v5.5h-7.5V5z"/>
            <path fill="#005A9E" d="M7 6.5A1.5 1.5 0 0 1 8.5 5H14v6.5H7v-5z"/>
            <path fill="#0364B8" d="M7 11.5h7.5V19h-6A1.5 1.5 0 0 1 7 17.5v-6z"/>
            <path fill="#14447D" d="M14.5 11.5H22v6a1.5 1.5 0 0 1-1.5 1.5h-6v-7.5z"/>
            <rect x="2" y="7" width="10" height="10" rx="1.5" fill="#0078D4"/>
            <circle cx="7" cy="12" r="2.5" fill="#FFFFFF"/>
          </svg>
          <span class="flex-1 text-left">Connect Outlook Calendar</span>
        </button>
      </div>
    </div>
  </div>
{/if}