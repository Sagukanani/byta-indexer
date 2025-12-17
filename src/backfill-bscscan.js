require("dotenv").config();
const axios = require("axios");
const { ethers } = require("ethers");
const db = require("./db");

const API_KEY = process.env.BSCSCAN_API_KEY;
const CONTRACT = process.env.STAKING_PROXY.toLowerCase();
const START_BLOCK = Number(process.env.START_BLOCK) || 0;

const EVENT_SIG = "ReferralLinked(address,address,bool)";
const EVENT_TOPIC = ethers.id(EVENT_SIG);

const iface = new ethers.Interface([
  "event ReferralLinked(address user, address referrer, bool isLeft)"
]);

const PAGE_SIZE = 1000;

async function fetchPage(page) {
  const BASE = process.env.BSCSCAN_API_BASE;

  const url =
  `${BASE}` +
  `&module=logs` +
  `&action=getLogs` +
  `&chainid=56` +
  `&fromBlock=${START_BLOCK}` +
  `&toBlock=latest` +
  `&address=${CONTRACT}` +
  `&topic0=${EVENT_TOPIC}` +
  `&page=${page}` +
  `&offset=${PAGE_SIZE}` +
  `&apikey=${API_KEY}`;


  const res = await axios.get(url);

  if (res.data.status !== "1" && res.data.message !== "No records found") {
    throw new Error(res.data.message || "BscScan error");
  }

  return res.data.result || [];
}

async function backfill() {
  console.log("BscScan backfill started...");
  let page = 1;
  let total = 0;

  while (true) {
    const logs = await fetchPage(page);
    if (!logs.length) break;

    for (const log of logs) {
      const parsed = iface.parseLog({
        topics: log.topics,
        data: log.data
      });

      const { user, referrer, isLeft } = parsed.args;
      const side = isLeft ? "L" : "R";

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

      total++;
    }

    console.log(`Page ${page} done, total records: ${total}`);
    page++;
  }

  console.log("✅ BscScan backfill completed.");
}

backfill().catch((e) => {
  console.error("❌ Backfill failed:", e.message);
});
