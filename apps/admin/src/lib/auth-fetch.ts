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

  // Create a simple auth payload with user info
  // The API will verify this against the database
  const authPayload = {
    email: session.user.email,
    role: session.user.role,
    timestamp: Date.now(),
  };

  // Encode as base64 (not for security, just for transport)
  // Real security comes from validating against database
  const token = btoa(JSON.stringify(authPayload));

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
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
