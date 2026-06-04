/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#ECFEFF',
                    100: '#CFFAFE',
                    200: '#A5F3FC',
                    300: '#67E8F9',
                    400: '#22D3EE',
                    500: '#06B6D4',
                    600: '#0891B2',
                    700: '#0E7490',
                    800: '#155E75',
                    900: '#164E63',
                },
                background: 'var(--background)',
                foreground: 'var(--foreground)',
                border: 'var(--border)',
                muted: 'var(--muted)',
                success: '#10B981',
                danger: '#EF4444',
                warning: '#F59E0B',
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui'],
            },
            borderRadius: {
                card: '12px',
                input: '8px',
            },
            boxShadow: {
                card: '0 2px 12px rgba(0,0,0,0.03)',
                'card-hover': '0 4px 20px rgba(0,0,0,0.06)',
            },
        },
    },
    plugins: [],
}
