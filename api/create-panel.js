const fetch = require("node-fetch");
const crypto = require("crypto");

// RAM / DISK / CPU per paket
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
  "unli": [99999, 99999, 300],
  "unlimited": [99999, 99999, 300],
};

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { username, paket, token } = req.body;

    if (!token || !token.endsWith("-verified"))
      return res.status(403).json({ error: "Akses ditolak! Kamu bukan user premium." });

    if (!username || !paket) return res.status(400).json({ error: "Username dan paket wajib diisi!" });

    const [ram, disk, cpu] = mapping[paket.toLowerCase()] || [];
    if (!ram) return res.status(400).json({ error: "Paket tidak valid!" });

    // Ambil config dari GitHub
    const configRes = await fetch("https://raw.githubusercontent.com/wandaaja01/panel-settings/main/config.json");
    if (!configRes.ok) throw new Error("Gagal mengambil konfigurasi panel dari GitHub");
    const config = await configRes.json();

    const { plta, pltc, egg, nest, location } = config;
    const domain = config.domain || "https://freezing.indopanel.my.id"; // fallback

    const password = username + crypto.randomBytes(2).toString("hex");
    const email = `${username}@gmail.com`;
    const fullName = username.charAt(0).toUpperCase() + username.slice(1);

    // 1. Buat user
    const userRes = await fetch(domain + "/api/application/users", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${plta}`
      },
      body: JSON.stringify({
        email,
        username: username.toLowerCase(),
        first_name: fullName,
        last_name: "Hosting",
        password,
        language: "en"
      })
    });

    const userJson = await userRes.json();
    if (userJson.errors) return res.json({ error: userJson.errors[0].detail || "Gagal membuat user" });

    const userId = userJson.attributes.id;

    // 2. Ambil startup command
    const eggRes = await fetch(`${domain}/api/application/nests/${nest}/eggs/${egg}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${plta}`
      }
    });
    const eggJson = await eggRes.json();
    const startup = eggJson.attributes.startup;

    // 3. Buat server
    const serverRes = await fetch(domain + "/api/application/servers", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${plta}`
      },
      body: JSON.stringify({
        name: fullName + " Panel",
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

    const serverJson = await serverRes.json();
    if (serverJson.errors) return res.json({ error: serverJson.errors[0].detail || "Gagal membuat server" });

    const serverId = serverJson.attributes.id;

    return res.json({
      username,
      password,
      ram,
      disk,
      cpu,
      user_id: userId,
      server_id: serverId,
      domain
    });

  } catch (err) {
    console.error("[CREATE PANEL ERROR]", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
};
