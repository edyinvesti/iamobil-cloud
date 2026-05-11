import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const net = require("node:net");
  const hermesStatus = await new Promise((resolve) => {
    const socket = net.createConnection(18789, "127.0.0.1");
    socket.on("connect", () => {
      socket.destroy();
      resolve("online ✅");
    });
    socket.on("error", (e: any) => {
      resolve(`offline ❌ (${e.message})`);
    });
    setTimeout(() => {
      socket.destroy();
      resolve("timeout ⏳");
    }, 1000);
  });

  return NextResponse.json(
    {
      ok: true,
      service: "IAmobil Cloud",
      gateway: {
        status: hermesStatus,
        port: 18789
      },
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
