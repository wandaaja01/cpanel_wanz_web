const fetch = require("node-fetch");
const crypto = require("crypto");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send("POST only");

  const { username, paket, token } = req.body;
  if (!token || !token.endsWith("-verified")) return res.json({ error: "Unauthorized" });

  const APIKEY = process.env.plta1;
  const DOMAIN = "https://nabelsudahmandi.premium-cloud.my.id";
  const EGG = process.env.egg1;
  const NESTID = process.env.nestidv1;
  const LOC = process.env.locationv1;

  const mapping = {
    "1gb": [1000, 1000, 40],
    "2gb": [2000, 1000, 60],
    "3gb": [3000, 2000, 80],
    "4gb": [4000, 2000, 100],
    "5gb": [5000, 3000, 120],
    "6gb": [6000, 3000, 140],
    "7gb": [7000, 4000, 160],
    "8gb": [8000, 4000, 180],
    "9gb": [9000, 5000, 200],
    "10gb": [10000, 5000, 220],
    "unli": [0, 0, 0]
  };

  const [ram, disk, cpu] = mapping[paket] || [0, 0, 0];
  const email = `${username}@gmail.com`;
  const password = username + crypto.randomBytes(2).toString("hex");

  try {
    const userRes = await fetch(`${DOMAIN}/api/application/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${APIKEY}` },
      body: JSON.stringify({ email, username, first_name: username, last_name: "Panel", language: "en", password })
    });
    const userData = await userRes.json();
    if (userData.errors) return res.json({ error: userData.errors[0].detail });
    const userId = userData.attributes.id;

    const eggRes = await fetch(`${DOMAIN}/api/application/nests/${NESTID}/eggs/${EGG}`, {
      headers: { "Authorization": `Bearer ${APIKEY}` }
    });
    const eggData = await eggRes.json();
    const startup = eggData.attributes.startup;

    const serverRes = await fetch(`${DOMAIN}/api/application/servers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${APIKEY}` },
      body: JSON.stringify({
        name: `${username}-server`,
        user: userId,
        egg: parseInt(EGG),
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
        startup,
        environment: {
          INST: "npm",
          USER_UPLOAD: "0",
          AUTO_UPDATE: "0",
          CMD_RUN: "npm start"
        },
        limits: { memory: ram, swap: 0, disk: disk, io: 500, cpu: cpu },
        feature_limits: { databases: 5, backups: 5, allocations: 5 },
        deploy: { locations: [parseInt(LOC)], dedicated_ip: false, port_range: [] }
      })
    });

    const serverData = await serverRes.json();
    if (serverData.errors) return res.json({ error: serverData.errors[0].detail });

    return res.json({
      server_id: serverData.attributes.id,
      user_id: userId,
      username,
      password,
      ram,
      disk,
      cpu,
      domain: DOMAIN
    });
  } catch (err) {
    return res.json({ error: "Gagal buat panel" });
  }
};
  
