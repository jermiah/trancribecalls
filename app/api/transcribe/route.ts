import { azureTranscribeBuffer } from "@/lib/services/azure-speech";
import { deepgramTranscribeBuffer } from "@/lib/services/deepgram";
import {
  assertAzureCreds,
  assertDeepgramKey,
  parseCredentialsFromRequest,
} from "@/lib/server/request-credentials";
import type { TranscriptionProvider } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export const maxDuration = 300;

interface TranscribeBody {
  provider: TranscriptionProvider;
  blobUrl: string;
  filename: string;
  includeTimestamps?: boolean;
}

function guessContentType(filename: string): string {
  const n = filename.toLowerCase();
  if (n.endsWith(".mp3")) return "audio/mpeg";
  if (n.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

export async function POST(request: NextRequest) {
  let body: TranscribeBody;
  try {
    body = (await request.json()) as TranscribeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { provider, blobUrl, filename } = body;
  const includeTimestamps = Boolean(body.includeTimestamps);

  if (!provider || (provider !== "deepgram" && provider !== "azure")) {
    return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  }
  if (!blobUrl || typeof blobUrl !== "string") {
    return NextResponse.json({ error: "Missing blob URL." }, { status: 400 });
  }
  if (!filename || typeof filename !== "string") {
    return NextResponse.json({ error: "Missing filename." }, { status: 400 });
  }

  try {
    const audioRes = await fetch(blobUrl);
    if (!audioRes.ok) {
      return NextResponse.json(
        { error: `Could not download file from storage (${audioRes.status}).` },
        { status: 502 }
      );
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType =
      audioRes.headers.get("content-type") || guessContentType(filename);

    const creds = parseCredentialsFromRequest(request, provider);
    let transcript: string;

    if (provider === "deepgram") {
      const key = assertDeepgramKey(creds);
      transcript = await deepgramTranscribeBuffer(
        key,
        buffer,
        contentType,
        { includeTimestamps }
      );
    } else {
      const { key, region } = assertAzureCreds(creds);
      transcript = await azureTranscribeBuffer(
        key,
        region,
        buffer,
        contentType,
        filename,
        { includeTimestamps }
      );
    }

    return NextResponse.json({ transcript });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Transcription failed unexpectedly.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
