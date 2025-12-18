require("dotenv").config();
const { ethers } = require("ethers");
const db = require("./db");

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC);

const iface = new ethers.Interface([
  "event ReferrerSet(address indexed user, address indexed referrer, bool isLeft)",
  "event ReferralLinked(address indexed user, address indexed referrer, bool isLeft)"
]);

let lastBlock = Number(process.env.START_BLOCK || 0);
const CHUNK_SIZE = 5;

function upsertUser(user, referrer, side) {
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
    side,
    level
  );
}

async function poll() {
  try {
    const latest = await provider.getBlockNumber();
    if (lastBlock >= latest) return;

    const toBlock = Math.min(lastBlock + CHUNK_SIZE, latest);

    const logs = await provider.getLogs({
      address: process.env.STAKING_ADDRESS, // ✅ FIXED
      fromBlock: lastBlock + 1,
      toBlock,
      topics: [[
        ethers.id("ReferrerSet(address,address,bool)"),
        ethers.id("ReferralLinked(address,address,bool)")
      ]]
    });

    for (const log of logs) {
      const parsed = iface.parseLog(log);
      const { user, referrer, isLeft } = parsed.args;
      const side = isLeft ? "L" : "R";

      upsertUser(user, referrer, side);

      console.log(
        "linked:",
        user,
        "->",
        referrer,
        side,
        "block",
        log.blockNumber
      );
    }

    lastBlock = toBlock;
  } catch (err) {
    console.error("Indexer error:", err.message);
  }
}

console.log("Indexer started...");
setInterval(poll, 5000);
