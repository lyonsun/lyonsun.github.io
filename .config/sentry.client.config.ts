import * as Sentry from '@sentry/astro';

Sentry.init({
    dsn: 'https://b58f88718824de018a5bc4aa1d0dad0f@o4509667338485760.ingest.de.sentry.io/4509667353034832',

    // Adds request headers and IP for users, for more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#sendDefaultPii
    sendDefaultPii: true,

    integrations: [],
});
