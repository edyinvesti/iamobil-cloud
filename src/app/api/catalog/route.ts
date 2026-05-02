import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const catalogPath = path.join(process.cwd(), "assets", "knowledge_base", "CATALOG.md");
  if (!fs.existsSync(catalogPath)) {
    return NextResponse.json({ properties: [] });
  }

  const content = fs.readFileSync(catalogPath, "utf8");
  const sections = content.split("---").filter(s => s.trim() && !s.includes("# 🏠"));
  
  const properties = sections.map((section, idx) => {
    const lines = section.trim().split("\n");
    const name = lines[0].replace("## ", "").replace("💎 ", "").replace("🏰 ", "").replace("🎨 ", "").trim();
    
    const getData = (prefix: string) => {
      const line = lines.find(l => l.includes(prefix));
      return line ? line.split(prefix)[1].trim() : "";
    };

    const rawImage = getData("🖼️ Imagens:**") || getData("🖼️ Imagem:**");
    const firstImage = rawImage.split(',')[0].replace(/[`]/g, "").trim();

    return {
      id: `prop_${idx}`,
      name,
      location: getData("📍 Localização:**"),
      price: getData("💰 Valor:**"),
      area: getData("📐 Área:**"),
      rooms: getData("🛏️ Quartos:**"),
      highlight: getData("✨ Diferencial:**"),
      image: firstImage,
    };
  });

  return NextResponse.json({ properties });
}
