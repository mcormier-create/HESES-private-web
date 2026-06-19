# HESES private web validation

Recommended private validation deployment: Render web service.

## Local validation

```bash
npm ci
npm run build
npm start
```

Open the URL shown by Vite Preview.

## Private access

Set `HESES_ACCESS_CODE` on the hosting platform to enable the private login page.
If this variable is empty or missing, HESES starts normally without the login screen.

## Render setup

1. Push the project to a private GitHub repository.
2. In Render, create a new Blueprint from `render.yaml`.
3. Add environment variables:
   - `HESES_ACCESS_CODE`: private code shared with validators.
   - `OPENAI_API_KEY`: optional. If absent, the assistant uses local HESES mode.
   - `HESES_OPENAI_MODEL`: optional, default `gpt-4.1-mini`.
4. Deploy.

The deployed service uses:

```bash
npm ci && npm run build
npm start
```

The PDF/report routes and HESES assistant routes are served by Vite Preview.
