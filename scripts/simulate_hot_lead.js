const dataEngine = require("../server/data_engine");

async function simulate() {
    console.log("🔥 [Simulation] Gerando lead de alta intenção...");
    
    const hotLead = {
        name: "Dr. Ricardo Silveira",
        phone: "5562988887777",
        interest: "Haras Santa Fé",
        notes: "Urugente! Deseja visita imediata para fechar negócio à vista. Tem interesse em cavalos de raça.",
        potential_value: 12500000,
        status: "Quente"
    };

    const result = await dataEngine.saveLead(hotLead);
    
    if (result.ok) {
        console.log(`✅ [Simulation] Lead salvo com sucesso!`);
        console.log(`⭐ Neuro-Score Calculado: ${result.score}`);
        console.log("CRM Sincronizado. Verifique o arquivo /data/LEADS.md");
    } else {
        console.error("❌ [Simulation] Erro ao salvar lead.");
    }
    
    // Pequeno delay para garantir sincronização
    setTimeout(() => process.exit(0), 1000);
}

simulate();
