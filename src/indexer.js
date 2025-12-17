require("dotenv").config();
const { ethers } = require("ethers");
const db = require("./db");

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC);

const iface = new ethers.Interface([
  "event ReferrerSet(address indexed user, address indexed referrer, bool isLeft)"
]);

let lastBlock = Number(process.env.START_BLOCK || 0);
const CHUNK_SIZE = 9; // Alchemy free tier: max 10 blocks

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
      address: process.env.STAKING_PROXY,
      fromBlock: lastBlock + 1,
      toBlock,
      topics: [ethers.id("ReferrerSet(address,address,bool)")]
    });

    for (const log of logs) {
      const parsed = iface.parseLog(log);
      const { user, referrer, isLeft } = parsed.args;
      const side = isLeft ? "L" : "R";

      upsertUser(user, referrer, side);

      console.log(
        "Linked:",
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
    console.error("Indexer error:", err.shortMessage || err.message);
  }
}

async function start() {
  console.log("Indexer started. Polling ReferrerSet…");
  setInterval(poll, 5000); // every 5 seconds
}

start();
