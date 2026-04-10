import * as sdk from "microsoft-cognitiveservices-speech-sdk";

export interface AzureTranscribeOptions {
  includeTimestamps: boolean;
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function pickContainer(
  contentType: string,
  filename: string
): sdk.AudioStreamContainerFormat {
  const ct = contentType.toLowerCase();
  const fn = filename.toLowerCase();
  if (fn.endsWith(".mp3") || ct.includes("mpeg") || ct.includes("mp3")) {
    return sdk.AudioStreamContainerFormat.MP3;
  }
  if (fn.endsWith(".mp4") || ct.includes("mp4")) {
    const fmt = sdk.AudioStreamContainerFormat as unknown as Record<
      string,
      sdk.AudioStreamContainerFormat
    >;
    if (fmt.MP4 !== undefined) return fmt.MP4;
  }
  return sdk.AudioStreamContainerFormat.MP3;
}

export async function azureTestConnection(
  apiKey: string,
  region: string
): Promise<void> {
  const url = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(
      t?.slice(0, 200) || `Azure token request failed (${res.status})`
    );
  }
}

/**
 * Transcribes compressed audio (MP3 / MP4) using the Speech SDK push stream.
 * Suitable for typical call recordings; very long files may hit serverless time limits.
 */
export async function azureTranscribeBuffer(
  apiKey: string,
  region: string,
  buffer: Buffer,
  contentType: string,
  filename: string,
  options: AzureTranscribeOptions
): Promise<string> {
  const speechConfig = sdk.SpeechConfig.fromSubscription(apiKey, region);
  speechConfig.speechRecognitionLanguage = "en-US";
  speechConfig.setProperty(
    sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
    "60000"
  );
  speechConfig.setProperty(
    sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
    "20000"
  );

  const container = pickContainer(contentType, filename);
  const format = sdk.AudioStreamFormat.getCompressedFormat(container);
  const pushStream = sdk.AudioInputStream.createPushStream(format);

  const chunkSize = 64 * 1024;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    pushStream.write(buffer.subarray(i, Math.min(i + chunkSize, buffer.length)));
  }
  pushStream.close();

  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  const parts: string[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      let finished = false;
      let timer: ReturnType<typeof setTimeout>;

      const done = (err?: Error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      };

      timer = setTimeout(() => {
        done(
          new Error(
            "Azure recognition timed out (approaching serverless limit)."
          )
        );
      }, 480_000);

      recognizer.recognized = (_s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
          const text = e.result.text?.trim();
          if (!text) return;
          if (options.includeTimestamps) {
            const ticks = e.result.offset;
            const seconds = ticks / 10_000_000;
            parts.push(`[${formatSeconds(seconds)}] ${text}`);
          } else {
            parts.push(text);
          }
        } else if (e.result.reason === sdk.ResultReason.NoMatch) {
          /* ignore */
        }
      };

      recognizer.canceled = (_s, e) => {
        if (e.reason === sdk.CancellationReason.Error) {
          done(new Error(e.errorDetails || "Azure Speech recognition canceled."));
        }
      };

      recognizer.sessionStopped = () => {
        void recognizer.stopContinuousRecognitionAsync(
          () => done(),
          () => done()
        );
      };

      recognizer.startContinuousRecognitionAsync(
        () => {},
        (err) =>
          done(err ? new Error(String(err)) : new Error("Azure start failed"))
      );
    });
  } finally {
    await recognizer.close().catch(() => undefined);
  }

  const joined = options.includeTimestamps
    ? parts.join("\n\n")
    : parts.join(" ");
  return joined.trim() || "(No speech detected.)";
}
