require('dotenv').config();
const ragEngine = require('./server/rag_engine');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');


async function testRag() {
    console.log('🧪 Iniciando teste de RAG Híbrido...');
    
    // 1. Verificar se o banco existe
    const dbPath = path.join(__dirname, 'data', 'iamobil.db');
    if (!fs.existsSync(dbPath)) {
        console.error(`❌ Banco de dados não encontrado em ${dbPath}.`);
        console.log('Tentando injetar docs para popular o banco...');
        await ragEngine.syncKnowledgeBase();
    }

    console.log('🔍 Testando busca por palavra-chave: "IAmobil"');
    const start = Date.now();
    const result = await ragEngine.searchKnowledge('O que é o iAmobil e como ele funciona?');
    const end = Date.now();

    console.log(`⏱️ Tempo de resposta: ${end - start}ms`);
    if (result) {
        console.log('✅ Resultado encontrado:\n', result.substring(0, 200) + '...');
    } else {
        console.log('⚠️ Nenhum resultado encontrado (pode ser normal se a base estiver vazia).');
    }

    console.log('\n🔍 Testando busca sem palavras-chave óbvias (fallback): "Qual a missão?"');
    const start2 = Date.now();
    const result2 = await ragEngine.searchKnowledge('Qual a missão?');
    const end2 = Date.now();
    console.log(`⏱️ Tempo de resposta (fallback): ${end2 - start2}ms`);
    
    console.log('\n✅ Teste concluído!');
}

testRag().catch(console.error);
