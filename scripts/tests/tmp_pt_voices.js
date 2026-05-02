const axios = require('axios');
async function run() {
  const API_KEY = "sk-api-BL9XwUvbOINqn9EMfF2m2x_FVjRGjJ6wuwiW698I_dxkXfvpjA_uri2P3Vs5-yVPYiMGvHOu0wHY58ekHL65ihSJ6Ne9sxr1AcYfmk1SVLzmGwnzvu22y60";
  try {
      const res = await axios.post('https://api.minimax.io/v1/get_voice', { voice_type: 'system' }, { headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }});
      const voices = res.data.voices || res.data.system || res.data.system_voices || Object.values(res.data).find(Array.isArray);
      if (!voices) { console.log("Keys:", Object.keys(res.data)); return; }
      const pt = voices.filter(v => JSON.stringify(v).toLowerCase().includes('portuguese') || JSON.stringify(v).toLowerCase().includes('brazil'));
      console.log(JSON.stringify(pt.map(v => ({ id: v.voice_id, name: v.voice_name })), null, 2));
  } catch (e) { console.log(e.response ? e.response.data : e.message); }
}
run();
run();
