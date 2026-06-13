/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    50:  '#F5F0FF',
                    100: '#E8DCFF',
                    200: '#D0BAFF',
                    300: '#A97FFF',
                    400: '#7C4FCC',
                    500: '#5C2E99',
                    600: '#3D1A6B',  /* roxo médio — elementos interativos */
                    700: '#2A0D4F',  /* roxo escuro — nav ativo, headers */
                    800: '#1A0A2E',  /* fundo da logo */
                    900: '#0D0618',  /* preto-roxo — dark mode */
                },
                gold: {
                    300: '#F5E27A',
                    400: '#E8C84E',
                    500: '#C9A236',  /* dourado da logo — accent principal */
                    600: '#A07C1A',  /* dourado escuro — hover */
                    700: '#7A5C0E',
                },
                amber: {
                    400: '#FBBF24',
                    500: '#F59E0B',
                    600: '#D97706',
                },
                background: 'var(--background)',
                foreground: 'var(--foreground)',
                border: 'var(--border)',
                muted: 'var(--muted)',
                success: '#16A34A',
                danger:  '#DC2626',
                warning: '#D97706',
            },
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui'],
            },
            borderRadius: {
                card:  '14px',
                input: '8px',
            },
            boxShadow: {
                card:       '0 1px 8px rgba(26,10,46,0.06)',
                'card-hover': '0 4px 20px rgba(26,10,46,0.12)',
                brand:      '0 4px 16px rgba(61,26,107,0.30)',
                gold:       '0 4px 16px rgba(201,162,54,0.35)',
            },
        },
    },
    plugins: [],
}
