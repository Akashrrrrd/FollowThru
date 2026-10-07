import type { Config } from 'tailwindcss';

// `<alpha-value>` lets Tailwind apply opacity modifiers (bg-muted/60, text-gold/80, ...)
const c = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

// Semantic status: strong color + soft tint, e.g. text-status-overdue, bg-status-overdue-soft
const status = (name: string) => ({
  DEFAULT: c(`status-${name}`),
  soft: c(`status-${name}-soft`),
});

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '80rem' }, // 1280px
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        serif: ['var(--font-serif)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      maxWidth: {
        page: '80rem',
        prose: '68ch',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gold-foil':
          'linear-gradient(135deg, hsl(var(--gold-light)), hsl(var(--gold)) 50%, hsl(var(--gold-dark)))',
        'ink-gradient':
          'linear-gradient(160deg, hsl(var(--ink-2)), hsl(var(--ink)))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        gold: 'var(--shadow-gold)',
      },
      transitionTimingFunction: {
        'out-expo': 'var(--ease-out)',
      },
      colors: {
        background: c('background'),
        foreground: c('foreground'),
        card: {
          DEFAULT: c('card'),
          foreground: c('card-foreground'),
        },
        popover: {
          DEFAULT: c('popover'),
          foreground: c('popover-foreground'),
        },
        primary: {
          DEFAULT: c('primary'),
          foreground: c('primary-foreground'),
        },
        secondary: {
          DEFAULT: c('secondary'),
          foreground: c('secondary-foreground'),
        },
        muted: {
          DEFAULT: c('muted'),
          foreground: c('muted-foreground'),
        },
        accent: {
          DEFAULT: c('accent'),
          foreground: c('accent-foreground'),
        },
        destructive: {
          DEFAULT: c('destructive'),
          foreground: c('destructive-foreground'),
        },
        gold: {
          DEFAULT: c('gold'),
          light: c('gold-light'),
          dark: c('gold-dark'),
          foreground: c('gold-foreground'),
        },
        ink: {
          DEFAULT: c('ink'),
          2: c('ink-2'),
        },
        success: c('success'),
        warning: c('warning'),
        status: {
          overdue: status('overdue'),
          soon: status('soon'),
          progress: status('progress'),
          done: status('done'),
          blocked: status('blocked'),
          info: status('info'),
          neutral: status('neutral'),
        },
        border: c('border'),
        input: c('input'),
        ring: c('ring'),
        chart: {
          '1': c('chart-1'),
          '2': c('chart-2'),
          '3': c('chart-3'),
          '4': c('chart-4'),
          '5': c('chart-5'),
        },
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      // Keyframes for everything below live in globals.css so component
      // classes (.toast, .btn, .field-message) can use them without a utility.
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out both',
        'fade-up': 'fade-up 0.3s var(--ease-out) both',
        'slide-in-right': 'slide-in-right 0.4s var(--ease-out) both',
        'scale-up': 'scale-up 0.3s var(--ease-out) both',
        'bounce-subtle': 'bounce-subtle 1.5s ease-in-out infinite',
        shake: 'shake 0.4s ease-in-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;