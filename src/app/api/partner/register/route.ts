import { NextResponse } from "next/server";
const dataEngine = require("../../../../../server/data_engine");

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    if (!data.creci) {
        return NextResponse.json({ ok: false, error: "CRECI é obrigatório para o registro." }, { status: 400 });
    }

    const result = await dataEngine.saveBroker(data);
    
    if (result.ok) {
        console.log(`[API] Gestor registrado/atualizado: ${data.name} (${data.creci})`);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API] Erro no registro de gestor:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
    try {
        const brokers = await dataEngine.getBrokers();
        return NextResponse.json({ brokers });
    } catch (error: any) {
        return NextResponse.json({ brokers: [], error: error.message }, { status: 500 });
    }
}
