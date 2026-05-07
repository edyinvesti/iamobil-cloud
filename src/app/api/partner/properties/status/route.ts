import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const dataEngine = require("../../../../../../server/data_engine");

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");
    
    if (!idsParam) {
      return NextResponse.json({ success: false, error: "Missing ids parameter" }, { status: 400 });
    }

    const ids = idsParam.split(",");
    const statuses: Record<string, string> = {};

    for (const id of ids) {
      statuses[id] = await dataEngine.getPropertyStatus(id);
    }

    return NextResponse.json({ success: true, statuses });

    return NextResponse.json({ success: true, statuses });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
