const WebSocket = require('ws');

async function testDragonFlow() {
    console.log("--- Starting Dragon Flow Verification ---");
    const ws = new WebSocket('ws://127.0.0.1:18789');

    ws.on('open', () => {
        console.log("Connected to Gateway Adapter.");
        const request = {
            type: "user_message",
            agentId: "hermes",
            text: "Edy, peça ao Dragon para me mandar um print do dashboard de vendas agora."
        };
        ws.send(JSON.stringify(request));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "agent_response") {
            const content = msg.text || "";
            console.log(`[Response] Agent: ${msg.agentId} | Text: ${content.substring(0, 50)}...`);
            if (content.includes("[TELEGRAM_IMAGE]")) {
                console.log("✅ SUCCESS: Found TELEGRAM_IMAGE tag in response!");
                process.exit(0);
            }
        }
        if (msg.type === "tool_call") {
             console.log(`[ToolCall] Calling: ${msg.name} with args: ${JSON.stringify(msg.args)}`);
        }
        if (msg.type === "tool_result") {
             console.log(`[ToolResult] Result: ${msg.result.substring(0, 100)}...`);
        }
    });

    // Timeout after 60 seconds
    setTimeout(() => {
        console.error("❌ TIMEOUT: Dragon did not respond with an image tag within 60s.");
        process.exit(1);
    }, 60000);
}

testDragonFlow();
