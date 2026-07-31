# Zoom AI Services Quickstart

A Node.js/Express + React playground for the [Zoom AI Services APIs](https://developers.zoom.us/docs/ai-services/). Test **Scribe** (speech-to-text), **Translator**, and **Summarizer** through a web UI backed by a tRPC server that handles JWT authentication and all API communication.
![screenshot of the playground](https://github.com/user-attachments/assets/92ce3a67-b9c1-4709-9c37-e0396e2ea249)

## Products

| Product | Modes | Description |
|---|---|---|
| **Scribe** | Fast  | Upload or record audio/video, get a transcript immediately |
| **Scribe** | Live  | Stream your microphone and see transcripts in real time over a WebSocket |
| **Scribe** | Batch | Process thousands of S3 files; auto-splits jobs >1,000 files |
| **Translator** | Fast  | Translate up to 4,000 characters into one of 9 supported languages |
| **Translator** | Batch | Translate `.txt` files stored in S3 |
| **Summarizer** | Fast  | Summarize a transcript (up to 96 KB) — recap, action items, summary, or full summary |
| **Summarizer** | Batch | Summarize transcripts stored in S3 |

## Architecture

```
playground/          Vite + React + tRPC client (port 5173)
    ├── /trpc         ──▶  Express + tRPC server (port 4000)
    │                          ├── Zoom AI Services API
    │                          └── AWS S3 (for batch jobs)
    └── /live/scribe  ──▶  WebSocket relay (same server) ──▶ Zoom Scribe live ASR
```

The playground proxies `/trpc` (REST) and `/live/scribe` (WebSocket) to the Express server. All Zoom calls happen server-side; the browser never touches Zoom credentials. For Live mode the browser can't set the `Authorization` header on a WebSocket, so the server relays mic audio up and transcription events down, injecting a fresh JWT.

## Prerequisites

- [Zoom Build Platform](https://developers.zoom.us/docs/ai-services/build-platform/) credentials
- Node.js 24+
- For batch jobs: an AWS account with an S3 bucket and IAM credentials

## Setup

```bash
git clone https://github.com/zoom/scribe-quickstart.git
cd scribe-quickstart
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Description |
|---|---|---|
| `ZOOM_API_KEY` | **Yes** | Zoom Build Platform API key |
| `ZOOM_API_SECRET` | **Yes** | Zoom Build Platform API secret |
| `PORT` | No | Server port (default: `4000`) |

For **batch jobs** also set:

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key — forwarded to Zoom to read/write your S3 bucket |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `AWS_SESSION_TOKEN` | Session token (if using temporary credentials) |
| `WEBHOOK_SECRET` | HMAC secret to verify incoming webhook payloads |

Use `scripts/generate-sts-creds.sh` to generate temporary STS credentials:
```bash
./scripts/generate-sts-creds.sh <AWS_ACCESS_KEY_ID> <AWS_SECRET_ACCESS_KEY>
```

## Running

```bash
# Terminal 1 — API server
npm start

# Terminal 2 — Playground UI
cd playground && npm install && npm run dev
```

Open `http://localhost:5173`.

## Docker

Build and run the API server:

```bash
docker build -t scribe-quickstart .
docker run --rm --env-file .env -p 4000:4000 scribe-quickstart
```

The image runs the backend on port `4000`, including `/trpc`, the webhook endpoints, and the `/live/scribe` WebSocket relay. The `.env` file is excluded from the image; `--env-file` supplies credentials securely at runtime.

The playground is not included in the backend image. To use the UI, run it separately while the container is running:

```bash
cd playground
npm install
npm run dev
```

Then open `http://localhost:5173`. If you change `PORT` in `.env`, update the container port mapping and the playground proxy target accordingly.

## Webhooks

The server exposes three webhook endpoints for Zoom batch job notifications: `POST /webhooks/scribe`, `POST /webhooks/translator`, and `POST /webhooks/summarizer`. All three require a publicly reachable HTTPS URL — use [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) for local development:

```bash
cloudflared tunnel --url http://localhost:4000
```

Paste the printed URL into the **Webhook URL** field when submitting a batch job in the playground. Set `WEBHOOK_SECRET` in `.env` to the same value you submit alongside it — the server uses it to verify the `x-zm-signature` header on incoming callbacks.

## Resources

- [Zoom AI Scribe documentation](https://developers.zoom.us/docs/ai-services/scribe)
- [Zoom AI Translator documentation](https://developers.zoom.us/docs/ai-services/translator)
- [Zoom AI Summarizer documentation](https://developers.zoom.us/docs/ai-services/summarizer)
- [API Reference](https://developers.zoom.us/docs/api/ai-services/)
- [Developer Support](https://devsupport.zoom.us) · [Developer Forum](https://devforum.zoom.us)
