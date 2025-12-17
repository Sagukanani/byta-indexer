const express = require("express");
const db = require("./db");

const app = express();

/**
 * FULL TEAM API
 * - direct + indirect
 * - level-wise
 * - left/right counts
 */
app.get("/team/:address", (req, res) => {
  const root = req.params.address.toLowerCase();

  // सभी downline निकालो
  const rows = db
    .prepare(`
      SELECT address, referrer, side, level
      FROM users
      WHERE address != ?
      AND (
        referrer = ?
        OR referrer IN (
          SELECT address FROM users WHERE referrer = ?
        )
      )
    `)
    .all(root, root, root);

  // अगर future में deeper tree हो, तो safer तरीका:
  // recursive JS traversal
  const all = [];
  const queue = [{ address: root, level: 0 }];

  while (queue.length) {
    const current = queue.shift();

    const children = db
      .prepare("SELECT * FROM users WHERE referrer = ?")
      .all(current.address);

    for (const c of children) {
      all.push(c);
      queue.push({ address: c.address, level: c.level });
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
