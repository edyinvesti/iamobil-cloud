/* eslint-disable @typescript-eslint/no-require-imports */
const WebSocket = require('ws');
require('dotenv').config();
const ragEngine = require('./server/rag_engine');

const ws = new WebSocket('ws://127.0.0.1:18789');
let step = 1;

ws.on('open', async () => {
    ws.send(JSON.stringify({ type: "req", id: "auth", method: "connect", params: {} }));
});

ws.on('message', async (raw) => {
    const frame = JSON.parse(raw);
    
    // Handshake
    if (frame.type === 'res' && frame.payload?.type === 'hello-ok') {
        console.log("🔌 Conectado ao Central Hub!");
        const msg1 = "olá, vi aquele apartamento no setor Bueno. qual o preço pra fechar a vista hoje? Me passa só o valor e a gente conversa se compensar";
        console.log(`\n💬 [CLIENTE - MENSAGEM 1]: ${msg1}`);
        
        // Use the exported instance directly
        const ragContext = await ragEngine.searchKnowledge(msg1);
        
        let finalMessage = ragContext ? `[INSTRUÇÃO DE MERCADO / TÉCNICA RAG A SEGUIR]:\n${ragContext}\n\n[MENSAGEM DO CLIENTE ABAIXO]:\n${msg1}` : msg1;
        ws.send(JSON.stringify({
            type: "req", id: `req-${Date.now()}`, method: "chat.send",
            params: { sessionKey: "agent:hermes:testbot", message: finalMessage, idempotencyKey: "test_" + Date.now() }
        }));
    }
    
    // Catch response
    if (frame.type === 'event' && frame.event === 'chat' && frame.payload.state === 'final') {
        let ans = frame.payload.message.content;
        ans = ans.replace(/<function[\s\S]*?<\/function>/gi, "").trim();
        
        console.log(`\n🤖 [RESPOSTA DA IA]: ${ans}`);
        
        if (step === 1) {
            step = 2;
            const msg2 = "entendi, mas sabe o que é, eu quero pesquisar mais, e além disso vou falar com a minha esposa primeiro antes de decidir qualquer coisa ou marcar visita.";
            console.log(`\n💬 [CLIENTE - MENSAGEM 2]: ${msg2}`);
            
            const ragContext2 = await ragEngine.searchKnowledge(msg2);
            
            let finalMessage2 = ragContext2 ? `[INSTRUÇÃO DE MERCADO / TÉCNICA RAG A SEGUIR]:\n${ragContext2}\n\n[MENSAGEM DO CLIENTE ABAIXO]:\n${msg2}` : msg2;
            ws.send(JSON.stringify({
                type: "req", id: `req-${Date.now()}`, method: "chat.send",
                params: { sessionKey: "agent:hermes:testbot", message: finalMessage2, idempotencyKey: "test2_" + Date.now() }
            }));
        } else {
            console.log("\n✅ Teste Concluído.");
            process.exit(0);
        }
    }
});

ws.on('error', (err) => console.log('WS Erro:', err.message));
