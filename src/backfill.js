require("dotenv").config();
const { ethers } = require("ethers");
const db = require("./db");

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC);
const CONTRACT = process.env.STAKING_ADDRESS;
const START_BLOCK = Number(process.env.START_BLOCK) || 0;

const iface = new ethers.Interface([
  "event ReferrerSet(address indexed user, address indexed referrer, bool isLeft)"
]);

const CHUNK = 5;

async function backfill() {
  const latest = await provider.getBlockNumber();
  console.log(`Backfilling ${START_BLOCK} → ${latest}`);

  for (let from = START_BLOCK; from <= latest; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, latest);

    const logs = await provider.getLogs({
      address: CONTRACT,
      fromBlock: from,
      toBlock: to,
      topics: [ethers.id("ReferrerSet(address,address,bool)")]
    });

    for (const log of logs) {
      const { user, referrer, isLeft } = iface.parseLog(log).args;

      const parent = db
        .prepare("SELECT level FROM users WHERE address=?")
        .get(referrer.toLowerCase());

      const level = parent ? parent.level + 1 : 1;

      db.prepare(`
        INSERT OR IGNORE INTO users(address, referrer, side, level)
        VALUES (?, ?, ?, ?)
      `).run(
        user.toLowerCase(),
        referrer.toLowerCase(),
        isLeft ? "L" : "R",
        level
      );
    }

    console.log(`Blocks ${from} → ${to} OK`);
  }

  console.log("✅ RPC backfill done");
}

backfill().catch(console.error);
