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

    if (!nama || !nomor || !paket)
      return res.status(400).json({ error: "❗ Semua kolom wajib diisi!" });

    const [ram, disk, cpu] = paketMap[paket.toLowerCase()] || [];
    if (!ram) return res.status(400).json({ error: "❌ Paket tidak valid!" });

    // Ambil config dari GitHub (biar fleksibel)
    const configURL = "https://raw.githubusercontent.com/wandaaja01/panel-settings/main/config.json";
    const configRes = await fetch(configURL);
    const config = await configRes.json();

    const { domain, plta, egg, nestid, location } = config;

    // Cek nomor apakah terdaftar di database GitHub
    const nomorURL = "https://raw.githubusercontent.com/wandaaja01/panel-settings/main/premium-nomor.json";
    const nomorRes = await fetch(nomorURL);
    const nomorData = await nomorRes.json();

    if (!nomorData.includes(nomor)) {
      return res.status(403).json({ error: "❌ Nomor tidak terdaftar sebagai akun premium." });
    }

    const username = nama.toLowerCase().replace(/\s+/g, '');
    const password = username + crypto.randomBytes(2).toString("hex");
    const email = `${username}@gmail.com`;

    // Cek email apakah sudah ada
    const cekUserRes = await fetch(`${domain}/api/application/users?filter[email]=${email}`, {
      headers: { Authorization: `Bearer ${plta}` }
    });
    const cekUserTxt = await cekUserRes.text();

    try {
      const cekJson = JSON.parse(cekUserTxt);
      if (cekJson.data && cekJson.data.length > 0) {
        return res.status(409).json({ error: "❌ Email atau username sudah digunakan!" });
      }
    } catch (e) {
      return res.status(500).json({ error: "❌ Gagal membaca data user:\n" + cekUserTxt });
    }

    // Buat user
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

    const userTxt = await userRes.text();
    let userJson;

    try {
      userJson = JSON.parse(userTxt);
    } catch (e) {
      return res.status(500).json({ error: "❌ Gagal membuat user:\n" + userTxt });
    }

    if (userJson.errors) {
      return res.status(500).json({ error: "❌ Error saat membuat user:\n" + userJson.errors.map(e => e.detail).join("\n") });
    }

    const userId = userJson.attributes.id;

    // Ambil startup egg
    const eggRes = await fetch(`${domain}/api/application/nests/${nestid}/eggs/${egg}`, {
      headers: { Authorization: "Bearer " + plta }
    });

    const eggTxt = await eggRes.text();
    let eggJson;

    try {
      eggJson = JSON.parse(eggTxt);
    } catch (e) {
      return res.status(500).json({ error: "❌ Gagal membaca egg:\n" + eggTxt });
    }

    const startup = eggJson.attributes.startup;

    // Buat server
    const serverRes = await fetch(`${domain}/api/application/servers`, {
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

    const serverTxt = await serverRes.text();
    let serverJson;

    try {
      serverJson = JSON.parse(serverTxt);
    } catch (e) {
      return res.status(500).json({ error: "❌ Gagal membuat server:\n" + serverTxt });
    }

    if (serverJson.errors) {
      return res.status(500).json({ error: "❌ Error saat membuat server:\n" + serverJson.errors.map(e => e.detail).join("\n") });
    }

    const serverId = serverJson.attributes.id;

    // Berhasil
    return res.json({
      username,
      password,
      user_id: userId,
      server_id: serverId,
      domain,
      ram,
      cpu,
      disk
    });

  } catch (err) {
    console.error("[ERROR]", err);
    return res.status(500).json({ error: "❌ Internal Server Error: " + err.message });
  }
};