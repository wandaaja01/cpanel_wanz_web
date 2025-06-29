const fetch = require("node-fetch");
const crypto = require("crypto");

const paketMap = {
  "1gb":  [1000, 1000, 40],
  "2gb":  [2000, 1000, 60],
  "3gb":  [3000, 2000, 80],
  "4gb":  [4000, 2000, 100],
  "5gb":  [5000, 3000, 120],
  "6gb":  [6000, 3000, 140],
  "7gb":  [7000, 4000, 160],
  "8gb":  [8000, 4000, 180],
  "9gb":  [9000, 5000, 200],
  "10gb": [10000, 5000, 220],
  "unli": [99999, 99999, 300]
};

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { nama, nomor, paket } = req.body;

    if (!nama || !nomor || !paket) return res.status(400).json({ error: "Data tidak lengkap!" });
    const [ram, disk, cpu] = paketMap[paket.toLowerCase()] || [];
    if (!ram) return res.status(400).json({ error: "Paket tidak valid!" });

    const configUrl = "https://raw.githubusercontent.com/wandaaja01/panel-settings/main/config.json";
    const configRes = await fetch(configUrl);
    const config = await configRes.json();

    const domain = config.domain;
    const plta = config.plta;
    const egg = config.egg;
    const nestid = config.nestid;
    const location = config.location;

    const username = nama.toLowerCase();
    const password = username + crypto.randomBytes(2).toString("hex");
    const email = `${username}@gmail.com`;

    const check = await fetch(`${domain}/api/application/users?filter[email]=${email}`, {
      headers: { Authorization: `Bearer ${plta}` }
    });
    const checkJson = await check.json();
    if (checkJson.data && checkJson.data.length > 0) {
      return res.json({ error: "Email sudah terdaftar!" });
    }

    const userRes = await fetch(`${domain}/api/application/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + plta
      },
      body: JSON.stringify({
        username,
        email,
        first_name: nama,
        last_name: "Client",
        language: "en",
        password
      })
    });

    const user = await userRes.json();
    const userId = user.attributes.id;

    const eggRes = await fetch(`${domain}/api/application/nests/${nestid}/eggs/${egg}`, {
      headers: { Authorization: "Bearer " + plta }
    });
    const eggJson = await eggRes.json();
    const startup = eggJson.attributes.startup;

    const srvRes = await fetch(`${domain}/api/application/servers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + plta
      },
      body: JSON.stringify({
        name: `${username} Panel`,
        user: userId,
        egg: parseInt(egg),
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
        startup,
        environment: {
          INST: "npm",
          USER_UPLOAD: "0",
          AUTO_UPDATE: "0",
          CMD_RUN: "npm start"
        },
        limits: {
          memory: ram,
          swap: 0,
          disk: disk,
          io: 500,
          cpu: cpu
        },
        feature_limits: {
          databases: 5,
          backups: 5,
          allocations: 5
        },
        deploy: {
          locations: [parseInt(location)],
          dedicated_ip: false,
          port_range: []
        }
      })
    });

    const hasil = await srvRes.json();

    return res.json({
      username,
      password,
      ram,
      disk,
      cpu,
      user_id: userId,
      server_id: hasil.attributes.id,
      domain
    });

  } catch (err) {
    console.error("[ERR]", err);
    return res.status(500).json({ error: "Gagal membuat panel. " + err.message });
  }
};