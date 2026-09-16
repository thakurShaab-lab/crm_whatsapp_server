-- The legacy `whatsapp_incoming_reply_response` table only ever had single-column
-- indexes (on user_admin_id, waNumber, mobile, recvDate individually), so every
-- thread-window/conversation-list/last-reply lookup here — all of which filter on
-- some combination of these four columns together — could only use one of them and
-- then filter the rest row-by-row. This composite index lets MySQL satisfy that
-- whole filter (plus the ORDER BY recvDate) directly from the index itself.
ALTER TABLE `whatsapp_incoming_reply_response`
  ADD INDEX `idx_thread_window` (`user_admin_id`, `waNumber`, `mobile`, `recvDate`);
