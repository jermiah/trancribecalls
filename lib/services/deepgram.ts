export interface DeepgramTranscribeOptions {
  includeTimestamps: boolean;
}

function buildListenUrl(options: DeepgramTranscribeOptions): string {
  const params = new URLSearchParams({
    model: "nova-2-phonecall",
    smart_format: "true",
    punctuate: "true",
  });
  if (options.includeTimestamps) {
    params.set("utterances", "true");
    params.set("utt_split", "0.8");
    params.set("words", "true");
  }
  return `https://api.deepgram.com/v1/listen?${params.toString()}`;
}

interface DeepgramWord {
  word: string;
  start?: number;
  end?: number;
}

interface DeepgramUtterance {
  transcript: string;
  start: number;
  end: number;
  words?: DeepgramWord[];
}

interface DeepgramChannel {
  alternatives?: Array<{
    transcript?: string;
    words?: DeepgramWord[];
  }>;
}

interface DeepgramResult {
  results?: {
    channels?: DeepgramChannel[];
    utterances?: DeepgramUtterance[];
  };
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function transcriptFromUtterances(utterances: DeepgramUtterance[]): string {
  return utterances
    .map((u) => {
      const t = `[${formatSeconds(u.start)}] ${u.transcript.trim()}`;
      return t;
    })
    .join("\n\n");
}

function transcriptFromWords(words: DeepgramWord[]): string {
  if (!words.length) return "";
  const lines: string[] = [];
  let buf: string[] = [];
  let lineStart = words[0]?.start ?? 0;
  for (const w of words) {
    if (buf.length === 0 && w.start != null) lineStart = w.start;
    buf.push(w.word);
    if (buf.length > 12 || /[.!?]$/.test(w.word)) {
      lines.push(`[${formatSeconds(lineStart)}] ${buf.join(" ").trim()}`);
      buf = [];
    }
  }
  if (buf.length) lines.push(`[${formatSeconds(lineStart)}] ${buf.join(" ").trim()}`);
  return lines.join("\n\n");
}

export function extractTranscriptText(
  json: DeepgramResult,
  includeTimestamps: boolean
): string {
  const utterances = json.results?.utterances;
  if (includeTimestamps && utterances?.length) {
    return transcriptFromUtterances(utterances);
  }
  const words = json.results?.channels?.[0]?.alternatives?.[0]?.words;
  if (includeTimestamps && words?.length) {
    return transcriptFromWords(words);
  }
  const plain =
    json.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
  return plain;
}

export async function deepgramTestConnection(apiKey: string): Promise<void> {
  const res = await fetch("https://api.deepgram.com/v1/projects", {
    method: "GET",
    headers: { Authorization: `Token ${apiKey}` },
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.err_msg || err?.message || `Deepgram error (${res.status})`);
  }
}

export async function deepgramTranscribeBuffer(
  apiKey: string,
  buffer: Buffer,
  contentType: string,
  options: DeepgramTranscribeOptions
): Promise<string> {
  const url = buildListenUrl(options);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": contentType || "application/octet-stream",
    },
    body: new Uint8Array(buffer),
  });
  const json = (await res.json()) as DeepgramResult & {
    err_msg?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(json.err_msg || json.message || `Deepgram transcription failed (${res.status})`);
  }
  return extractTranscriptText(json, options.includeTimestamps).trim() || "(No speech detected.)";
}

async function safeJson(res: Response): Promise<{ err_msg?: string; message?: string } | null> {
  try {
    return (await res.json()) as { err_msg?: string; message?: string };
  } catch {
    return null;
  }
}
