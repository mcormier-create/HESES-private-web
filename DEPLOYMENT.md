# HESA private web validation

Recommended private validation deployment: Render web service.

## Local validation

```bash
npm ci
npm run build
npm start
```

Open the URL shown by Vite Preview.

## Private access

Set `HESA_ACCESS_PASSWORD` on the hosting platform. HESA remains inaccessible until this server-side password is configured and validated.

## Render setup

1. Push the project to a private GitHub repository.
2. In Render, create a new Blueprint from `render.yaml`.
3. Add environment variables:
   - `HESA_ACCESS_PASSWORD`: private password shared with validators. Never commit this value.
   - `OPENAI_API_KEY`: optional. If absent, the assistant uses local HESA mode.
   - `HESES_OPENAI_MODEL`: optional, default `gpt-4.1-mini`.
4. Deploy.

The deployed service uses:

```bash
npm ci && npm run build
npm start
```

The PDF/report routes and HESA assistant routes are served by Vite Preview.
