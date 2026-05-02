require('dotenv').config();
const axios = require('axios');

async function testElevenLabs() {
    console.log("Variáveis:", {
        key: process.env.ELEVENLABS_API_KEY ? "Existe" : "Ausente",
        voice: process.env.ELEVENLABS_VOICE_ID
    });
    
    try {
        const response = await axios({
            method: 'POST',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
            headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            data: {
                text: "Teste de voz para confirmar se está funcionando",
                model_id: "eleven_flash_v2_5",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            },
            responseType: 'arraybuffer'
        });
        console.log("✅ Gerado com sucesso!", response.data.byteLength, "bytes");
    } catch (e) {
        console.error("❌ ERRO na API do ElevenLabs:");
        console.error(e.response ? e.response.data : e.message);
        if (e.response && e.response.data instanceof Buffer) {
             console.error("Mensagem real do buffer:", e.response.data.toString());
        }
    }
}
testElevenLabs();
