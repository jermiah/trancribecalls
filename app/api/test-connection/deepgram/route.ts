import { deepgramTestConnection } from "@/lib/services/deepgram";
import { assertDeepgramKey, parseCredentialsFromRequest } from "@/lib/server/request-credentials";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const c = parseCredentialsFromRequest(request, "deepgram");
    const key = assertDeepgramKey(c);
    await deepgramTestConnection(key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Connection test failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
