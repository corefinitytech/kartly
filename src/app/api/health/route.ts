import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    data: { status: "ok", service: "kartly", time: new Date().toISOString() },
  });
}
