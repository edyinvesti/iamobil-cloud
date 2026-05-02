import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PENDING_FILE = path.join(process.cwd(), "data", "pending_properties.json");
const CATALOG_FILE = path.join(process.cwd(), "assets", "knowledge_base", "CATALOG.md");

function readPending() {
  if (!fs.existsSync(PENDING_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(PENDING_FILE, "utf8")); } catch { return []; }
}

function writePending(data: object[]) {
  fs.mkdirSync(path.dirname(PENDING_FILE), { recursive: true });
  fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2), "utf8");
}

const HISTORY_FILE = path.join(process.cwd(), "data", "processed_properties.json");

function readHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8")); } catch { return []; }
}

function updateHistory(id: string, status: "approved" | "rejected") {
  const history = readHistory();
  const existingId = history.findIndex((h: any) => h.id === id);
  if (existingId > -1) {
    history[existingId].status = status;
    history[existingId].updatedAt = Date.now();
  } else {
    history.push({ id, status, updatedAt: Date.now() });
  }
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
}

// GET — listar imóveis pendentes
export async function GET() {
  return NextResponse.json({ pending: readPending() });
}

// PATCH — aprovar ou rejeitar um imóvel
export async function PATCH(req: Request) {
  try {
    const { id, action } = await req.json(); // action: 'approve' | 'reject'
    const pending = readPending();
    const idx = pending.findIndex((p: any) => p.id === id);
    if (idx === -1) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const property = pending[idx] as any;
    pending.splice(idx, 1);
    writePending(pending);

    if (action === "approve") {
      const entry = `
---

## 💎 ${property.title}
- **📍 Localização:** ${property.address}
- **💰 Valor:** R$ ${Number(property.price || 0).toLocaleString("pt-BR")}
- **📐 Área:** ${property.size || property.area || "0"} ${property.sizeUnit || 'm²'}
- **🛏️ Quartos:** ${property.bedrooms || property.rooms || "0"} quartos (${property.suites || "0"} suítes)
- **✨ Diferencial:** ${property.aiDescription || property.description || "Imóvel de alto padrão."}
- **🖼️ Imagens:** ${property.images && property.images.length > 0 ? property.images.join(', ') : (property.imagePath || "/properties/mansion.png")}
`;
      fs.appendFileSync(CATALOG_FILE, Buffer.from(entry, "utf8"));
      updateHistory(id, "approved");
      return NextResponse.json({ success: true, message: "Imóvel aprovado e publicado no catálogo!" });
    }

    updateHistory(id, "rejected");
    return NextResponse.json({ success: true, message: "Imóvel rejeitado e removido da fila." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
