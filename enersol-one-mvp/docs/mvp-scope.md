# MVP Scope

## Core navigation

- Dashboard
- Projects
- Documents
- AI Assistant
- Settings

## Dashboard cards

- Active projects
- Pending orders
- Delivery delays
- Weekly shipments
- Follow-up quotations
- AI alerts

## MVP delivery target

- End-to-end project data model
- Document slots by project
- Outlook OA import and extraction
- Delay alert generation
- Draft email preparation for follow-up

## Documents API (implemented)

- `GET /api/projects/:projectId/documents`
- `POST /api/projects/:projectId/documents/upload` (multipart field: `file`, with `type` and optional `source`)
- `GET /api/documents/:documentId`
- `GET /api/documents/:documentId/download`

## Storage convention

- Files are stored under `data/documents/{projectId}/{documentId}-{sanitizedFilename}`
