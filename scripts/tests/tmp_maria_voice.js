const axios = require('axios');
async function run() {
  const API_KEY = "sk-api-m3Q2V05sw-S2E65Iv9jn93RWR_w1u-oWWP_kg-VSYM_TOezx_Oa0lQgHkY7iCYPHQm2JQodExxXCTfEy3siLNDNSfyPE39d7iDn8-59oe_--szTB9L1vPRs";
  try {
      const res = await axios.post('https://api.minimax.io/v1/get_voice', { voice_type: 'all' }, { headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }});
      console.log(JSON.stringify(res.data.voice_cloning, null, 2));
  } catch (e) { console.log(e.response ? e.response.data : e.message); }
}
run();
