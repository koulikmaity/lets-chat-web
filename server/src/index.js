import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import mongoose, { Schema } from "mongoose";
import { Server } from "socket.io";
import admin from "firebase-admin";

const PORT = Number(process.env.PORT || 3001);
const ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  throw new Error("Firebase Admin credentials are required in the server .env");
}
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
await mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB_NAME || "lets_chat",
});

const userSchema = new Schema(
  {
    uid: { type: String, required: true, unique: true },
    displayName: { type: String, default: "" },
    email: { type: String, default: "" },
    photoURL: { type: String, default: "" },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
const conversationSchema = new Schema(
  {
    members: { type: [String], required: true },
    pairKey: { type: String, required: true, unique: true },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
conversationSchema.index({ members: 1, lastMessageAt: -1 });
const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: { type: String, required: true },
    text: { type: String, required: true, maxlength: 4000 },
    seenBy: { type: [String], default: [] },
  },
  { timestamps: true },
);
messageSchema.index({ conversationId: 1, createdAt: -1 });
const User = mongoose.model("User", userSchema);
const Conversation = mongoose.model("Conversation", conversationSchema);
const Message = mongoose.model("Message", messageSchema);

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: ORIGIN }));
app.use(express.json({ limit: "20kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 180,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ORIGIN, methods: ["GET", "POST"] },
});
const verify = async (token) => admin.auth().verifyIdToken(token, true);
async function auth(req, res, next) {
  try {
    const match = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    if (!match) return res.status(401).json({ error: "Missing access token" });
    req.user = await verify(match[1]);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}
app.get("/api/health", (_, res) => res.json({ ok: true }));
app.use("/api", auth);
app.post("/api/me", async (req, res, next) => {
  try {
    const { uid, email, name, picture } = req.user;

    const displayName = String(name || email?.split("@")[0] || "User").slice(
      0,
      80,
    );

    const photoURL = String(picture || "").slice(0, 1500);

    const user = await User.findOneAndUpdate(
      { uid },
      {
        $set: {
          email: email || "",
          lastSeen: new Date(),
        },
        $setOnInsert: {
          displayName,
          photoURL,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    );

    res.json(user);
  } catch (e) {
    next(e);
  }
});

app.patch("/api/me", async (req, res, next) => {
  try {
    if (
      typeof req.body?.displayName !== "string" ||
      typeof req.body?.photoURL !== "string"
    ) {
      return res.status(400).json({
        error: "Name and photoURL are required",
      });
    }

    const displayName = req.body.displayName.trim();
    const photoURL = req.body.photoURL.trim();

    if (!displayName || displayName.length > 80) {
      return res.status(400).json({
        error: "Name must be 1–80 characters",
      });
    }

    if (
      photoURL.length > 1500 ||
      (photoURL && !/^https:\/\//i.test(photoURL))
    ) {
      return res.status(400).json({
        error: "Photo must be an HTTPS URL",
      });
    }

    await admin.auth().updateUser(req.user.uid, {
      displayName,
      photoURL: photoURL || null,
    });

    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: { displayName, photoURL } },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({
        error: "Profile not found",
      });
    }

    io.emit("user:updated", {
      uid: req.user.uid,
      displayName,
      photoURL,
    });

    res.json(user);
  } catch (e) {
    next(e);
  }
});

app.get("/api/unread", async (req, res, next) => {
  try {
    const rooms = await Conversation.find({
      members: req.user.uid,
    })
      .select("_id")
      .lean();

    const counts = await Message.aggregate([
      {
        $match: {
          conversationId: {
            $in: rooms.map((room) => room._id),
          },
          sender: { $ne: req.user.uid },
          seenBy: { $ne: req.user.uid },
        },
      },
      {
        $group: {
          _id: "$conversationId",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json(
      Object.fromEntries(counts.map((row) => [String(row._id), row.count])),
    );
  } catch (e) {
    next(e);
  }
});

app.get("/api/users", async (req, res, next) => {
  try {
    const q = String(req.query.q || "")
      .trim()
      .slice(0, 80);
    const filter = { uid: { $ne: req.user.uid } };
    if (q)
      filter.$or = [
        {
          displayName: {
            $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        },
        {
          email: {
            $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        },
      ];
    res.json(
      await User.find(filter)
        .select("uid displayName photoURL email lastSeen")
        .limit(100)
        .lean(),
    );
  } catch (e) {
    next(e);
  }
});
app.get("/api/conversations", async (req, res, next) => {
  try {
    res.json(
      await Conversation.find({ members: req.user.uid })
        .sort({ lastMessageAt: -1 })
        .limit(100)
        .lean(),
    );
  } catch (e) {
    next(e);
  }
});
app.post("/api/conversations", async (req, res, next) => {
  try {
    const other = String(req.body?.userId || "");
    if (!other || other === req.user.uid)
      return res.status(400).json({ error: "Invalid recipient" });
    if (!(await User.exists({ uid: other })))
      return res.status(404).json({ error: "User not found" });
    const members = [req.user.uid, other].sort();
    const conversation = await Conversation.findOneAndUpdate(
      { pairKey: JSON.stringify(members) },
      { $setOnInsert: { members, pairKey: JSON.stringify(members) } },
      { upsert: true, new: true },
    );
    io.to(`user:${other}`).emit("conversation:new", conversation);
    res.json(conversation);
  } catch (e) {
    next(e);
  }
});
async function authorizedRoom(id, uid) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Conversation.findOne({ _id: id, members: uid });
}
app.get("/api/conversations/:id/messages", async (req, res, next) => {
  try {
    const room = await authorizedRoom(req.params.id, req.user.uid);
    if (!room) return res.status(404).json({ error: "Chat not found" });
    const before = req.query.before ? new Date(req.query.before) : null;
    if (before && Number.isNaN(before.getTime()))
      return res.status(400).json({ error: "Invalid cursor" });
    const query = {
      conversationId: room._id,
      ...(before ? { createdAt: { $lt: before } } : {}),
    };
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();
    res.json(messages.reverse());
  } catch (e) {
    next(e);
  }
});
async function saveMessage(uid, data) {
  const room = await authorizedRoom(data?.conversationId, uid);
  if (!room) throw Object.assign(new Error("Chat not found"), { status: 403 });
  const text = String(data?.text || "").trim();
  if (!text || text.length > 4000)
    throw Object.assign(new Error("Message must be 1–4000 characters"), {
      status: 400,
    });
  const msg = await Message.create({
    conversationId: room._id,
    sender: uid,
    text,
    seenBy: [uid],
  });
  await Conversation.updateOne(
    { _id: room._id },
    { $set: { lastMessage: text, lastMessageAt: msg.createdAt } },
  );
  const output = msg.toObject();
  io.to(`room:${room._id}`).emit("message:new", output);
  // Notify users even if they haven't opened this conversation.

  for (const member of room.members) {
    io.to(`user:${member}`).emit("conversation:updated", {
      conversationId: String(room._id),
      lastMessage: text,
      lastMessageAt: msg.createdAt,
    });

    if (member !== uid) {
      io.to(`user:${member}`).emit("unread:changed");
    }
  }

  return output;
}
app.post("/api/conversations/:id/messages", async (req, res, next) => {
  try {
    res.status(201).json(
      await saveMessage(req.user.uid, {
        conversationId: req.params.id,
        text: req.body?.text,
      }),
    );
  } catch (e) {
    next(e);
  }
});
app.post("/api/conversations/:id/seen", async (req, res, next) => {
  try {
    const room = await authorizedRoom(req.params.id, req.user.uid);
    if (!room) return res.status(404).json({ error: "Chat not found" });
    await Message.updateMany(
      {
        conversationId: room._id,
        sender: { $ne: req.user.uid },
        seenBy: { $ne: req.user.uid },
      },
      { $addToSet: { seenBy: req.user.uid } },
    );
    io.to(`room:${room._id}`).emit("messages:seen", {
      conversationId: String(room._id),
      uid: req.user.uid,
    });

    io.to(`user:${req.user.uid}`).emit("unread:changed");

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
const socketsByUid = new Map();
io.use(async (socket, next) => {
  try {
    socket.data.user = await verify(socket.handshake.auth?.token);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});
io.on("connection", (socket) => {
  const uid = socket.data.user.uid;
  socket.join(`user:${uid}`);
  socketsByUid.set(uid, (socketsByUid.get(uid) || 0) + 1);
  io.emit("presence", Array.from(socketsByUid.keys()));
  socket.on("room:join", async (roomId, ack) => {
    try {
      const room = await authorizedRoom(roomId, uid);
      if (!room) return ack?.({ error: "Not authorized" });
      await socket.join(`room:${room._id}`);
      ack?.({ ok: true });
    } catch {
      ack?.({ error: "Unable to join room" });
    }
  });
  socket.on("room:leave", (roomId) => {
    socket.leave(`room:${roomId}`);
  });
  socket.on("typing", async ({ conversationId, typing }) => {
    const room = await authorizedRoom(conversationId, uid);
    if (room)
      socket
        .to(`room:${room._id}`)
        .emit("typing", { conversationId, uid, typing: !!typing });
  });
  socket.on("disconnect", () => {
    const count = (socketsByUid.get(uid) || 1) - 1;
    if (count <= 0) {
      socketsByUid.delete(uid);
      User.updateOne({ uid }, { $set: { lastSeen: new Date() } }).catch(
        () => {},
      );
    } else socketsByUid.set(uid, count);
    io.emit("presence", Array.from(socketsByUid.keys()));
  });
});
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ error: err.status ? err.message : "Internal server error" });
});
httpServer.listen(PORT, () =>
  console.log(`Chat API listening at http://localhost:${PORT}`),
);
