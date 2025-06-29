import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { nama, nomor, password, paket } = req.body;
  if (!nama || !nomor || !password || !paket) {
    return res.status(400).json({ error: "Semua field wajib diisi!" });
  }

  try {
    const configRes = await fetch("https://raw.githubusercontent.com/wandaaja01/panel-settings/main/config.json");
    const config = await configRes.json();

    const domain = config.domain;
    const apiKey = config.plta;
    const nestid = config.nestid;
    const egg = config.egg;
    const location = config.location;

    const email = `${nama.toLowerCase()}@gmail.com`;
    const username = nama.toLowerCase();
    const userPassword = username + Math.random().toString(36).substring(2, 6);

    const userCheckRes = await fetch(`${domain}/api/application/users?filter[email]=${email}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      }
    });

    const userCheck = await userCheckRes.json();
    if (userCheck.data && userCheck.data.length > 0) {
      return res.status(409).json({ error: "Email sudah digunakan!" });
    }

    const createUser = await fetch(`${domain}/api/application/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      },
      body: JSON.stringify({
        username,
        email,
        first_name: nama,
        last_name: "Client",
        language: "en",
        password: userPassword
      })
    });

    const user = await createUser.json();
    if (!createUser.ok) {
      return res.status(500).json({ error: "Gagal membuat user", detail: user });
    }

    const userId = user.attributes.id;

    const eggInfo = await fetch(`${domain}/api/application/nests/${nestid}/eggs/${egg}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      }
    });
    const eggData = await eggInfo.json();
    const startup = eggData.attributes.startup;

    const specs = {
      "1gb": { ram: 1000, disk: 1000, cpu: 40 },
      "2gb": { ram: 2000, disk: 1000, cpu: 60 },
      "3gb": { ram: 3000, disk: 2000, cpu: 80 },
      "4gb": { ram: 4000, disk: 2000, cpu: 100 },
      "5gb": { ram: 5000, disk: 3000, cpu: 120 },
      "6gb": { ram: 6000, disk: 3000, cpu: 140 },
      "7gb": { ram: 7000, disk: 4000, cpu: 160 },
      "8gb": { ram: 8000, disk: 4000, cpu: 180 },
      "9gb": { ram: 9000, disk: 5000, cpu: 200 },
      "10gb": { ram: 10000, disk: 5000, cpu: 220 },
      "unli": { ram: 0, disk: 0, cpu: 0 }
    };

    const selected = specs[paket.toLowerCase()];
    if (!selected) return res.status(400).json({ error: "Paket tidak valid" });

    const createServer = await fetch(`${domain}/api/application/servers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      },
      body: JSON.stringify({
        name: `${nama} Server`,
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
          memory: selected.ram,
          swap: 0,
          disk: selected.disk,
          io: 500,
          cpu: selected.cpu
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

    const server = await createServer.json();
    if (!createServer.ok) {
      return res.status(500).json({ error: "Gagal membuat server", detail: server });
    }

    return res.status(200).json({
      success: true,
      panel: {
        username,
        password: userPassword,
        email,
        server_id: server.attributes.id,
        login_url: `${domain}`
      }
    });

  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({ error: "Gagal konek ke server panel", detail: err.message });
  }
}