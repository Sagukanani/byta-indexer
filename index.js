require("dotenv").config();

const app = require("./src/api");

// indexer start (event listener)
require("./src/indexer");

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`BYTA Indexer API running on port ${PORT}`);
});
