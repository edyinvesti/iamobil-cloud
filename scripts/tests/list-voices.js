require('dotenv').config();
const axios = require('axios');

async function listVoices() {
    try {
        const response = await axios({
            method: 'GET',
            url: `https://api.elevenlabs.io/v1/voices`,
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY
            }
        });
        const voices = response.data.voices;
        const maleVoices = voices.filter(v => v.labels?.gender === 'male');
        if (maleVoices.length > 0) {
            console.log("SUCESSO_VOZ_MASCULINA:", maleVoices[0].voice_id, "-", maleVoices[0].name);
        } else {
            console.log("Nenhuma voz masculina encontrada. Primeira voz encontrada:");
            console.log(voices[0].voice_id, "-", voices[0].name);
        }
    } catch (e) {
        console.error("❌ ERRO na API do ElevenLabs:", e.response ? e.response.data : e.message);
    }
}
listVoices();
