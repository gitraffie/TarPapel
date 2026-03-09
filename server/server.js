const path = require("path");
const express = require("express");
const cors = require("cors");
const generateRoute = require("./routes/generate");

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://gitraffie.github.io"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    }
  })
);

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
