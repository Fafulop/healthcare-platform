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
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}
