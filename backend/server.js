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
let admins;

async function connectDb() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(MONGODB_DB);
  bucket = new GridFSBucket(db, { bucketName: "photos" });
  users = db.collection("users");
  submissions = db.collection("submissions");
  admins = db.collection("admins");
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ score: -1 });
  await admins.createIndex({ email: 1 }, { unique: true });
  
  // Ensure base admin exists
  await admins.updateOne(
    { email: "sophyli@stanford.edu" },
    { $setOnInsert: { email: "sophyli@stanford.edu", addedAt: new Date() } },
    { upsert: true }
  );
  
  console.log(`Connected to MongoDB database "${MONGODB_DB}"`);
}

// Middleware: verify Google ID token from Authorization: Bearer <id_token>
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    // Debug: log token structure
    const parts = token.split(".");
    console.log("Token parts count:", parts.length,  "Expected: 3");
    if (parts.length === 3) {
      try {
        const header = JSON.parse(Buffer.from(parts[0], "base64").toString("utf8"));
        console.log("Token header:", JSON.stringify(header));
      } catch (e) {
        console.error("Could not parse token header");
      }
    }

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
    console.error("Auth error details:", err);
    return res.status(401).json({ error: "Invalid token", details: err.message });
  }
}

// Middleware: verify admin access
async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    // Debug: log token structure
    const parts = token.split(".");
    console.log("[ADMIN AUTH] Token parts count:", parts.length, "Expected: 3");
    if (parts.length === 3) {
      try {
        const header = JSON.parse(Buffer.from(parts[0], "base64").toString("utf8"));
        console.log("[ADMIN AUTH] Token header:", JSON.stringify(header));
      } catch (e) {
        console.error("[ADMIN AUTH] Could not parse token header");
      }
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    // Check if user is in admins collection
    const adminDoc = await admins.findOne({ email: payload.email });
    if (!adminDoc) {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    req.user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
    next();
  } catch (err) {
    console.error("[ADMIN AUTH] Admin auth error:", err.message);
    console.error("[ADMIN AUTH] Admin auth error details:", err);
    return res.status(401).json({ error: "Invalid token", details: err.message });
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
      const { reason, participantName, participantId } = req.body;
      if (!req.file) return res.status(400).json({ error: "Photo required" });
      if (!reason || !reason.trim())
        return res.status(400).json({ error: "Reason required" });
      if (!participantName || !participantName.trim())
        return res.status(400).json({ error: "Participant name required" });

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
        participantName: participantName.trim(),
        participantId: participantId && participantId.trim() ? participantId.trim() : null,
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

// GET /api/photos/:id - stream a photo from GridFS (authenticated users only)
app.get("/api/photos/:id", requireAuth, async (req, res) => {
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

// GET /api/submissions - get all submissions (authenticated users only)
app.get("/api/submissions", requireAuth, async (req, res) => {
  try {
    const docs = await submissions
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json(docs);
  } catch (err) {
    console.error("Submissions fetch error:", err);
    res.status(500).json({ error: "Failed to load submissions" });
  }
});

// DELETE /api/admin/users/:email - delete a user from leaderboard
app.delete("/api/admin/users/:email", requireAdmin, async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const result = await users.deleteOne({ email });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ ok: true, message: "User deleted" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// DELETE /api/admin/leaderboard - clear all users from leaderboard
app.delete("/api/admin/leaderboard", requireAdmin, async (req, res) => {
  try {
    const result = await users.deleteMany({});
    res.json({ ok: true, message: `Cleared ${result.deletedCount} users` });
  } catch (err) {
    console.error("Clear leaderboard error:", err);
    res.status(500).json({ error: "Failed to clear leaderboard" });
  }
});

// POST /api/admin/users - add or update user with name, email, and score
app.post("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const { name, email, score } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name required" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email required" });
    }
    if (typeof score !== "number" || score < 0) {
      return res.status(400).json({ error: "Invalid score" });
    }
    const result = await users.findOneAndUpdate(
      { email: email.trim() },
      {
        $set: {
          name: name.trim(),
          score,
        },
        $setOnInsert: {
          email: email.trim(),
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    res.json({ ok: true, user: result });
  } catch (err) {
    console.error("Add user error:", err);
    res.status(500).json({ error: "Failed to add user" });
  }
});

// PUT /api/admin/users/:email - update user score
app.put("/api/admin/users/:email", requireAdmin, async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const { score } = req.body;
    if (typeof score !== "number" || score < 0) {
      return res.status(400).json({ error: "Invalid score" });
    }
    const result = await users.findOneAndUpdate(
      { email },
      { $set: { score } },
      { returnDocument: "after" }
    );
    if (!result) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ ok: true, user: result });
  } catch (err) {
    console.error("Update user score error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// GET /api/admin/admins - get all admin emails
app.get("/api/admin/admins", requireAdmin, async (req, res) => {
  try {
    const adminList = await admins.find({}).toArray();
    res.json(adminList);
  } catch (err) {
    console.error("Fetch admins error:", err);
    res.status(500).json({ error: "Failed to fetch admins" });
  }
});

// POST /api/admin/admins - add a new admin email
app.post("/api/admin/admins", requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email required" });
    }
    
    const trimmedEmail = email.trim().toLowerCase();
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const result = await admins.updateOne(
      { email: trimmedEmail },
      { $setOnInsert: { email: trimmedEmail, addedAt: new Date() } },
      { upsert: true }
    );

    if (result.upsertedId || result.modifiedCount === 0) {
      res.json({ ok: true, message: "Admin added successfully", email: trimmedEmail });
    } else {
      res.json({ ok: true, message: "Admin already exists", email: trimmedEmail });
    }
  } catch (err) {
    console.error("Add admin error:", err);
    res.status(500).json({ error: "Failed to add admin" });
  }
});

// DELETE /api/admin/admins/:email - remove an admin email
app.delete("/api/admin/admins/:email", requireAdmin, async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    
    // Prevent removing the base admin
    if (email === "sophyli@stanford.edu") {
      return res.status(400).json({ error: "Cannot remove the base admin" });
    }

    const result = await admins.deleteOne({ email });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }
    res.json({ ok: true, message: "Admin removed successfully" });
  } catch (err) {
    console.error("Remove admin error:", err);
    res.status(500).json({ error: "Failed to remove admin" });
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
