const { platformSelect, hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  // Class-based dark mode so the user can override the system theme from
  // settings via NativeWind's colorScheme.set().
  darkMode: 'class',
  theme: {
    extend: {
      // Mirrors Colors in src/constants/theme.js. Backed by CSS variables so a
      // single class follows the system light/dark scheme on both native and web.
      colors: {
        text: 'rgb(var(--color-text) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        background: 'rgb(var(--color-background) / <alpha-value>)',
        'background-element': 'rgb(var(--color-background-element) / <alpha-value>)',
        'background-selected': 'rgb(var(--color-background-selected) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-pressed': 'rgb(var(--color-primary-pressed) / <alpha-value>)',
        stroke: 'rgb(var(--color-border) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        link: 'rgb(var(--color-primary) / <alpha-value>)',
      },
      // Mirrors Spacing in src/constants/theme.js.
      spacing: {
        half: 2,
        one: 4,
        two: 8,
        three: 16,
        four: 24,
        five: 32,
        six: 64,
        'bottom-tab': platformSelect({ ios: 50, android: 80, default: 0 }),
        // BottomTabInset + Spacing.three, for content sitting under the tab bar.
        'bottom-tab-gap': platformSelect({ ios: 66, android: 96, default: 16 }),
      },
      borderRadius: {
        half: 2,
        one: 4,
        two: 8,
        three: 16,
        four: 24,
        five: 32,
        six: 64,
      },
      maxWidth: {
        content: 800,
      },
      // Mirrors Fonts in src/constants/theme.js.
      fontFamily: {
        sans: platformSelect({ ios: 'system-ui', web: 'var(--font-display)', default: 'normal' }),
        serif: platformSelect({ ios: 'ui-serif', web: 'var(--font-serif)', default: 'serif' }),
        rounded: platformSelect({
          ios: 'ui-rounded',
          web: 'var(--font-rounded)',
          default: 'normal',
        }),
        mono: platformSelect({
          ios: 'ui-monospace',
          web: 'var(--font-mono)',
          default: 'monospace',
        }),
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
    },
  },
  plugins: [
    ({ addBase }) =>
      addBase({
        ':root': {
          '--color-text': '20 22 24',
          '--color-text-secondary': '92 97 104',
          '--color-background': '228 225 219',
          '--color-background-element': '243 241 236',
          '--color-background-selected': '216 212 204',
          '--color-primary': '42 46 51',
          '--color-primary-pressed': '26 29 33',
          '--color-border': '198 193 184',
          '--color-success': '47 143 104',
          '--color-warning': '196 146 42',
          '--color-error': '196 75 90',
        },
        '.dark': {
          '--color-text': '242 240 234',
          '--color-text-secondary': '154 158 166',
          '--color-background': '7 8 9',
          '--color-background-element': '18 20 22',
          '--color-background-selected': '27 30 34',
          '--color-primary': '213 216 222',
          '--color-primary-pressed': '180 185 192',
          '--color-border': '42 45 50',
          '--color-success': '78 203 140',
          '--color-warning': '224 179 74',
          '--color-error': '229 107 122',
        },
      }),
  ],
};
