/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Outfit', 'sans-serif'],
            },
            colors: {
                brand: {
                    DEFAULT: 'var(--color-brand)',
                    50: 'color-mix(in srgb, var(--color-brand), white 90%)',
                    100: 'color-mix(in srgb, var(--color-brand), white 80%)',
                    200: 'color-mix(in srgb, var(--color-brand), white 60%)',
                    300: 'color-mix(in srgb, var(--color-brand), white 40%)',
                    400: 'color-mix(in srgb, var(--color-brand), white 20%)',
                    500: 'var(--color-brand)',
                    600: 'color-mix(in srgb, var(--color-brand), black 10%)',
                    700: 'color-mix(in srgb, var(--color-brand), black 20%)',
                    800: 'color-mix(in srgb, var(--color-brand), black 30%)',
                    900: 'color-mix(in srgb, var(--color-brand), black 40%)',
                },
                canvas: {
                    bg: 'var(--color-bg)',
                    surface: 'var(--color-surface)',
                    text: 'var(--color-text)',
                    border: 'var(--color-border)',
                }
            },
            borderRadius: {
                'btn': 'var(--radius-btn)',
            }
        },
    },
    plugins: [],
}
