import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { NodeGatewayClient } from "@/lib/gateway/nodeGatewayClient";


const dataEngine = require("../../../../../server/data_engine");

// As notificações agora são governadas pelo Agente via eventos do Gateway.
// O Hub de Mensageria cuidará da entrega baseada em eventos 'notification'.


// Bloco 4: Notificação Automática para o Corretor Parceiro
async function notifyBrokerTelegram(property: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const brokerChatId = property.brokerTelegramId; // ID no Telegram do corretor
  
  if (!token || !brokerChatId) return; // Só avisa se o parceiro tiver o ID no payload

  const brokerNameFirst = property.brokerName ? property.brokerName.split(' ')[0] : "Parceiro(a)";

  const msg = 
    `Olá, *${brokerNameFirst}*! 👋 Aqui é a Inteligência da IAmobil.\n\n` +
    `Acabei de receber e cadastrar sua captação do imóvel *"${property.title || "novo Imóvel"}"*.\n\n` +
    `Já fiz uma curadoria na ficha técnica, estruturei a formatação e nossa plataforma já está apta para exibi-la publicamente.\n\n` +
    `Nós vamos acompanhando por aqui, qualquer lead interessado eu direciono a comissão pra você! 🎉`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: brokerChatId, text: msg, parse_mode: "Markdown" }),
    });

    if (res.ok) {
      console.log(`[API] Notificação Telegram (B2B Corretor ${brokerNameFirst}) enviada com sucesso!`);
    } else {
      console.warn(`[API] Falha ao notificar o corretor no Telegram:`, await res.text());
    }
  } catch (err: any) {
    console.error("[API] Erro ao disparar mensagem para o corretor:", err.message);
  }
}

// Endpoint para receber imóvel do Gestor Imobiliário
export async function POST(req: Request) {
  try {
    console.log("--- NOVO HANDSHAKE RECEBIDO (PORTA 3000) ---");
    const data = await req.json();
    console.log("Imóvel detectado:", data.title || "Sem título");

    // 1. Processamento e Salvamento de Imagens
    const savedImages: string[] = [];
    const imagesToProcess = data.images || (data.image ? [data.image] : (data.imageUrl ? [data.imageUrl] : []));
    
    if (imagesToProcess.length > 0) {
      const propertiesDir = path.join(process.cwd(), "public", "properties");
      fs.mkdirSync(propertiesDir, { recursive: true });

      imagesToProcess.forEach((rawImage: string, index: number) => {
        if (rawImage && rawImage.startsWith("data:image")) {
          const ext = rawImage.includes("data:image/png") ? "png" : "jpg";
          const base64Data = rawImage.split(",")[1];
          const fileName = `prop_${Date.now()}_${index}.${ext}`;
          fs.writeFileSync(path.join(propertiesDir, fileName), Buffer.from(base64Data, "base64"));
          savedImages.push(`/properties/${fileName}`);
        } else if (rawImage && (rawImage.startsWith("http") || rawImage.startsWith("/"))) {
          savedImages.push(rawImage);
        }
      });
    }
    
    const imagePath = savedImages.length > 0 ? savedImages[0] : "/properties/mansion.png";
    console.log(`Imagens salvas (${savedImages.length}):`, savedImages);

    // 2. Delegar para o Gateway (Maria/Agente) para avaliação e notificações
    const aiDescription = "Oportunidade selecionada pela curadoria iAmobil. Em análise pela nossa IA...";
    
    try {
      const gatewayUrl = process.env.HERMES_WS_URL || "ws://127.0.0.1:18789";
      const client = new NodeGatewayClient();
      await client.connect({ gatewayUrl, token: process.env.STUDIO_ACCESS_TOKEN });
      
      const agentTask = `🚨 NOVO IMÓVEL PARA CURADORIA:\n${JSON.stringify({ ...data, images: undefined, image: undefined, imagePath })}\n\nPor favor, Maria: gere uma descrição curta e luxuosa para este imóvel e notifique o CEO via canal de alertas.`;
      
      await client.request("chat.send", {
        sessionKey: "agent:maria:curadoria",
        message: agentTask
      });
      
      client.close();
      console.log("[API] Imóvel enviado para o Gateway com sucesso.");
    } catch (err: any) {
      console.warn("[API] Falha ao enviar para o Gateway (Usando Fallback Local):", err.message);
    }

    // 3. Salvar no Turso DB (Cloud)
    const newProperty = {
      id: `prop_${Date.now()}`,
      receivedAt: new Date().toISOString(),
      status: "pending",
      imagePath,
      images: savedImages,
      aiDescription,
      ...data,
    };
    
    await dataEngine.savePartnerProperty(newProperty);
    console.log("Imóvel salvo no Turso DB:", newProperty.id);

    // 4. Feedback pro Corretor Parceiro
    await notifyBrokerTelegram(newProperty);

    return NextResponse.json({
      success: true,
      message: "Imóvel recebido e encaminhado ao Gateway para curadoria estratégica.",
      propertyId: newProperty.id,
    });
  } catch (error: any) {
    console.error("Error processing property API:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

