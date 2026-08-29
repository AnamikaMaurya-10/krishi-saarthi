import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./routes.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN?.split(",") ?? "http://localhost:5173",
  credentials: true
}));

app.use(express.json());

app.use("/api", routes);

app.use((_req, res) =>
  res.status(404).json({ message: "Route not found" })
);

app.listen(port, () => {
  console.log(`Krishi Saathi API running at http://localhost:${port}`);
});
