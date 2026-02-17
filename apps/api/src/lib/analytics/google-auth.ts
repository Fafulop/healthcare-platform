import { google } from 'googleapis';

let authClient: InstanceType<typeof google.auth.GoogleAuth> | null = null;

export function getGoogleAuth() {
  if (authClient) return authClient;

  const base64Key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!base64Key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  const credentials = JSON.parse(Buffer.from(base64Key, 'base64').toString('utf-8'));

  authClient = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly',
    ],
  });

  return authClient;
}

export function getGA4PropertyId(): string {
  const id = process.env.GA4_PROPERTY_ID;
  if (!id) {
    throw new Error('GA4_PROPERTY_ID environment variable is not set');
  }
  return id;
}

export function getSearchConsoleSiteUrl(): string {
  const url = process.env.SEARCH_CONSOLE_SITE_URL;
  if (!url) {
    throw new Error('SEARCH_CONSOLE_SITE_URL environment variable is not set');
  }
  return url;
}
