import type { Config } from 'tailwindcss';

/**
 * Tokens FORJA — punto único de ajuste de la identidad.
 *
 * Los valores viven como canales RGB en src/app/globals.css, de modo que el
 * modo oscuro sólo reasigna roles y aquí no se toca nada. `<alpha-value>` es
 * lo que permite escribir `bg-terracota/10` o `border-ocre/40`.
 */
const canal = (nombre: string) => `rgb(var(--${nombre}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tinta: canal('tinta'),
        hueso: canal('hueso'),
        'hueso-2': canal('hueso-2'),
        terracota: {
          DEFAULT: canal('terracota'),
          suave: canal('terracota-suave'),
        },
        verde: {
          forja: canal('verde-forja'),
        },
        ocre: canal('ocre'),
        ciruela: canal('ciruela'),
        borde: canal('borde'),
        'borde-2': canal('borde-2'),
        texto: {
          DEFAULT: canal('texto'),
          2: canal('texto-2'),
          3: canal('texto-3'),
          4: canal('texto-4'),
        },
        superficie: {
          DEFAULT: canal('superficie'),
          2: canal('superficie-2'),
          3: canal('superficie-3'),
        },
      },
      fontFamily: {
        sans: ['var(--fuente-archivo)', 'Helvetica Neue', 'Arial', 'sans-serif'],
        editorial: ['var(--fuente-newsreader)', 'Georgia', 'serif'],
      },
      borderRadius: {
        forja: '0.75rem',
        'forja-lg': '1.125rem',
      },
      boxShadow: {
        forja: '0 1px 2px rgba(26, 26, 26, 0.04), 0 6px 18px -12px rgba(26, 26, 26, 0.18)',
        'forja-alto': '0 2px 6px rgba(26, 26, 26, 0.06), 0 16px 32px -18px rgba(26, 26, 26, 0.28)',
      },
      letterSpacing: {
        firma: '0.22em',
        marca: '-0.02em',
      },
      keyframes: {
        palomear: {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
        aparecer: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        deslizar: {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        palomear: 'palomear 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        aparecer: 'aparecer 180ms ease-out',
        deslizar: 'deslizar 200ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
