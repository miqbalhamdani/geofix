import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        'on-tertiary-container': '#868382',
        'on-tertiary-fixed-variant': '#484645',
        'on-surface': '#1c1b1b',
        'on-surface-variant': '#444748',
        'inverse-surface': '#313030',
        'inverse-on-surface': '#f4f0ef',
        'surface-bright': '#fdf8f8',
        'on-secondary-fixed': '#1b1c1c',
        'surface-container-low': '#f7f3f2',
        'surface-container-lowest': '#ffffff',
        'secondary-fixed-dim': '#c7c6c6',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'primary-container': '#1c1b1b',
        'inverse-primary': '#c8c6c5',
        'primary-fixed-dim': '#c8c6c5',
        'surface-dim': '#ddd9d8',
        'on-primary-fixed-variant': '#474746',
        'on-secondary-container': '#626262',
        'surface-variant': '#e5e2e1',
        'surface-container-highest': '#e5e2e1',
        'secondary-fixed': '#e4e2e2',
        background: '#fdf8f8',
        'on-tertiary': '#ffffff',
        'tertiary-fixed': '#e6e2df',
        'on-primary-container': '#858383',
        'on-secondary': '#ffffff',
        'tertiary-fixed-dim': '#cac6c4',
        primary: '#000000',
        'on-tertiary-fixed': '#1c1b1a',
        surface: '#fdf8f8',
        'on-secondary-fixed-variant': '#464747',
        'outline-variant': '#c4c7c7',
        'surface-tint': '#5f5e5e',
        'tertiary-container': '#1c1b1a',
        'on-primary-fixed': '#1c1b1b',
        'on-primary': '#ffffff',
        'primary-fixed': '#e5e2e1',
        'on-background': '#1c1b1b',
        outline: '#747878',
        'surface-container-high': '#ebe7e6',
        tertiary: '#000000',
        error: '#ba1a1a',
        'secondary-container': '#e1dfdf',
        'on-error-container': '#93000a',
        'surface-container': '#f1edec',
        secondary: '#5e5e5e'
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px'
      },
      spacing: {
        gutter: '24px',
        lg: '40px',
        margin: '32px',
        xs: '8px',
        sm: '12px',
        md: '24px',
        base: '4px'
      },
      fontFamily: {
        h1: ['Inter', 'sans-serif'],
        'body-sm': ['Inter', 'sans-serif'],
        h2: ['Inter', 'sans-serif'],
        h3: ['Inter', 'sans-serif'],
        'body-lg': ['Inter', 'sans-serif'],
        'mono-label': ['monospace'],
        'label-caps': ['Inter', 'sans-serif']
      },
      fontSize: {
        h1: ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        'body-sm': ['14px', { lineHeight: '1.5', letterSpacing: '0em', fontWeight: '400' }],
        h2: ['24px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '1.4', letterSpacing: '0em', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '1.6', letterSpacing: '0em', fontWeight: '400' }],
        'mono-label': ['13px', { lineHeight: '1', letterSpacing: '0em', fontWeight: '400' }],
        'label-caps': ['12px', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '600' }]
      }
    }
  },
  plugins: [forms]
};
