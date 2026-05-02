const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:18789');

ws.on('open', () => {
    const testMsg = {
        method: 'chat.send', // Corrigido de sessions.chat
        params: {
            sessionKey: 'agent:edy:session-test',
            message: 'Oi, gostaria de um imóvel no Setor Marista até 6 milhões, o que você tem de melhor?'
        },
        id: 'user-test-live'
    };
    ws.send(JSON.stringify(testMsg));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    // Captura o evento de chat state delta ou final
    if (msg.type === 'event' && msg.event === 'chat' && msg.payload.state === 'final') {
        console.log('\n--- RESPOSTA DO EDY ---\n');
        console.log(msg.payload.message.content);
        console.log('\n-----------------------\n');
        ws.close();
    }
});

ws.on('error', (err) => console.error('Erro:', err.message));
