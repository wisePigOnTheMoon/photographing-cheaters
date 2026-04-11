require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");
const { OAuth2Client } = require("google-auth-library");

const {
  MONGODB_URI,
  MONGODB_DB = "blakedb",
  GOOGLE_CLIENT_ID,
  PORT = 4000,
  FRONTEND_ORIGIN,
} = process.env;

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in .env");
  process.exit(1);
}
if (!GOOGLE_CLIENT_ID) {
  console.error("Missing GOOGLE_CLIENT_ID in .env");
  process.exit(1);
}

const app = express();

const allowedOrigins = FRONTEND_ORIGIN
  ? FRONTEND_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : null;
app.use(
  cors({
    origin: (origin, cb) => {
      if (!allowedOrigins) return cb(null, true); // dev: allow all
      if (!origin) return cb(null, true); // curl/server-to-server
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  })
);
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

let db;
let bucket;
let users;
let submissions;

async function connectDb() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(MONGODB_DB);
  bucket = new GridFSBucket(db, { bucketName: "photos" });
  users = db.collection("users");
  submissions = db.collection("submissions");
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ score: -1 });
  console.log(`Connected to MongoDB database "${MONGODB_DB}"`);
}

// Middleware: verify Google ID token from Authorization: Bearer <id_token>
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    req.user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// POST /api/submissions - upload a photo + reason, increments user's score
app.post(
  "/api/submissions",
  requireAuth,
  upload.single("photo"),
  async (req, res) => {
    try {
      const { reason } = req.body;
      if (!req.file) return res.status(400).json({ error: "Photo required" });
      if (!reason || !reason.trim())
        return res.status(400).json({ error: "Reason required" });

      // Stream the photo into GridFS
      const photoId = await new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(req.file.originalname, {
          contentType: req.file.mimetype,
          metadata: { uploaderEmail: req.user.email },
        });
        uploadStream.on("error", reject);
        uploadStream.on("finish", () => resolve(uploadStream.id));
        uploadStream.end(req.file.buffer);
      });

      // Upsert user and increment score
      const userUpdate = await users.findOneAndUpdate(
        { email: req.user.email },
        {
          $setOnInsert: {
            email: req.user.email,
            googleSub: req.user.sub,
          },
          $set: {
            name: req.user.name,
            picture: req.user.picture,
          },
          $inc: { score: 1 },
        },
        { upsert: true, returnDocument: "after" }
      );

      const submission = {
        userEmail: req.user.email,
        userName: req.user.name,
        reason: reason.trim(),
        photoId,
        createdAt: new Date(),
      };
      const inserted = await submissions.insertOne(submission);

      res.json({
        ok: true,
        submissionId: inserted.insertedId,
        score: userUpdate.score,
      });
    } catch (err) {
      console.error("Submission error:", err);
      res.status(500).json({ error: "Submission failed" });
    }
  }
);

// GET /api/leaderboard - users sorted by score desc
app.get("/api/leaderboard", async (_req, res) => {
  try {
    const docs = await users
      .find({}, { projection: { _id: 0, name: 1, email: 1, picture: 1, score: 1 } })
      .sort({ score: -1, name: 1 })
      .limit(100)
      .toArray();
    res.json(docs);
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

// GET /api/photos/:id - stream a photo from GridFS
app.get("/api/photos/:id", async (req, res) => {
  try {
    const _id = new ObjectId(req.params.id);
    const files = await db.collection("photos.files").findOne({ _id });
    if (!files) return res.status(404).end();
    res.setHeader("Content-Type", files.contentType || "application/octet-stream");
    bucket.openDownloadStream(_id).pipe(res);
  } catch {
    res.status(400).end();
  }
});

connectDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
