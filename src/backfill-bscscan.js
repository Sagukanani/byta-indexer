require("dotenv").config();
const axios = require("axios");
const { ethers } = require("ethers");
const db = require("./db");

const API_KEY = process.env.BSCSCAN_API_KEY;
const CONTRACT = process.env.STAKING_ADDRESS.toLowerCase();
const START_BLOCK = Number(process.env.START_BLOCK) || 0;

const EVENT_SIG = "ReferrerSet(address,address,bool)";
const EVENT_TOPIC = ethers.id(EVENT_SIG);

const iface = new ethers.Interface([
  "event ReferrerSet(address indexed user, address indexed referrer, bool isLeft)"
]);

const PAGE_SIZE = 1000;

async function fetchPage(page) {
  const BASE = process.env.BSCSCAN_API_BASE;

  const url =
    `${BASE}` +
    `&module=logs&action=getLogs` +
    `&fromBlock=${START_BLOCK}` +
    `&toBlock=latest` +
    `&address=${CONTRACT}` +
    `&topic0=${EVENT_TOPIC}` +
    `&page=${page}&offset=${PAGE_SIZE}` +
    `&apikey=${API_KEY}`;

  const res = await axios.get(url);
  return res.data.result || [];
}

async function backfill() {
  let page = 1;
  let total = 0;

  while (true) {
    const logs = await fetchPage(page);
    if (!logs.length) break;

    for (const log of logs) {
      const { user, referrer, isLeft } = iface.parseLog({
        topics: log.topics,
        data: log.data
      }).args;

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

      total++;
    }

    console.log(`Page ${page} done (${total})`);
    page++;
  }

  console.log("✅ BscScan backfill done");
}

backfill().catch(console.error);
