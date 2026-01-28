/**
 * Authenticated fetch wrapper for API calls
 * Automatically includes authentication token from NextAuth session
 */

import { getSession } from "next-auth/react";

/**
 * Get authentication headers for API requests
 * Returns Authorization header with JWT token from session
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await getSession();

  if (!session?.user?.email) {
    throw new Error("No active session - please log in");
  }

  // Get proper JWT token from the get-token endpoint
  // This endpoint creates a signed JWT that the API can verify
  try {
    const tokenResponse = await fetch('/api/auth/get-token', {
      credentials: 'include',
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get auth token: ${tokenResponse.status}`);
    }

    const { token } = await tokenResponse.json();

    if (!token) {
      throw new Error('No token returned from auth endpoint');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw new Error('Failed to authenticate - please try logging in again');
  }
}

/**
 * Authenticated fetch wrapper
 * Automatically includes auth headers
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = await getAuthHeaders();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
    credentials: 'include',
  });

  return response;
}
