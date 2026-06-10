<script>
  import Spinner from "./Spinner.svelte";
  import { settingsStore } from "./settingsStore.js";

  export let title = "";
  export let content = "";

  $: systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  $: isDarkMode = $settingsStore.theme === 'dark' || ($settingsStore.theme === 'system' && systemDark);
  $: spinnerProps = isDarkMode
    ? {
        ringColor: "#374151",
        spinnerHeadColor: "#3b82f6",
        spinnerTailColor: "#1e3a8a",
      } // Gray-700, Blue-500, Blue-900
    : {
        ringColor: "#e5e7eb",
        spinnerHeadColor: "#3b82f6",
        spinnerTailColor: "#93c5fd",
      }; // Gray-200, Blue-500, Blue-300
</script>

<h2
  class="text-xl font-semibold font-inter mt-2 mb-2 text-gray-800 dark:text-gray-200"
>
  {title}
</h2>
<div
  class="loading-container w-full bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center justify-center shadow-sm border border-gray-100 dark:border-gray-700"
>
  <div class="flex items-center space-x-3 text-gray-800 dark:text-gray-200">
    <Spinner
      ringColor={spinnerProps.ringColor}
      spinnerHeadColor={spinnerProps.spinnerHeadColor}
      spinnerTailColor={spinnerProps.spinnerTailColor}
    />
    <span class="font-medium">{content}</span>
  </div>
</div>
