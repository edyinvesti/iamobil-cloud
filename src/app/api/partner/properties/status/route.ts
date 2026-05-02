import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PENDING_FILE = path.join(process.cwd(), "data", "pending_properties.json");
const HISTORY_FILE = path.join(process.cwd(), "data", "processed_properties.json");

function readJsonFile(filePath: string) {
  if (!fs.existsSync(filePath)) return [];
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return []; }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");
    
    if (!idsParam) {
      return NextResponse.json({ success: false, error: "Missing ids parameter" }, { status: 400 });
    }

    const ids = idsParam.split(",");
    const pending = readJsonFile(PENDING_FILE);
    const history = readJsonFile(HISTORY_FILE);

    const statuses: Record<string, string> = {};

    for (const id of ids) {
      const isPending = pending.find((p: any) => p.id === id);
      if (isPending) {
        statuses[id] = "pending";
        continue;
      }

      const isProcessed = history.find((h: any) => h.id === id);
      if (isProcessed) {
        statuses[id] = isProcessed.status; // "approved" or "rejected"
        continue;
      }

      statuses[id] = "unknown";
    }

    return NextResponse.json({ success: true, statuses });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
