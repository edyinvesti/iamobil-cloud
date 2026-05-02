const WebSocket = require('ws');

const url = 'ws://localhost:18789';
const ws = new WebSocket(url);

ws.on('open', () => {
    console.log('Connected to adapter');
    
    // 1. Connect handshake
    ws.send(JSON.stringify({
        type: 'req',
        id: '1',
        method: 'connect',
        params: {}
    }));
});

ws.on('message', (data) => {
    const frame = JSON.parse(data.toString());
    console.log('Received frame:', JSON.stringify(frame, null, 2));

    if (frame.id === '1' && frame.ok) {
        console.log('Handshake successful. Requesting agents.list...');
        ws.send(JSON.stringify({
            type: 'req',
            id: '2',
            method: 'agents.list',
            params: {}
        }));
    } else if (frame.id === '2') {
        console.log('Agents list received.');
        ws.close();
    }
});

ws.on('error', (err) => {
    console.error('WS Error:', err);
});

ws.on('close', () => {
    console.log('Connection closed');
});
