# Call recording transcription (Vercel-ready)

A **Next.js (App Router)** app for uploading **`.mp3` / `.mp4`** call recordings, transcribing them with **Deepgram** or **Azure Speech Services**, and exporting **Word (`.docx`)** documents. Credentials are entered in the browser for the **current session only** (not persisted unless you change the code).

---

## Architecture (why it is built this way)

### Vercel function body limit (~4.5 MB)

Vercel Serverless / Route Handlers accept only a **small JSON body**. Sending multi‑megabyte audio through `POST /api/...` would fail or be fragile.

**Approach:** **Direct client uploads to [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)** using `@vercel/blob/client` and a token issued by `/api/upload`. The browser streams the file straight to Blob storage. Your API routes then receive only:

- the **public blob URL**
- **metadata** (original filename, options)

and download audio **server-side** with `fetch(blobUrl)` before calling Deepgram or Azure.

This keeps uploads **Vercel-compatible** and suitable for **production** (large call recordings).

### Processing model

1. **Browser** → uploads each file to Blob (parallel possible; this app processes sequentially for clearer progress).
2. **`POST /api/transcribe`** → downloads bytes from the blob URL, runs the selected provider, returns JSON text.
3. **Browser** → builds `.docx` with the `docx` package (no second upload of audio).

Credentials travel **per request** in **headers** (never logged by this codebase). They are **not** stored in environment variables for end users—each operator brings their own keys.

### Provider comparison

| Topic | Deepgram | Azure Speech (this app) |
|--------|-----------|----------------------------|
| **Integration** | Single REST call to the **pre-recorded** `listen` API with model **`nova-2-phonecall`** (call-oriented). | **Speech SDK** on the server with a **compressed push stream** (MP3 / MP4 container where supported). |
| **Long files** | Generally straightforward for typical call lengths; still bounded by **function timeout** and memory. | Continuous recognition over the decoded stream; same **timeout / memory** limits apply on Vercel. |
| **Very large / batch** | Deepgram’s API still receives the full buffer from this worker (downloaded from Blob). For extreme scale, consider **Deepgram** large-file patterns or **chunking** (not implemented here). | **Batch transcription** (Azure Storage + polling/webhooks) is the Microsoft-recommended path for very long jobs; it is **not** implemented here to avoid requiring user Azure Storage setup. This app is optimized for **practical Vercel** deployments. |
| **MP4** | Handled well by Deepgram. | Uses **MP4 compressed format** when the SDK exposes it; otherwise falls back to MP3 detection—**if a specific MP4 codec fails**, try **Deepgram** or convert to **MP3**. |

---

## Folder / file upload (browser limitations)

- **Multi-file picker** works across modern browsers.
- **Folder selection** uses the non-standard **`webkitdirectory`** attribute (supported in **Chromium** browsers). **Firefox / Safari** may not support folder picking the same way; those users can still use **Choose files**.
- For folder uploads, the UI uses **`webkitRelativePath`** when present so nested names stay unique and readable; otherwise it uses `File.name`.

---

## Features

- Provider selector: **Deepgram** | **Azure Speech**
- Credential fields + **Test connection** (lightweight backend check)
- Multi-file + optional folder upload; **unsupported types** called out in the UI
- Files sorted **alphabetically** before transcription (by display name)
- Per-file status: queued → uploading → transcribing → completed / failed; **continues on error**
- Combined **`all_call_transcripts.docx`** with headings = **original filenames**, page breaks between calls, failed sections show: **`Transcription failed for this file.`**
- **Nice-to-haves:** timestamps option, **one `.docx` per file** (ZIP), **retry** failed rows, **transcript preview**

---

## Local development

**Requirements:** Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
# Set BLOB_READ_WRITE_TOKEN from Vercel Blob (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `BLOB_READ_WRITE_TOKEN` | **Yes** | Server-side token used by `/api/upload` (`handleUpload`) so the client can upload directly to Blob. |

Create a Blob store in the Vercel dashboard and copy the **read/write** token into `.env.local`.

> **Common error: "Vercel Blob: Failed to retrieve the client token"**  
> This means `BLOB_READ_WRITE_TOKEN` is missing or invalid. Fix:
> 1. **Vercel dashboard** → your project → **Storage** tab → **Create / Connect Blob store** (it auto-adds the token to environment variables).  
> 2. **Redeploy** the project after linking the store.  
> 3. **Locally**: run `vercel env pull` or copy the token into `.env.local`.
>
> **Note on filenames:** File names with special characters such as `[`, `]`, or spaces (common in CXone exports, e.g. `recording_[UTC]_...mp4`) are automatically sanitized for the Blob upload path. The **original filename** is always preserved as the heading in the Word document.

---

## Deploying to Vercel

1. Push the project to GitHub / GitLab / Bitbucket.
2. **Import** the repo in [Vercel](https://vercel.com).
3. Under **Storage**, create a **Blob** store and link it to the project (or add `BLOB_READ_WRITE_TOKEN` in **Settings → Environment Variables**).
4. Deploy.

### Limits to plan for

- **Function duration:** Long calls may exceed hobby-tier timeouts. Use a **Pro** plan and configure **`maxDuration`** (this repo sets `maxDuration = 300` where supported) for `/api/transcribe`.
- **Memory:** Downloading and holding very large files in memory can hit limits; for huge assets, consider chunking, a dedicated worker, or provider-specific batch APIs.

---

## Project structure (concerns separated)

```
app/
  api/upload/route.ts              # Vercel Blob handleUpload
  api/test-connection/*/route.ts   # Provider connectivity checks
  api/transcribe/route.ts          # Download blob → transcribe
  layout.tsx, page.tsx, globals.css
components/transcribe/             # UI
lib/
  api/client-headers.ts            # Credential headers (client)
  server/request-credentials.ts    # Parse / validate headers (server)
  services/deepgram.ts             # Deepgram-only logic
  services/azure-speech.ts         # Azure-only logic
  validation/credentials.ts        # Client-side validation
  upload/client-blob-upload.ts     # Browser → Blob
  transcription/orchestrator.ts  # Client orchestration helpers
  docx/build-documents.ts          # Word generation
  types.ts, constants.ts
```

Adding another provider: implement a service module + `test-connection` + branch in `/api/transcribe`, then extend the UI selector and types.

---

## Security notes

- **Do not** commit real API keys. Users paste keys into the UI; those keys are sent over **HTTPS** to your deployment’s API routes only.
- This template **does not** log credential headers or raw audio.
- Blob URLs are **public** by default in this flow so the server can `fetch` them without per-user storage ACLs. If you need **private** blobs, add **authenticated download** (e.g. server-side token) and avoid exposing URLs in the client longer than necessary.
- The `/api/upload` route intentionally skips user authentication so the demo works out of the box. **Before production**, add checks inside `onBeforeGenerateToken` (see [Vercel’s client upload auth guide](https://vercel.com/docs/storage/vercel-blob/client-upload#authenticating-client-uploads)).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |
| `npm run lint` | ESLint |

---

## License

MIT (adjust as needed for your organization).
