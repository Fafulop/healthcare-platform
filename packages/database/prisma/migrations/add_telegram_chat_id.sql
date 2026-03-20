-- Add telegram_chat_id to doctors table for Telegram appointment notifications
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
