import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { z } from "zod";
const dataEngine = require("../../../../server/data_engine");

const deleteLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required")
});

export async function GET() {
  try {
    const leads = await dataEngine.getLeads();
    
    // Calcular VGV real cruzando com o catálogo
    const catalogPath = path.join(process.cwd(), "assets", "knowledge_base", "CATALOG.md");
    const catalogContent = fs.existsSync(catalogPath) ? fs.readFileSync(catalogPath, "utf8") : "";
    const propertyPrices: Record<string, number> = {};
    const propertySections = catalogContent.split("---");
    
    propertySections.forEach(s => {
      const titleMatch = s.match(/## (.*)/);
      const priceMatch = s.match(/💰 Valor:\*\* R\$ (.*)/) || s.match(/R\$ ([\d\.]+)/);
      if (titleMatch && priceMatch) {
        propertyPrices[titleMatch[1].trim()] = parseInt(priceMatch[1].replace(/\./g, ""));
      }
    });

    let totalVgv = 0;
    leads.forEach((l: any) => {
      // Priorizar o valor potencial gravado no banco, fallback pro catálogo
      totalVgv += l.potential_value || propertyPrices[l.interest] || 0;
    });
    
    return NextResponse.json({ 
      leads,
      stats: {
        totalVgv,
        count: leads.length,
        averageTicket: leads.length > 0 ? Math.floor(totalVgv / leads.length) : 0
      }
    });
  } catch (err) {
    return NextResponse.json({ leads: [], stats: { totalVgv: 0, count: 0 } });
  }
}

export async function DELETE(req: Request) {
  try {
    const rawBody = await req.json();
    const result = deleteLeadSchema.safeParse(rawBody);
    
    if (!result.success) {
      return NextResponse.json({ ok: false, error: "Invalid payload: " + result.error.issues.map((e: any) => e.message).join(", ") }, { status: 400 });
    }

    const { name, phone } = result.data;
    const ok = await dataEngine.deleteLead(name, phone);
    return NextResponse.json({ ok });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Internal processing error." }, { status: 500 });
  }
}
