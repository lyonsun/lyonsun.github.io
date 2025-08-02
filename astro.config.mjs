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
                project: process.env.SENTRY_PROJECT,
                org: process.env.SENTRY_ORG,
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

