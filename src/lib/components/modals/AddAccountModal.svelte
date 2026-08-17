<script lang="ts">
  import { X } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';

  let isGoogleConnecting = $state(false);

  async function handleConnectGoogle() {
    isGoogleConnecting = true;
    try {
      // In production/dev, prompts Google sign-in and attaches calendar
      await settingsStore.addAccount('amilavaz2003@gmail.com', 'Amila Vaz');
      calendarState.closeAddAccountModal();
    } finally {
      isGoogleConnecting = false;
    }
  }
</script>

{#if calendarState.isAddAccountModalOpen}
  <div
    class="fixed inset-0 z-[150] bg-black/75 backdrop-blur-[2px] flex items-center justify-center select-none"
    onclick={() => calendarState.closeAddAccountModal()}
    role="presentation"
  >
    <div
      class="w-[440px] bg-[#1a1a1a] border border-[#2b2b2b] rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.95)] p-6 flex flex-col gap-4 text-zinc-100 animate-in fade-in zoom-in-95 duration-150"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
    >
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div class="flex flex-col gap-1">
          <h3 class="text-base font-bold text-zinc-100 tracking-tight">Add Calendar account</h3>
          <p class="text-xs text-zinc-400">Manage your personal and work calendars all in one place</p>
        </div>
        <button
          onclick={() => calendarState.closeAddAccountModal()}
          class="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-[#252525] transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      <!-- Providers List -->
      <div class="flex flex-col gap-2.5 mt-1">
        <!-- 1. Google Calendar (Active & Connected) -->
        <button
          onclick={handleConnectGoogle}
          class="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] border border-[#2e2e2e] hover:border-zinc-500 transition-all text-xs font-semibold cursor-pointer group"
        >
          {#if isGoogleConnecting}
            <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          {:else}
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
          {/if}
          <span class="flex-1 text-center text-zinc-100 group-hover:text-white">Connect Google Calendar</span>
        </button>

        <!-- 2. iCloud Calendar (Grayed Out) -->
        <div
          class="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#242424] opacity-40 cursor-not-allowed text-xs font-semibold text-zinc-400 select-none"
        >
          <svg class="w-4 h-4 fill-zinc-400 shrink-0" viewBox="0 0 170 170">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.05-7.62-7.85-11.77-14.4-6.41-10.12-11.36-21.57-14.86-34.33-3.5-12.76-5.25-24.3-5.25-34.62 0-15.02 3.8-27.42 11.4-37.21 7.6-9.79 17.06-14.77 28.38-14.93 4.8 0 10.15 1.25 16.06 3.75 5.91 2.5 9.72 3.86 11.43 4.09 1.48-.23 5.48-1.64 12-4.24 6.52-2.6 12.06-3.79 16.62-3.56 12.52.65 22.38 5.44 29.58 14.37-10.98 6.64-16.36 15.77-16.15 27.38.22 9.03 3.65 16.67 10.3 22.92 6.65 6.25 14.46 9.77 23.42 10.57-2.61 7.73-5.71 15.54-9.3 23.42zM119.22 33.15c0-7.39 2.66-14.35 7.97-20.89 5.31-6.54 11.95-10.87 19.92-13.01.54 1.52.82 3.09.82 4.71 0 7.39-2.77 14.39-8.31 21-5.54 6.61-12.25 10.8-20.13 12.56-.15-1.4-.27-2.85-.27-4.37z"/>
          </svg>
          <span class="flex-1 text-center">Connect iCloud Calendar</span>
        </div>

        <!-- 3. Outlook Calendar (Grayed Out) -->
        <div
          class="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#242424] opacity-40 cursor-not-allowed text-xs font-semibold text-zinc-400 select-none"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#0078D4" d="M22 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9.5a1.5 1.5 0 0 1-1.5-1.5V6.5A1.5 1.5 0 0 1 9.5 5h11A1.5 1.5 0 0 1 22 6.5z"/>
            <path fill="#28A8EA" d="M14 8.5h5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5H14z"/>
            <path fill="#0078D4" d="M2 7.5L8 5v14l-6-2.5z"/>
            <circle fill="#FFFFFF" cx="5" cy="12" r="1.5"/>
          </svg>
          <span class="flex-1 text-center">Connect Outlook Calendar</span>
        </div>
      </div>
    </div>
  </div>
{/if}