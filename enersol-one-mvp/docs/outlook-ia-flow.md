# Outlook + AI Flow

1. Poll inbox with Microsoft Graph.
2. Detect candidate Order Acknowledgement emails.
3. Extract:
   - carelOrderNumber
   - clientPurchaseOrder
   - products
   - quantities
   - expectedDeliveryDate
4. Match extracted payload to existing projects.
5. Update project status to ORDER_ACK_RECEIVED.
6. If expected date exceeds threshold, create alert.
7. Prepare draft email for follow-up.

## Notes

- Parsing can start rule-based and evolve to LLM-assisted extraction.
- Every extraction should preserve source email reference.

## API endpoint (implemented)

- `POST /api/outlook/import-order-acks`

Request body:

- `thresholdDays` (optional number, default from `DELAY_ALERT_DAYS`)
- `messages` (optional array for manual/mock import)

When `messages` is omitted, the API uses the Graph client scaffold to poll inbox messages.
