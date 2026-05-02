const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:18789');

ws.on('open', () => {
    console.log('🔗 Conectado ao Adaptador para Teste...');
    
    const testMsg = {
        method: 'sessions.chat',
        params: {
            agentId: 'edy',
            userMessage: 'Olá Edy, estou procurando um imóvel de luxo em Goiânia, preferencialmente no Setor Marista, até uns 6 milhões. O que você tem?'
        },
        id: 'test-123'
    };

    ws.send(JSON.stringify(testMsg));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'event' && msg.payload && msg.payload.state === 'delta') {
        process.stdout.write(msg.payload.message.content || '');
    }
    if (msg.type === 'res' && msg.id === 'test-123') {
        console.log('\n\n✅ Teste Concluído!');
        ws.close();
    }
});

ws.on('error', (err) => {
    console.error('❌ Erro no teste:', err.message);
});
