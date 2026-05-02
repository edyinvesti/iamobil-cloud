import { NextResponse } from "next/server";
const WebSocket = require('ws');

export async function POST(req: Request) {
  try {
    const { action, leadName, leadPhone } = await req.json();
    
    return new Promise((resolve) => {
      const ws = new WebSocket("ws://127.0.0.1:18789");
      
      let resolved = false;

      ws.on("open", () => {
        // 1. Authenticate
        ws.send(JSON.stringify({
          type: "req",
          id: "auth-web-" + Date.now(),
          method: "connect",
          params: {}
        }));
      });

      ws.on("message", (raw: string) => {
        const frame = JSON.parse(raw);
        
        if (frame.type === "res" && frame.payload && frame.payload.type === "hello-ok") {
          // 2. Send CEO Command to Orchestrator
          let message = "";
          if (action === "pressionar") {
            message = `🚨 [COMANDO VVIP DO CEO] O CEO acabou de ordenar via Dashboard: Avise o corretor Pique para PRESSIONAR IMEDIATAMENTE o lead "${leadName}" (${leadPhone}) e tentar um fechamento a vista. Pique deve enviar uma mensagem incisiva via Telegram.`;
          } else if (action === "resumir") {
            message = `🚨 [COMANDO VVIP DO CEO] O CEO solicitou no Dashboard um resumo do status do lead "${leadName}". Peça para a equipe de CRM vasculhar a memória sobre este lead e gere um resumo corporativo.`;
          }

          ws.send(JSON.stringify({
            type: "req",
            id: "chat-" + Date.now(),
            method: "chat.send",
            params: {
              sessionKey: "session_main",
              message: message
            }
          }));
        }

        if (frame.type === "res" && frame.id.startsWith("chat-")) {
          // Message started processing
          if (!resolved) {
            resolved = true;
            ws.close();
            resolve(NextResponse.json({ ok: true }));
          }
        }
      });

      ws.on("error", () => {
        if (!resolved) {
          resolved = true;
          resolve(NextResponse.json({ ok: false, error: "Falha ao conectar ao Hermes" }));
        }
      });
      
      // Timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          resolve(NextResponse.json({ ok: false, error: "Timeout timeout" }));
        }
      }, 5000);
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Server Error" });
  }
}
