import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./routes.js";

const app = express();
const port = Number(process.env.PORT || 4000);

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header.
      // Useful for direct API/browser health checks.
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed =
        allowedOrigins.includes(origin) ||
        /^https:\/\/krishi-saarthi-[a-z0-9-]+-anamikamaurya-10s-projects\.vercel\.app$/i.test(
          origin
        );

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

app.use("/api", routes);

app.use((_req, res) =>
  res.status(404).json({ message: "Route not found" })
);

app.listen(port, () => {
  console.log(`Krishi Saathi API running at http://localhost:${port}`);
});
