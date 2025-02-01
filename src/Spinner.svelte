<!-- Spinner.svelte -->
<script>
    export let ringColor = "#cccccc"; // equivalent to bg-gray-300
    export let spinnerHeadColor = "#000000"; // equivalent to bg-black
    export let spinnerTailColor = "#606060"; // equivalent to bg-gray-600
  
    // Generate a random animation delay between 0s and 2s
    let animationDelay = `${Math.random() * 0.2}s`;
  </script>
  
  <svg
    aria-hidden="true"
    class="inline w-6 h-6 animate-spin"
    style={`--tw-gradient-from: ${spinnerTailColor}; --tw-gradient-to: ${spinnerHeadColor}; animation-delay: ${animationDelay};`}
    clip-rule="evenodd"
    fill-rule="evenodd"
    stroke-linejoin="round"
    stroke-miterlimit="2"
    viewBox="0 0 119 119"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
  >
    <defs>
      <linearGradient
        id="a"
        gradientTransform="matrix(-227.325 -227.326 -227.326 227.325 277.325 236.998)"
        gradientUnits="userSpaceOnUse"
        x1="0"
        x2="1"
        y1="0"
        y2="0"
      >
        <stop offset="0" style="stop-color: var(--tw-gradient-from);" />
        <stop offset="1" style="stop-color: var(--tw-gradient-to);" />
      </linearGradient>
    </defs>
    <path
      d="m1394.27 1733.6c-17.37.02-33.83 10.32-40.89 27.36-9.36 22.6 1.37 48.51 23.97 57.87s48.51-1.37 57.87-23.97c1.56-3.77 5.88-5.56 9.65-4 3.76 1.56 5.55 5.88 3.99 9.65v.01c-8.88 21.38-29.96 36.44-54.56 36.44-32.62 0-59.05-26.44-59.05-59.05s26.42-59.04 59.02-59.06z"
      fill={ringColor}
      transform="translate(-1335.24 -1718.85)"
    />
    <path
      d="m50 9.672c125.548 0 227.325 101.777 227.325 227.326 0 15.694-12.722 28.416-28.415 28.416-15.694 0-28.416-12.722-28.416-28.416 0-80.351-76.333-145.489-170.494-145.489-22.599 0-40.919-18.32-40.919-40.918 0-22.599 18.32-40.919 40.919-40.919z"
      fill="url(#a)"
      transform="matrix(0 -.259782 -.259782 0 120.63 72.05)"
    />
  </svg>
  