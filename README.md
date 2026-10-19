# Zoom AI Services Quickstart

A Node.js/Express + React playground for the [Zoom AI Services APIs](https://developers.zoom.us/docs/ai-services/). Test **Scribe** (speech-to-text), **Translator**, **Summarizer**, **Speech Summarization**, **Voice Agent**, and **Decisions** through a web UI backed by a tRPC server that handles JWT authentication and all API communication.
![screenshot of the playground](https://github.com/user-attachments/assets/92ce3a67-b9c1-4709-9c37-e0396e2ea249)



| Railway | Render | 
|:-:|:-:|
| [![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/zoom-ai-services-playground?referralCode=HTPdHX&utm_medium=integration&utm_source=template&utm_campaign=generic) | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/zoom/ai-services-quickstart) |
## Products

| Product | Modes | Description |
|---|---|---|
| **Scribe** | Fast  | Upload, record, or link (public URL) audio/video, get a transcript immediately |
| **Scribe** | Live  | Stream your microphone and see transcripts in real time over a WebSocket, with optional Captions (partial results) |
| **Scribe** | Batch | Transcribe a single S3 file, an S3 prefix, or a manifest of S3 URIs / public URLs |
| **Translator** | Fast  | Translate up to 4,000 characters between 29 supported locales, including all 24 EU languages, with optional source auto-detection |
| **Translator** | Batch | Translate `.txt` files stored in S3 |
| **Summarizer** | Fast  | Summarize a transcript (up to 96 KB) — recap, action items, summary, or full summary |
| **Summarizer** | Batch | Summarize transcripts stored in S3 |
| **Speech Summarization** | Summarize | Upload a recording (up to 50 MB / 2 hours) and stream its transcript and Markdown summary — automatic, predefined, or custom template, speaker/timestamp citations, sentiment removal, diarization, and profanity filter |
| **Voice Agent** | Live | Talk to a voice agent through your microphone — ten voices, barge-in, context phrases, response token limits, tool choice, and function calling (a `get_current_time` demo tool) |
| **Decisions** | Decide | Evaluate predicate, choice, and score questions against shared text and an optional image, with the canonical `zoom-decisions` model, its Standard alias, or Pro |

All Scribe modes share these options: model selection (automatic, Zoom Scribe English, **Scribe API 3B Pro High-Accuracy**, ten-language multilingual, or Whisper for broader language coverage), automatic language detection, custom vocabulary (inline phrases or a Vocabulary Asset ID), speaker diarization, profanity filtering, and Text Polishing (en-US). Fast and Batch also support stereo channel separation, word timestamps, segmentation, and once-only detection; Live supports continuous detection. Candidate languages can restrict detection. Polishing requires en-US with detection off.

## Architecture

```
playground/          Vite + React + tRPC client (port 5173)
    ├── /trpc                     ──▶  Express + tRPC server (port 4000)
    │                                      ├── Zoom AI Services API
    │                                      └── AWS S3 (for batch jobs)
    ├── /api/speech-summarization ──▶  Upload + Server-Sent Events passthrough (same server)
    ├── /live/scribe              ──▶  WebSocket relay ──▶ Zoom Scribe Live
    └── /live/voice-agent         ──▶  WebSocket relay ──▶ Zoom Voice Agent
```

The playground proxies `/trpc`, `/api`, and `/live/*` to the Express server. All Zoom calls happen server-side; the browser never touches Zoom credentials. For the WebSocket APIs (Scribe Live and Voice Agent) the browser can't set the `Authorization` header, so the server relays audio and events in both directions, injecting a fresh JWT.

## Prerequisites

- [Zoom Build Platform](https://developers.zoom.us/docs/ai-services/build-platform/) credentials
- Node.js 24+
- For batch jobs: an AWS account with an S3 bucket and IAM credentials

## Setup

```bash
git clone https://github.com/zoom/ai-services-quickstart.git
cd ai-services-quickstart
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Description |
|---|---|---|
| `ZOOM_API_KEY` | **Yes** | Zoom Build Platform API key |
| `ZOOM_API_SECRET` | **Yes** | Zoom Build Platform API secret |
| `PORT` | No | Server port (default: `4000`) |

For **batch jobs**, you can supply AWS credentials in the UI or set these server-side defaults:

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM access key — forwarded to Zoom to read/write your S3 bucket |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `AWS_SESSION_TOKEN` | Session token (if using temporary credentials) |

Use `scripts/generate-sts-creds.sh` to generate temporary STS credentials and write them to `.env` (requires the AWS CLI and Python 3; defaults to a one-hour session):
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

The Vite development proxy targets port `4000`. If you change the backend `PORT`, also update the `/trpc`, `/api`, and `/live` targets in `playground/vite.config.ts`. Restart the API server after changing `.env`.

To build and run both parts on one origin without Docker, run these commands from the repository root:

```bash
npm ci
npm ci --prefix playground
npm run build
npm run build --prefix playground
npm run start:compiled
```

Open `http://localhost:4000` (or your configured `PORT`). Run the server from the repository root so it can find `playground/dist`. `npm start` builds the backend only; the single-origin UI requires a separate playground build.

## Docker

Build and run the server and playground as a single image:

```bash
docker build -t ai-services-quickstart .
docker run --rm --env-file .env -p 4000:4000 ai-services-quickstart
```

Open `http://localhost:4000`. The image builds the playground and serves it from the same server as `/trpc`, the webhook endpoints, and the `/live/scribe` and `/live/voice-agent` WebSocket relays. The `.env` file is excluded from the image; `--env-file` supplies credentials at runtime. If you change `PORT` in `.env`, update the container port mapping to match.

## Webhooks

The server receives Zoom batch job notifications at `POST /webhooks/<product>` — e.g. `/webhooks/scribe`, `/webhooks/translator`, `/webhooks/summarizer`. Webhooks require a publicly reachable HTTPS URL — use [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) for local development:

```bash
cloudflared tunnel --url http://localhost:4000
```

Append the product's webhook path to the printed tunnel URL before entering it in the **Webhook URL** field, for example `https://your-tunnel.example/webhooks/scribe`. Use `/webhooks/translator` or `/webhooks/summarizer` for those products. On a deployed service, use its public HTTPS origin with the same path; no tunnel is needed. Set `WEBHOOK_SECRET` in `.env` (or the host's environment) to the same secret submitted with the job — the server uses it to verify the `x-zm-signature` and `x-zm-request-timestamp` headers. Received notifications are logged; use Refresh/Status in the UI to retrieve job updates.

## Resources

- [Zoom AI Scribe documentation](https://developers.zoom.us/docs/ai-services/scribe)
- [Zoom AI Translator documentation](https://developers.zoom.us/docs/ai-services/translator)
- [Zoom AI Summarizer documentation](https://developers.zoom.us/docs/ai-services/summarizer)
- [Speech Summarization documentation](https://developers.zoom.us/docs/ai-services/speech-summarization)
- [Voice Agent documentation](https://developers.zoom.us/docs/ai-services/voice-agent)
- [Decisions documentation](https://developers.zoom.us/docs/ai-services/decisions)
- [API Reference](https://developers.zoom.us/docs/api/ai-services/)
- [Developer Support](https://devsupport.zoom.us) · [Developer Forum](https://devforum.zoom.us)
