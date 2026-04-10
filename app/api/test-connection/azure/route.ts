import { azureTestConnection } from "@/lib/services/azure-speech";
import { assertAzureCreds, parseCredentialsFromRequest } from "@/lib/server/request-credentials";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const c = parseCredentialsFromRequest(request, "azure");
    const { key, region } = assertAzureCreds(c);
    await azureTestConnection(key, region);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Connection test failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
