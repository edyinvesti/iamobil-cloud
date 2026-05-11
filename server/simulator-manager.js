const { spawn } = require("node:child_process");
const path = require("node:path");

let simulatorProcess = null;

function startSimulator(options = {}) {
  if (simulatorProcess) {
    return { ok: true, alreadyRunning: true };
  }

  const port = options.port || 18789;
  const scriptPath = path.join(__dirname, "demo-gateway-adapter.js");

  console.info(`[Simulador] Iniciando gateway de demonstração na porta ${port}...`);

  simulatorProcess = spawn("node", [scriptPath], {
    env: {
      ...process.env,
      DEMO_ADAPTER_PORT: port.toString(),
    },
    stdio: "inherit",
  });

  simulatorProcess.on("close", (code) => {
    console.info(`[Simulador] Processo encerrado com código ${code}`);
    simulatorProcess = null;
  });

  simulatorProcess.on("error", (err) => {
    console.error("[Simulador] Falha ao iniciar:", err);
    simulatorProcess = null;
  });

  return { ok: true, port };
}

function stopSimulator() {
  if (!simulatorProcess) {
    return { ok: true, notRunning: true };
  }

  console.info("[Simulador] Parando simulador...");
  simulatorProcess.kill();
  simulatorProcess = null;
  return { ok: true };
}

function getSimulatorStatus() {
  return {
    running: !!simulatorProcess,
    port: simulatorProcess ? 18789 : null, // Default port used in startSimulator if not specified
  };
}

module.exports = {
  startSimulator,
  stopSimulator,
  getSimulatorStatus,
};
