import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
    site: import.meta.env.SITE_URL || 'https://lyonsun.github.io',

    vite: {
        plugins: [tailwindcss()],
    },
});
