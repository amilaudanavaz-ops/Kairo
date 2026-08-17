<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { Minus, Square, X, Lock } from 'lucide-svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';

  const appWindow = getCurrentWindow();
  let emailInput = $state('');

  function handleEmailContinue(e: SubmitEvent) {
    e.preventDefault();
    if (!emailInput.trim()) return;
    settingsStore.login(emailInput.trim(), emailInput.split('@')[0]);
  }

  async function handleGoogleLogin() {
    await settingsStore.connectGoogleOAuth();
  }
</script>

<div class="h-screen w-screen bg-[#111111] text-zinc-100 flex flex-col select-none overflow-hidden font-sans">
  <div data-tauri-drag-region class="h-10 flex items-center justify-between px-3 shrink-0">
    <div class="flex items-center gap-2 pointer-events-none">
      <div class="w-4 h-4 rounded bg-blue-600 flex items-center justify-center font-bold text-white text-[9px]">K</div>
      <span class="text-xs font-semibold text-zinc-400">Kairo</span>
    </div>

    <div class="flex items-center gap-0.5">
      <button onclick={() => appWindow.minimize()} class="p-1.5 text-zinc-400 hover:text-white hover:bg-[#222222] rounded cursor-pointer">
        <Minus size={12} />
      </button>
      <button onclick={() => appWindow.toggleMaximize()} class="p-1.5 text-zinc-400 hover:text-white hover:bg-[#222222] rounded cursor-pointer">
        <Square size={10} />
      </button>
      <button onclick={() => appWindow.close()} class="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 rounded cursor-pointer">
        <X size={12} />
      </button>
    </div>
  </div>

  <div class="flex-1 flex flex-col items-center justify-center p-6 -mt-8">
    <div class="w-[420px] flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
      
      <div class="w-16 h-16 rounded-2xl bg-[#1c1c1c] border-2 border-[#333333] shadow-2xl flex flex-col items-center justify-center">
        <div class="w-full bg-blue-600 h-3.5 rounded-t-xl flex items-center justify-center gap-1.5">
          <div class="w-1 h-1 rounded-full bg-white/60"></div>
          <div class="w-1 h-1 rounded-full bg-white/60"></div>
        </div>
        <div class="flex-1 flex items-center justify-center">
          <span class="font-bold text-xl text-zinc-100 font-mono tracking-tighter">31</span>
        </div>
      </div>

      <div class="flex flex-col items-center text-center gap-1">
        <h1 class="text-xl font-bold text-zinc-100 tracking-tight">Welcome to Kairo</h1>
        <p class="text-xs text-zinc-400">Log in to your Kairo account</p>
      </div>

      <form onsubmit={handleEmailContinue} class="w-full flex flex-col gap-3">
        <div class="flex flex-col gap-1 text-left">
          <label for="email" class="text-[11px] font-semibold text-zinc-400">Email</label>
          <input
            id="email"
            type="email"
            placeholder="Enter your email address..."
            bind:value={emailInput}
            required
            class="w-full bg-[#1b1b1b] border border-[#2e2e2e] focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-colors"
          />
        </div>

        <p class="text-[10px] text-zinc-500 text-left -mt-1">
          Use your Google or organization email to sync events and teammates.
        </p>

        <button
          type="submit"
          class="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-lg transition-colors cursor-pointer mt-1"
        >
          Continue
        </button>
      </form>

      <div class="w-full flex items-center gap-3">
        <div class="flex-1 h-px bg-[#262626]"></div>
        <span class="text-[11px] text-zinc-500 font-medium">or continue with</span>
        <div class="flex-1 h-px bg-[#262626]"></div>
      </div>

      <!-- OAuth Providers Grid -->
      <div class="w-full grid grid-cols-3 gap-2.5">
        <!-- Google (Working) -->
        <button
          type="button"
          onclick={handleGoogleLogin}
          class="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-[#1b1b1b] hover:bg-[#242424] border border-[#2e2e2e] hover:border-zinc-500 transition-all cursor-pointer group"
        >
          {#if settingsStore.isAuthenticating}
            <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          {:else}
            <svg class="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
          {/if}
          <span class="text-[11px] font-semibold text-zinc-200 group-hover:text-white">Google</span>
        </button>

        <!-- Apple (Disabled) -->
        <div class="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-[#181818] border border-[#242424] opacity-40 cursor-not-allowed">
          <svg class="w-4 h-4 fill-zinc-400" viewBox="0 0 170 170">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.05-7.62-7.85-11.77-14.4-6.41-10.12-11.36-21.57-14.86-34.33-3.5-12.76-5.25-24.3-5.25-34.62 0-15.02 3.8-27.42 11.4-37.21 7.6-9.79 17.06-14.77 28.38-14.93 4.8 0 10.15 1.25 16.06 3.75 5.91 2.5 9.72 3.86 11.43 4.09 1.48-.23 5.48-1.64 12-4.24 6.52-2.6 12.06-3.79 16.62-3.56 12.52.65 22.38 5.44 29.58 14.37-10.98 6.64-16.36 15.77-16.15 27.38.22 9.03 3.65 16.67 10.3 22.92 6.65 6.25 14.46 9.77 23.42 10.57-2.61 7.73-5.71 15.54-9.3 23.42zM119.22 33.15c0-7.39 2.66-14.35 7.97-20.89 5.31-6.54 11.95-10.87 19.92-13.01.54 1.52.82 3.09.82 4.71 0 7.39-2.77 14.39-8.31 21-5.54 6.61-12.25 10.8-20.13 12.56-.15-1.4-.27-2.85-.27-4.37z"/>
          </svg>
          <span class="text-[11px] font-semibold text-zinc-500">Apple</span>
        </div>

        <!-- Microsoft (Disabled) -->
        <div class="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-[#181818] border border-[#242424] opacity-40 cursor-not-allowed">
          <svg class="w-4 h-4" viewBox="0 0 23 23">
            <path fill="#f35325" d="M1 1h10v10H1z"/>
            <path fill="#81bc06" d="M12 1h10v10H12z"/>
            <path fill="#05a6f0" d="M1 12h10v10H1z"/>
            <path fill="#ffba08" d="M12 12h10v10H12z"/>
          </svg>
          <span class="text-[11px] font-semibold text-zinc-500">Microsoft</span>
        </div>
      </div>

      <!-- Passkey / SSO (Disabled) -->
      <div class="w-full grid grid-cols-2 gap-2.5">
        <div class="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#181818] border border-[#242424] opacity-40 cursor-not-allowed">
          <Lock size={13} class="text-zinc-500" />
          <span class="text-[11px] font-semibold text-zinc-500">Passkey</span>
        </div>

        <div class="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#181818] border border-[#242424] opacity-40 cursor-not-allowed">
          <span class="text-[11px] font-semibold text-zinc-500">SSO</span>
        </div>
      </div>

      <p class="text-[10px] text-zinc-500 text-center leading-relaxed">
        By continuing, you acknowledge that you understand and agree to the 
        <span class="underline hover:text-zinc-400 cursor-pointer">Terms & Conditions</span> and 
        <span class="underline hover:text-zinc-400 cursor-pointer">Privacy Policy</span>.
      </p>

    </div>
  </div>
</div>