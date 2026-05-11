import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const net = require("node:net");
  const fs = require("node:fs");
  const path = require("node:path");

  const hermesStatus = await new Promise((resolve) => {
    const socket = net.createConnection(18789, "127.0.0.1");
    socket.on("connect", () => { socket.destroy(); resolve("online ✅"); });
    socket.on("error", (e: any) => { resolve(`offline ❌ (${e.message})`); });
    setTimeout(() => { socket.destroy(); resolve("timeout ⏳"); }, 1500);
  });

  const logFile = path.join(process.cwd(), "logs/adapter_debug.log");
  let lastLogs = "Log file not found";
  try {
    if (fs.existsSync(logFile)) {
      lastLogs = fs.readFileSync(logFile, "utf8").split("\n").slice(-50).join("\n");
    }
  } catch (e) {}

  return NextResponse.json({
    status: "IAmobil Diagnostics (App Router)",
    gateway: {
      port: 18789,
      status: hermesStatus
    },
    logs_preview: lastLogs,
    env: {
      RENDER: process.env.RENDER || "false",
      HOSTNAME: process.env.HOSTNAME || "unknown"
    },
    timestamp: new Date().toISOString()
  });
}
