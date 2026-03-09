const path = require("path");
const express = require("express");
const generateRoute = require("./routes/generate");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", generateRoute);

const clientDir = path.join(__dirname, "..", "client");
app.use(express.static(clientDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Tarpapel Tile Generator running at http://localhost:${PORT}`);
});
