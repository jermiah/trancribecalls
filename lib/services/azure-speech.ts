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

/**
 * SDK 1.42+ no longer types `getCompressedFormat` / `AudioStreamContainerFormat` on the
 * public entry. We use `getWaveFormat` with `AudioFormatTag.MP3`, which matches how the
 * SDK represents compressed MP3 streams. AAC inside `.mp4` may not work; use Deepgram
 * for those files if Azure fails.
 */
function pickStreamFormat(
  _contentType: string,
  _filename: string
): sdk.AudioStreamFormat {
  return sdk.AudioStreamFormat.getWaveFormat(
    16000,
    16,
    1,
    sdk.AudioFormatTag.MP3
  );
}

function bufferChunkToArrayBuffer(chunk: Buffer): ArrayBuffer {
  return chunk.buffer.slice(
    chunk.byteOffset,
    chunk.byteOffset + chunk.byteLength
  ) as ArrayBuffer;
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

  const format = pickStreamFormat(contentType, filename);
  const pushStream = sdk.AudioInputStream.createPushStream(format);

  const chunkSize = 64 * 1024;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
    pushStream.write(bufferChunkToArrayBuffer(chunk));
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
    try {
      recognizer.close();
    } catch {
      /* ignore dispose errors */
    }
  }

  const joined = options.includeTimestamps
    ? parts.join("\n\n")
    : parts.join(" ");
  return joined.trim() || "(No speech detected.)";
}
