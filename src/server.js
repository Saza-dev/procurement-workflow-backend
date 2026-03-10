import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { connectDB, disconnectDB } from "./config/db.js";
import cookieParser from "cookie-parser";

// Route imports
import authRoutes from "./routes/auth.routes.js";
import basketRoutes from "./routes/requestBasket.routes.js";
import itemsRoutes from "./routes/requestItem.routes.js";
import approvalRoutes from "./routes/approval.routes.js";
import chatRoutes from "./routes/chat.routes.js";

connectDB();

const app = express();

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const isAllowedVercel =
        origin.endsWith(".vercel.app") &&
        origin.includes("procurement-workflow");
      const isLocal = origin === "http://localhost:3000";

      if (isAllowedVercel || isLocal) {
        return callback(null, true);
      } else {
        return callback(new Error("CORS Policy blocked this origin"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// routes
app.use("/api/auth", authRoutes);
app.use("/api/basket", basketRoutes);
app.use("/api/items", itemsRoutes);
app.use("/api/approval", approvalRoutes);
app.use("/api/chat", chatRoutes);

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on("unhandledRejection", async (err) => {
  console.error("Unhandled Rejection: ", err);
  await disconnectDB();
  process.exit(1);
});

process.on("uncaughtException", async (err) => {
  console.error("Uncaught Exception: ", err);
  await disconnectDB();
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
});
