/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,svelte,ts}', // Include Svelte, JS, and TS files in src/
    './public/index.html',           // Include your HTML entry file
  ],
  safelist: [
    'max-w-[12ch]',
    'min-w-[3ch]', 'min-w-[6ch]', 'min-w-[7ch]',
    'bg-rarity-L1',
    'bg-rarity-L',
    'bg-rarity-E1',
    'bg-rarity-E',
    'bg-rarity-UR',
    'bg-rarity-R',
    'bg-rarity-U',
    'bg-rarity-C',
    'dark:bg-rarityDark-L1',
    'dark:bg-rarityDark-L',
    'dark:bg-rarityDark-E1',
    'dark:bg-rarityDark-E',
    'dark:bg-rarityDark-UR',
    'dark:bg-rarityDark-R',
    'dark:bg-rarityDark-U',
    'dark:bg-rarityDark-C',
    'text-center',
    'text-right',
    'font-inter',
    'font-sans',
    'font-unsmurf',
    'animate-spin',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Tight"', '"UnsmurfIcons"', 'sans-serif'], // Default for all text
        inter: ['"Inter"', '"UnsmurfIcons"', 'sans-serif'],      // For large text
        head: ['"Fredoka"', '"UnsmurfIcons"', 'sans-serif'],      // For headings
      },
      colors: {
        rarity: {
          L: '#FEF08A',
          E1: '#FECACA',
          E: '#FED7AA',
          UR: '#E9D5FF',
          R: '#BFDBFE',
          U: '#A7F3D0',
          C: '#E5E7EB',
        },
        // Dark mode specific rarity colors (slightly simplified or desaturated if needed, 
        // but keeping same keys for logic compatibility)
        rarityDark: {
          L: '#615f0a',
          E1: '#550e0e',
          E: '#57210f',
          UR: '#452061',
          R: '#10255f',
          U: '#0a4939',
          C: '#303641',
        },
        hyphens: {
          none: 'none',
          manual: 'manual',
          auto: 'auto',
        },
        button: {
          DEFAULT: '#007BFF',
          hover: '#0056b3',
          active: '#004085',
          disabled: '#cccccc',
          disabledText: '#666666',
        },
      },
      backgroundImage: {
        'rarity-L1': 'linear-gradient(135deg, #FECACA 0%, #FED7AA 14%, #FEF08A 28%, #A7F3D0 42%, #BFDBFE 56%, #DDD6FE 70%, #FBCFE8 84%)',
        'rarityDark-L1': 'linear-gradient(135deg, #550e0e 0%, #57210f 14%, #615f0a 28%, #0a4939 42%, #10255f 56%, #452061 70%, #5e0e19ff 84%)',
      },
      boxShadow: {
        button: '0px 2px 5px rgba(0, 0, 0, 0.1)',
        buttonHover: '0px 4px 10px rgba(0, 0, 0, 0.2)',
        buttonActive: '0px 1px 3px rgba(0, 0, 0, 0.2)',
      },
      spacing: {
        25: '6.25rem', // For button height/width
      },
      borderRadius: {
        lg: '15px', // Match rounded button corners
      },
      fontSize: {
        '11pt': '11pt', // Custom font size
        sm: ['0.8rem', { lineHeight: '1rem' }], // For entry count
      },
    },
  },
  plugins: [
    function ({ addComponents }) {
      addComponents({
        '.font-inter': {
          fontFeatureSettings: '"liga" 1, "dlig" 1, "ss03" 1, "cv01" 1, "cv05" 1',
        },
        '.font-sans': {
          fontFeatureSettings: '"liga" 1, "dlig" 1, "ss03" 1, "cv01" 1, "cv05" 1',
        },
        // Doesn't work yet
      });
    },
  ],
};
