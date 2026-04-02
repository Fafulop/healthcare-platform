import { getSession } from "next-auth/react";

/**
 * Authenticated fetch wrapper for API calls
 * Automatically attaches JWT token from NextAuth session
 *
 * Usage:
 *   const response = await authFetch('https://api.example.com/endpoint', {
 *     method: 'POST',
 *     body: JSON.stringify(data)
 *   });
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Check if user is authenticated
  const session = await getSession();

  if (!session?.user?.email) {
    throw new Error("Not authenticated");
  }

  // Get NextAuth JWT token from server endpoint
  const tokenResponse = await fetch('/api/auth/get-token');

  if (!tokenResponse.ok) {
    if (tokenResponse.status === 401) {
      throw new Error("Session expired - please log in again");
    }
    throw new Error("Failed to get authentication token");
  }

  const { token } = await tokenResponse.json();

  // Make the authenticated request
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // If the API rejects the session (e.g. kill-sessions was used on another device),
  // redirect to login so the user is not left in a broken state.
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Session invalidated - redirecting to login');
  }

  return response;
}
