require("dotenv").config();
const { ethers } = require("ethers");
const db = require("./db");

const RPC = process.env.BSC_RPC;
const CONTRACT = process.env.STAKING_PROXY;
const START_BLOCK = Number(process.env.START_BLOCK) || 0;

const provider = new ethers.JsonRpcProvider(RPC);

const abi = [
  "event ReferrerSet(address user, address referrer, bool isLeft)"
];

const iface = new ethers.Interface(abi);

const CHUNK = 5; // safe for BSC public RPC

async function backfill() {
  const latest = await provider.getBlockNumber();
  console.log(`Backfilling from ${START_BLOCK} → ${latest}`);

  let from = START_BLOCK;

  for (; from <= latest; from += CHUNK) {

    const to = Math.min(from + CHUNK - 1, latest);

    try {
      const logs = await provider.getLogs({
        address: CONTRACT,
        fromBlock: from,
        toBlock: to,
        topics: [ethers.id("ReferrerSet(address,address,bool)")]
      });

      for (const log of logs) {
        const parsed = iface.parseLog(log);
        const { user, referrer, isLeft } = parsed.args;

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

      console.log(`Blocks ${from} → ${to} OK (${logs.length} logs)`);
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
        console.log(`Retry later: ${from} → ${to}`);
        console.log(`👉 Resume by setting START_BLOCK=${from} in .env`);
        break;
    }

  }

  console.log("✅ RPC backfill completed safely");
}

backfill();
