const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:18789');

ws.on('open', () => {
    console.log('Connected to Hermes Adapter');
    
    // Mandar para o orquestrador principal que já funciona
    const payload = {
        type: "req",
        id: "test-draft-doc",
        method: "chat.send",
        params: {
            sessionKey: "agent:hermes:main",
            message: "Maria, por favor usa a ferramenta draft_document para criar um arquivo chamado 'contrato_joao_silva.md' com uma minuta simples de compra e venda de um imóvel no valor de R$ 5.000.000 para o cliente João Silva. O imóvel é a Penthouse Leblon.",
            idempotencyKey: "test-draft-" + Date.now()
        }
    };
    
    ws.send(JSON.stringify(payload));
    console.log('Comando enviado! Aguardando resposta...');
});

ws.on('message', (data) => {
    const frame = JSON.parse(data);
    if (frame.type === 'event' && frame.event === 'chat') {
        if (frame.payload.state === 'final') {
            console.log('\n--- Resposta Final ---');
            console.log(frame.payload.message?.content || '(vazia)');
            ws.close();
            process.exit(0);
        }
    }
});

ws.on('error', (err) => {
    console.error('WS Error:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.log('Timeout de 60s atingido');
    ws.close();
    process.exit(0);
}, 60000);
