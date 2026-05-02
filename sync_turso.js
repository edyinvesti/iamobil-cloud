require('dotenv').config();
const ragEngine = require('./server/rag_engine');

async function syncToCloud() {
    console.log('☁️ Iniciando migração de conhecimento para o Turso DB...');
    try {
        await ragEngine.initVectorDB();
        await ragEngine.syncKnowledgeBase();
        console.log('✅ Migração para a Nuvem concluída com sucesso!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Erro durante a sincronização:', e.message);
        process.exit(1);
    }
}

syncToCloud();
