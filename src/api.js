const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

/* ===== MIDDLEWARE ===== */
app.use(cors());              // 👈 यही CORS fix है
app.use(express.json());

/**
 * FULL TEAM API
 * - direct + indirect
 * - level-wise
 * - left/right counts
 */
app.get("/team/:address", (req, res) => {
  const root = req.params.address.toLowerCase();

  // recursive traversal (safe for future depth)
  const all = [];
  const queue = [{ address: root }];

  while (queue.length) {
    const current = queue.shift();

    const children = db
      .prepare("SELECT address, referrer, side, level FROM users WHERE referrer = ?")
      .all(current.address);

    for (const c of children) {
      all.push(c);
      queue.push({ address: c.address });
    }
  }

  let left = 0;
  let right = 0;

  for (const u of all) {
    if (u.side === "L") left++;
    if (u.side === "R") right++;
  }

  res.json({
    root,
    totalTeam: all.length,
    leftCount: left,
    rightCount: right,
    team: all
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("BYTA Indexer API running on port", PORT);
});
