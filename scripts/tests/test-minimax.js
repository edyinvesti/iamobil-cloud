const axios = require('axios');
async function getVoices() {
  const API_KEY = "sk-api-BL9XwUvbOINqn9EMfF2m2x_FVjRGjJ6wuwiW698I_dxkXfvpjA_uri2P3Vs5-yVPYiMGvHOu0wHY58ekHL65ihSJ6Ne9sxr1AcYfmk1SVLzmGwnzvu22y60";
  try {
    const res = await axios.post('https://api.minimax.io/v1/get_voice', { voice_type: 'all' }, {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch(e) {
    console.log(e.response ? e.response.data : e.message);
  }
}
getVoices();
