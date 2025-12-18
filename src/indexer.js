require("dotenv").config();
const { ethers } = require("ethers");
const db = require("./db");

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC);

const iface = new ethers.Interface([
  "event ReferrerSet(address indexed user, address indexed referrer, bool isLeft)",
  "event ReferralLinked(address indexed user, address indexed referrer, bool isLeft)"
]);

const CHUNK_SIZE = 9; // 🔥 production-friendly

/* ===== lastBlock persistence ===== */

function getLastBlock() {
  const row = db
    .prepare("SELECT value FROM meta WHERE key='lastBlock'")
    .get();
  return row
    ? Number(row.value)
    : Number(process.env.START_BLOCK || 0);
}

function setLastBlock(block) {
  db.prepare(`
    INSERT INTO meta(key, value)
    VALUES ('lastBlock', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(block));
}

let lastBlock = getLastBlock();

/* ===== user upsert ===== */

function upsertUser(user, referrer, side) {
  const parent = db
    .prepare("SELECT level FROM users WHERE address=?")
    .get(referrer.toLowerCase());

  const level = parent ? parent.level + 1 : 1;

  db.prepare(`
    INSERT INTO users(address, referrer, side, level)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      referrer = excluded.referrer,
      side = excluded.side,
      level = excluded.level
  `).run(
    user.toLowerCase(),
    referrer.toLowerCase(),
    side,
    level
  );
}

/* ===== poll loop ===== */

async function poll() {
  try {
    const latest = await provider.getBlockNumber();
    if (lastBlock >= latest) return;

    const toBlock = Math.min(lastBlock + CHUNK_SIZE, latest);

    const logs = await provider.getLogs({
      address: process.env.STAKING_ADDRESS,
      fromBlock: lastBlock + 1,
      toBlock,
      topics: [
        ethers.id("ReferralLinked(address,address,bool)")
      ]
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
    setLastBlock(lastBlock);

  } catch (err) {
  console.error("Indexer error:", err.message);

  // free RPC safety: infinite loop se nikalne ke liye
  lastBlock = lastBlock + CHUNK_SIZE;
  setLastBlock(lastBlock);
}

}

console.log("Indexer started from block", lastBlock);
setInterval(poll, 5000);
