const path = require("node:path");
const fs = require("node:fs");

const HOME = process.env.HOME || process.env.USERPROFILE || ".";
const REGISTRY_PATH = path.join(HOME, ".hermes", "clawd3d-registry.json");

console.log("HOME:", HOME);
console.log("REGISTRY_PATH:", REGISTRY_PATH);
console.log("REGISTRY EXISTS:", fs.existsSync(REGISTRY_PATH));

if (fs.existsSync(REGISTRY_PATH)) {
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
    console.log("REGISTRY AGENTS COUNT:", Object.keys(data).length);
    console.log("AGENTS:", Object.keys(data));
}

const agentsDir = path.join(process.cwd(), "agents");
console.log("AGENTS DIR:", agentsDir);
if (fs.existsSync(agentsDir)) {
    const folders = fs.readdirSync(agentsDir).filter(f => fs.statSync(path.join(agentsDir, f)).isDirectory());
    console.log("AUTO-DISCOVERED FOLDERS:", folders);
}
