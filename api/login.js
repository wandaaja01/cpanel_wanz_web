module.exports = (req, res) => {
  if (req.method !== 'POST') return res.status(405).send("Only POST allowed");
  const { username, password } = req.body;

  const premiumUsers = {
    "wanda": "ganteng123",
    "admin": "rahasiabang"
  };

  if (premiumUsers[username] && premiumUsers[username] === password) {
    return res.json({ success: true, token: `${username}-verified` });
  }

  res.json({ success: false });
};
