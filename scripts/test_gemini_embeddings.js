const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Mocking the environment and minimal class for testing
process.env.GEMINI_API_KEY = "AIzaSyCros5trvHUqR4j_c1gbASfoqvU5UYld9o";

async function testGemini() {
    const geminiKey = process.env.GEMINI_API_KEY;
    const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001";
    const input = ["Olá, isto é um teste do iAmobil.", "Segunda linha de teste."];
    
    try {
        console.log("Testing individual embedding...");
        const responseSingular = await axios.post(`${baseUrl}:embedContent?key=${geminiKey}`, {
            content: { parts: [{ text: input[0] }] }
        });
        console.log("✅ Singular success. Vector length:", responseSingular.data.embedding.values.length);

        console.log("Testing batch embedding...");
        const requests = input.map(text => ({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text }] }
        }));
        const responseBatch = await axios.post(`${baseUrl}:batchEmbedContents?key=${geminiKey}`, { requests });
        console.log("✅ Batch success. Embeddings counted:", responseBatch.data.embeddings.length);
        
    } catch (e) {
        console.error("❌ Test failed:", e.response?.data || e.message);
    }
}

testGemini();
