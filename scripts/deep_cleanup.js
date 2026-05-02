const { spawn } = require('child_process');
const net = require('net');

async function isPortOpen(port) {
    return new Promise((resolve) => {
        const server = net.createServer().on('error', () => resolve(true)).listen(port, () => {
            server.close(() => resolve(false));
        });
    });
}

async function cleanup() {
    console.log("--- IAmobil Deep Cleanup ---");
    
    // Kill all node processes except this one if possible, but taskkill is safer on Windows
    console.log("Killing all node.exe processes...");
    spawn('taskkill', ['/F', '/IM', 'node.exe', '/T'], { shell: true });
    
    await new Promise(r => setTimeout(r, 3000));
    
    const ports = [3000, 5173, 18789];
    for (const port of ports) {
        const open = await isPortOpen(port);
        console.log(`Port ${port}: ${open ? 'STILL BUSY!' : 'CLEAN'}`);
    }
}

cleanup();
