const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Carregar variáveis de ambiente se necessário
require('dotenv').config();

/**
 * Radar Engine - Analisa o Obsidian Vault e o GOLD_MEMORY para gerar tendências.
 */

const VAULT_PATH = path.join(process.env.USERPROFILE || process.env.HOME, "Downloads", "IAmobil_Vault", "IAmobil_Vault");
const GOLD_MEMORY_PATH = path.join(process.cwd(), "GOLD_MEMORY.md");
const OUTPUT_PATH = path.join(process.cwd(), "public", "radar_data.json");
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.HERMES_API_KEY;

async function analyzeTrends() {
  console.log("🔍 [Radar-Engine] Iniciando análise de tendências de mercado...");

  let context = "";

  // 1. Ler Gold Memory
  if (fs.existsSync(GOLD_MEMORY_PATH)) {
    context += "### GOLD MEMORY\n" + fs.readFileSync(GOLD_MEMORY_PATH, "utf8") + "\n\n";
  }

  // 2. Scanear Pastas do Vault
  const folders = ["01_Leads", "02_Imoveis"];
  for (const folder of folders) {
    const p = path.join(VAULT_PATH, folder);
    if (fs.existsSync(p)) {
      const files = fs.readdirSync(p).filter(f => f.endsWith(".md"));
      context += `### PASTA: ${folder} (${files.length} arquivos)\n`;
      // Ler apenas os títulos e os primeiros 100 caracteres dos últimos 10 arquivos para poupar token
      files.slice(-10).forEach(f => {
        context += `- ${f}\n`;
      });
    }
  }

  // Usar endpoint do adaptador ou local direto
  const API_URL = (process.env.HERMES_API_URL || "http://localhost:11434").replace(/\/$/, "") + "/v1/chat/completions";
  const MODEL = "llama-3.1-8b-instant";


  try {
    const prompt = `Analise os dados da imobiliária abaixo e gere um JSON com as tendências de mercado e alertas de concorrência.
    DADOS:
    ${context}
    
    RESPONDA APENAS UM JSON NO SEGUINTE FORMATO (Sem markdown tags):
    {
      "top_regions": [{"name": "Bairro", "score": 85}, ...],
      "property_types": [{"type": "Tipo", "percentage": 60}, ...],
      "active_profiles": ["Perfil 1", "Perfil 2"],
      "market_vibe": "Uma frase curta sobre o momento do mercado",
      "competition_alerts": [
        {"title": "Alerta de Preço", "neighborhood": "Bairro", "threat": "Alta/Média", "suggestion": "Ação recomendada"}
      ],
      "last_update": "Data formatada"
    }
    Se não houver dados suficientes, invente dados realistas e competitivos baseados em Goiânia (Setor Bueno, Marista, Alphaville) para demonstração de inteligência comercial.`;

    const response = await axios.post(API_URL, {
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }, {
      headers: { "Authorization": `Bearer ${process.env.HERMES_API_KEY || "ollama"}` }
    });

    let content = response.data.choices[0].message.content.trim();
    
    // Tentar extrair o bloco JSON se houver texto ao redor
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error("Nenhum JSON encontrado na resposta da IA.");
    }
    
    let jsonStr = match[0];
    const radarData = JSON.parse(jsonStr);
    radarData.last_update = new Date().toLocaleString("pt-BR");

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(radarData, null, 2), "utf8");
    console.log("✅ [Radar-Engine] Dados do Radar iAmobil atualizados em: " + OUTPUT_PATH);

  } catch (err) {
    console.error("❌ [Radar-Engine] Erro na análise:", err.message);
  }
}

// Iniciar e agendar a cada 1 hora
function start() {
  analyzeTrends();
  setInterval(analyzeTrends, 1000 * 60 * 60);
}

module.exports = { start, analyzeTrends };
