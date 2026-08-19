<script lang="ts">
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { 
    KeyRound, 
    ShieldCheck, 
    AlertCircle, 
    Loader2, 
    X 
  } from 'lucide-svelte';

  let emailInput = $state('');
  let errorMessage = $state<string | null>(null);

  async function handleGoogleLogin() {
    errorMessage = null;
    try {
      await settingsStore.startGoogleAuth();
    } catch (err: any) {
      console.error('Google OAuth failed:', err);
      errorMessage = typeof err === 'string' ? err : (err?.message || 'Authentication failed. Please check your .env configuration.');
    }
  }

  function handleContinueWithEmail(e: SubmitEvent) {
    e.preventDefault();
    if (!emailInput.trim()) {
      errorMessage = 'Please enter a valid email address.';
      return;
    }
    handleGoogleLogin();
  }
</script>

<div class="relative w-full h-screen bg-[#0d0d0d] text-zinc-100 flex flex-col items-center justify-center select-none overflow-hidden px-4">
  <!-- Subtle Gradient Background Glow -->
  <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/10 blur-[120px] pointer-events-none rounded-full"></div>

  <!-- Main Card Container -->
  <div class="relative z-10 w-full max-w-[420px] flex flex-col items-center gap-6">
    
    <!-- App Brand Icon -->
    <div class="w-16 h-16 rounded-2xl bg-gradient-to-b from-[#1e293b] to-[#0f172a] border border-blue-500/20 shadow-[0_8px_32px_rgba(37,99,235,0.15)] flex flex-col items-center justify-center p-2.5">
      <div class="w-full h-2 bg-blue-500 rounded-t-sm mb-1.5 flex items-center justify-around px-1">
        <div class="w-1 h-1 bg-white/60 rounded-full"></div>
        <div class="w-1 h-1 bg-white/60 rounded-full"></div>
      </div>
      <span class="text-lg font-black text-white tracking-tighter">31</span>
    </div>

    <!-- Header Text -->
    <div class="text-center flex flex-col gap-1.5">
      <h1 class="text-2xl font-bold tracking-tight text-white">Welcome to Kairo</h1>
      <p class="text-xs text-zinc-400">Log in to your Kairo account to sync your calendar</p>
    </div>

    {#if errorMessage}
      <div class="w-full bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-400 animate-in fade-in duration-200">
        <AlertCircle size={15} class="shrink-0 mt-0.5" />
        <span class="leading-relaxed flex-1">{errorMessage}</span>
        <button onclick={() => errorMessage = null} class="text-zinc-400 hover:text-white cursor-pointer">
          <X size={13} />
        </button>
      </div>
    {/if}

    <!-- Email Form -->
    <form onsubmit={handleContinueWithEmail} class="w-full flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <label for="email" class="text-[11px] font-medium text-zinc-400">Email</label>
        <input 
          id="email"
          type="email" 
          placeholder="Enter your email address..." 
          bind:value={emailInput}
          class="w-full bg-[#181818] border border-[#2a2a2a] focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition-all"
        />
        <span class="text-[10px] text-zinc-500">Use your Google or organization email to sync events and teammates.</span>
      </div>

      <button 
        type="submit"
        disabled={settingsStore.isGoogleAuthInProgress}
        class="w-full py-2.5 bg-[#2563eb] hover:bg-blue-500 active:scale-[0.99] text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/15 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <span>Continue</span>
      </button>
    </form>

    <!-- Divider -->
    <div class="w-full flex items-center gap-3">
      <div class="flex-1 h-[1px] bg-[#242424]"></div>
      <span class="text-[10px] text-zinc-500 tracking-wider">or continue with</span>
      <div class="flex-1 h-[1px] bg-[#242424]"></div>
    </div>

    <!-- Social Auth Providers -->
    <div class="w-full grid grid-cols-3 gap-2.5">
      <!-- 1-Click Google Auth Button -->
      <button 
        type="button"
        onclick={handleGoogleLogin}
        disabled={settingsStore.isGoogleAuthInProgress}
        class="flex flex-col items-center justify-center gap-1.5 py-3 px-2 bg-[#181818] hover:bg-[#222222] border border-[#2a2a2a] hover:border-zinc-700 rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        {#if settingsStore.isGoogleAuthInProgress}
          <Loader2 size={16} class="animate-spin text-blue-500" />
          <span class="text-[11px] font-medium text-zinc-400">Connecting...</span>
        {:else}
          <svg class="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.8l3.7-2.9z"/>
            <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"/>
          </svg>
          <span class="text-[11px] font-medium text-zinc-300 group-hover:text-white">Google</span>
        {/if}
      </button>

      <!-- Apple (Placeholder) -->
      <button 
        type="button" 
        disabled 
        class="flex flex-col items-center justify-center gap-1.5 py-3 px-2 bg-[#141414] border border-[#202020] rounded-xl opacity-40 cursor-not-allowed"
      >
        <svg class="w-4 h-4 fill-current text-zinc-400" viewBox="0 0 24 24">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.93.04-2.02.63-2.66 1.38-.56.65-1.06 1.71-.93 2.74 1.05.08 2.07-.53 2.67-1.25z"/>
        </svg>
        <span class="text-[11px] font-medium text-zinc-500">Apple</span>
      </button>

      <!-- Microsoft (Placeholder) -->
      <button 
        type="button" 
        disabled 
        class="flex flex-col items-center justify-center gap-1.5 py-3 px-2 bg-[#141414] border border-[#202020] rounded-xl opacity-40 cursor-not-allowed"
      >
        <svg class="w-4 h-4" viewBox="0 0 23 23">
          <path fill="#f35325" d="M1 1h10v10H1z"/>
          <path fill="#81bc06" d="M12 1h10v10H12z"/>
          <path fill="#05a6f0" d="M1 12h10v10H1z"/>
          <path fill="#ffba08" d="M12 12h10v10H12z"/>
        </svg>
        <span class="text-[11px] font-medium text-zinc-500">Microsoft</span>
      </button>
    </div>

    <!-- Secondary Alternatives -->
    <div class="w-full grid grid-cols-2 gap-2.5">
      <button 
        type="button" 
        disabled 
        class="py-2.5 px-3 bg-[#161616] border border-[#242424] rounded-xl flex items-center justify-center gap-2 text-zinc-500 text-[11px] opacity-40 cursor-not-allowed"
      >
        <KeyRound size={12} />
        <span>Passkey</span>
      </button>

      <button 
        type="button" 
        disabled 
        class="py-2.5 px-3 bg-[#161616] border border-[#242424] rounded-xl flex items-center justify-center gap-2 text-zinc-500 text-[11px] opacity-40 cursor-not-allowed"
      >
        <ShieldCheck size={12} />
        <span>SSO</span>
      </button>
    </div>

    <!-- Footer Agreement -->
    <p class="text-[10px] text-zinc-600 text-center leading-relaxed">
      By continuing, you acknowledge that you understand and agree to the 
      <a href="#terms" class="text-zinc-500 hover:underline">Terms & Conditions</a> and 
      <a href="#privacy" class="text-zinc-500 hover:underline">Privacy Policy</a>.
    </p>
  </div>
</div>