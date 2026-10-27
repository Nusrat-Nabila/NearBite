# NearBite Frontend

The React website for NearBite.

## Install first

- [Node.js](https://nodejs.org/) 20.19 or newer, or 22.12 or newer (npm comes with it)

## Run the frontend

Start the [backend](../backend/README.md) first, then:

```bash
npm install
npm run dev
```

Open http://localhost:5173 in the browser.

The website sends `/api` and `/media` requests to the backend at http://127.0.0.1:8000, so the backend must be running.

## Other commands

- `npm run build` builds the website for production (output in `dist/`)
- `npm run lint` checks the code
