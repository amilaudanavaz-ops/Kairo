<!-- ========================================== -->
<!-- TRAY ROUTE (src/routes/tray/+page.svelte)  -->
<!-- ========================================== -->

<script lang="ts">
    // --- IMPORTS ---
    import { onMount } from 'svelte';
    import { getCurrentWindow } from '@tauri-apps/api/window';
    import TrayPanel from '../../lib/components/tray/TrayPanel.svelte';

    // --- WINDOW FOCUS LOGIC ---
    // This makes the window automatically hide when the user clicks away (loses focus)
    onMount(() => {
        const appWindow = getCurrentWindow();
        
        const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
            if (!focused) {
                appWindow.hide();
            }
        });

        // Cleanup listener on destroy
        return () => {
            unlisten.then((f) => f());
        };
    });
</script>

<!-- --- GLOBAL STYLES (Specific to Tray Window) --- -->
<svelte:head>
    <style>
        /* Make the body fully transparent so our panel can have rounded corners and drop shadows */
        body, html {
            background-color: transparent !important;
            margin: 0;
            padding: 0;
            overflow: hidden; /* Hide main scrollbars */
            user-select: none; /* Prevent text selection dragging */
        }
    </style>
</svelte:head>

<!-- --- COMPONENTS --- -->
<main class="tray-app-container">
    <TrayPanel />
</main>

<!-- --- LOCAL STYLES --- -->
<style>
    .tray-app-container {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        padding: 8px; /* Leave room for drop shadows */
        box-sizing: border-box;
    }
</style>