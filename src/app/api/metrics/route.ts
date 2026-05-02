import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PENDING_FILE = path.join(process.cwd(), "data", "pending_properties.json");
const CATALOG_FILE = path.join(process.cwd(), "assets", "knowledge_base", "CATALOG.md");

export async function GET() {
  // Contagem de imóveis publicados
  let published = 0;
  if (fs.existsSync(CATALOG_FILE)) {
    const content = fs.readFileSync(CATALOG_FILE, "utf8");
    published = content.split("---").filter((s) => s.trim() && s.includes("R$")).length;
  }

  // Contagem de pendentes
  let pending = 0;
  let totalValuePending = 0;
  let pendingList: any[] = [];
  if (fs.existsSync(PENDING_FILE)) {
    try {
      pendingList = JSON.parse(fs.readFileSync(PENDING_FILE, "utf8"));
      pending = pendingList.length;
      totalValuePending = pendingList.reduce((acc: number, p: any) => acc + Number(p.price || 0), 0);
    } catch { /* noop */ }
  }

  // Recentes (últimos 5 da fila)
  const recent = pendingList.slice(-5).reverse().map((p: any) => ({
    id: p.id,
    title: p.title,
    address: p.address,
    price: p.price,
    receivedAt: p.receivedAt,
  }));

  return NextResponse.json({
    published,
    pending,
    totalValuePending,
    total: published + pending,
    recent,
  });
}
