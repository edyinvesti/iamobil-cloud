const WebSocket = require('ws');

const url = 'ws://localhost:3000/api/gateway/ws';
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('Connected to Proxy');
  // 1. Connect frame
  ws.send(JSON.stringify({
    type: 'req',
    id: 'probe-connect',
    method: 'connect',
    params: {
      client: { id: 'probe', mode: 'studio' }
    }
  }));
});

ws.on('message', (data) => {
  const frame = JSON.parse(data.toString());
  console.log('Received:', JSON.stringify(frame, null, 2));

  if (frame.id === 'probe-connect' && frame.ok) {
    console.log('Authenticated, requesting agents.list...');
    ws.send(JSON.stringify({
      type: 'req',
      id: 'probe-list',
      method: 'agents.list',
      params: {}
    }));
  }

  if (frame.id === 'probe-list') {
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('WS Error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 10000);
