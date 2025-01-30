/** @type {import('tailwindcss').Config} */
export default {
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
    'text-center',
    'text-right',
  ],
  theme: {
    extend: {
      backgroundColor: ({ theme }) => ({
        ...theme('colors.rarity'), // Automatically generate bg-rarity-[key] utilities
      }),
      fontFamily: {
        sans: ['"Inter Tight"', 'sans-serif'], // Default for all text
        inter: ['"Inter"', 'sans-serif'],      // For headings
      },
      colors: {
        rarity: {
          L: '#FDE68A', // Yellow-300 (Legendary)
          E1: '#FCA5A5', // Red-300 (Epic)
          E: '#FFB86B', // Orange-300 (Epic)
          UR: '#D8B4FE', // Purple-300 (Ultra Rare)
          R: '#93C5FD', // Blue-300 (Rare)
          U: '#6EE7B7', // Green-300 (Uncommon)
          C: '#D1D5DB', // Gray-300 (Common)
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
        'rarity-L1': 'linear-gradient(120deg, #FCA5A5, #FDBA74, #FDE68A, #A7F3D0, #93C5FD, #C4B5FD, #F9A8D4)',
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
  plugins: [],
};
