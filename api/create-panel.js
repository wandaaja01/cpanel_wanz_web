import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { nama, nomor, password, paket } = req.body;

  if (!nama || !nomor || !password || !paket) {
    return res.status(400).json({ message: "Semua kolom wajib diisi!" });
  }

  try {
    const configRes = await fetch(
      "https://raw.githubusercontent.com/wandaaja01/panel-settings/main/premium-users.json"
    );
    const config = await configRes.json();

    const {
      domain,
      plta,
      pltc,
      egg,
      nestid,
      location
    } = config;

    const dbRes = await fetch(
      "https://raw.githubusercontent.com/wandaaja01/panel-settings/main/users.json"
    );
    const database = await dbRes.json();

    const user = database.find(
      (u) => u.nomor === nomor && u.password === password
    );

    if (!user) {
      return res.status(401).json({
        message: "❌ Nomor atau password tidak terdaftar dalam database!",
      });
    }

    const email = `${nama.toLowerCase()}@gmail.com`;
    const uname = nama.toLowerCase();
    const namaLengkap = `${nama} Server`;

    const paketSpecs = {
      "1gb": { ram: "1000", disk: "1000", cpu: "40" },
      "2gb": { ram: "2000", disk: "1000", cpu: "60" },
      "3gb": { ram: "3000", disk: "2000", cpu: "80" },
      "4gb": { ram: "4000", disk: "2000", cpu: "100" },
      "5gb": { ram: "5000", disk: "3000", cpu: "120" },
      "6gb": { ram: "6000", disk: "3000", cpu: "140" },
      "7gb": { ram: "7000", disk: "4000", cpu: "160" },
      "8gb": { ram: "8000", disk: "4000", cpu: "180" },
      "9gb": { ram: "9000", disk: "5000", cpu: "200" },
      "10gb": { ram: "10000", disk: "5000", cpu: "220" },
      "unli": { ram: "0", disk: "0", cpu: "0" }
    };

    const spec = paketSpecs[paket.toLowerCase()];
    if (!spec) return res.status(400).json({ message: "Paket tidak ditemukan!" });

    const cekRes = await fetch(
      `${domain}/api/application/users?filter[email]=${email}`,
      {
        headers: {
          Authorization: `Bearer ${plta}`,
          Accept: "application/json"
        }
      }
    );
    const cekJson = await cekRes.json();

    if (cekJson.data && cekJson.data.length > 0) {
      return res.status(400).json({ message: "Email sudah digunakan!" });
    }

    const genPass = uname + Math.random().toString(36).substring(2, 6);

    const buatUser = await fetch(`${domain}/api/application/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${plta}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: uname,
        email,
        first_name: namaLengkap,
        last_name: "Client",
        language: "en",
        password: genPass
      })
    });

    const userData = await buatUser.json();

    if (userData.errors) {
      return res.status(400).json({ message: userData.errors[0].detail });
    }

    const userId = userData.attributes.id;

    const eggData = await fetch(
      `${domain}/api/application/nests/${nestid}/eggs/${egg}`,
      {
        headers: {
          Authorization: `Bearer ${plta}`,
          Accept: "application/json"
        }
      }
    );

    const eggJson = await eggData.json();
    const startup = eggJson.attributes.startup;

    const buatServer = await fetch(`${domain}/api/application/servers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${plta}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `${nama} Hosting`,
        user: userId,
        egg: parseInt(egg),
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
        startup: startup,
        environment: {
          INST: "npm",
          USER_UPLOAD: "0",
          AUTO_UPDATE: "0",
          CMD_RUN: "npm start"
        },
        limits: {
          memory: spec.ram,
          swap: 0,
          disk: spec.disk,
          io: 500,
          cpu: spec.cpu
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

    const serverRes = await buatServer.json();

    if (serverRes.errors) {
      return res.status(500).json({
        message: serverRes.errors.map(e => e.detail).join("\n")
      });
    }

    return res.status(200).json({
      username: uname,
      password: genPass,
      paket,
      login: domain
    });

  } catch (e) {
    console.error("[CREATE PANEL ERROR]", e);
    return res.status(500).json({ message: "❌ Terjadi kesalahan teknis:\n" + e.message });
  }
}