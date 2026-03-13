// POST /api/calendar/webhook
// Receives Google Calendar push notifications.
// This endpoint is intentionally one-way: app → GCal only.
// We acknowledge Google's pings to keep the channel alive but do NOT write
// any changes back to the DB. The calendar is a read-only mirror of the app.

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Validate token so random actors can't hit this endpoint
  const channelToken = request.headers.get("x-goog-channel-token");
  const expectedToken = process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET;

  if (!expectedToken || channelToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Acknowledge every notification — required so Google doesn't terminate the channel.
  // We intentionally do NOT process event changes (no DB writes).
  return new NextResponse(null, { status: 200 });
}
