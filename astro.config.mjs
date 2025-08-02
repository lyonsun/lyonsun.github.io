// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sentry from '@sentry/astro';

// https://astro.build/config
export default defineConfig({
    integrations: [
        react(),
        sentry({
            clientInitPath: '.config/sentry.client.config.ts',
            serverInitPath: '.config/sentry.server.config.ts',
            sourceMapsUploadOptions: {
                project: 'javascript-astro',
                org: 'suns-project',
                authToken: process.env.SENTRY_AUTH_TOKEN,
                telemetry: false,
            },
        }),
    ],

    vite: {
        // @ts-expect-error
        plugins: [tailwindcss()],
    },
});

