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
          '--color-text': '21 22 34',
          '--color-text-secondary': '104 106 120',
          '--color-background': '247 247 250',
          '--color-background-element': '255 255 255',
          '--color-background-selected': '240 240 246',
          '--color-primary': '91 92 226',
          '--color-primary-pressed': '72 73 199',
          '--color-border': '226 226 234',
          '--color-success': '50 184 120',
          '--color-warning': '244 183 64',
          '--color-error': '232 93 117',
        },
        '.dark': {
          '--color-text': '245 245 250',
          '--color-text-secondary': '165 167 181',
          '--color-background': '13 14 20',
          '--color-background-element': '23 25 34',
          '--color-background-selected': '30 32 43',
          '--color-primary': '124 127 242',
          '--color-primary-pressed': '104 107 224',
          '--color-border': '41 43 56',
          '--color-success': '67 212 142',
          '--color-warning': '255 200 87',
          '--color-error': '255 113 135',
        },
      }),
  ],
};
