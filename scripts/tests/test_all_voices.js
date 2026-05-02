require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const configs = [
    { name: "Edy", key: process.env.MINIMAX_API_KEY, voice: process.env.MINIMAX_VOICE_ID },
    { name: "Maria", key: process.env.MINIMAX_API_KEY_MARIA, voice: "moss_audio_6a681ad7-3b70-11f1-b47e-928b88df9451" },
    { name: "Kaua", key: process.env.MINIMAX_API_KEY_KAUA, voice: "moss_audio_7772b484-3b74-11f1-9c2f-8aa028884dc1" },
    { name: "Pique", key: process.env.MINIMAX_API_KEY_PIQUE, voice: "moss_audio_1732e1d5-3b72-11f1-a035-7a6ab187e53d" },
];

async function generate() {
    console.log("Iniciando testes de voz...");
    for (const c of configs) {
        if (!c.key || !c.voice) { 
            console.log(`⚠️ Pulando ${c.name} - Chave ou ID ausente.`); 
            continue; 
        }
        try {
            const res = await axios.post('https://api.minimax.io/v1/t2a_v2', {
                model: "speech-02-hd",
                text: `Olá! Eu sou o ${c.name} e este é o meu áudio de teste gerado pela inteligência artificial.`,
                stream: false,
                voice_setting: { voice_id: c.voice, speed: 1.0, vol: 1.0, pitch: 0 },
                audio_setting: { format: "mp3", sample_rate: 32000 }
            }, { 
                headers: { 'Authorization': `Bearer ${c.key}`, 'Content-Type': 'application/json' }, 
                responseType: 'arraybuffer' 
            });
            fs.writeFileSync(`teste_voz_${c.name.toLowerCase()}.mp3`, Buffer.from(res.data));
            console.log(`✅ ${c.name}: Arquivo 'teste_voz_${c.name.toLowerCase()}.mp3' salvo com sucesso!`);
        } catch (e) {
            console.log(`❌ ${c.name} Falhou:`);
            if (e.response && e.response.data instanceof Buffer) {
                console.log("   ", e.response.data.toString());
            } else {
                console.log("   ", e.message);
            }
        }
    }
    console.log("Testes finalizados.");
}
generate();
