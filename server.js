require("dotenv").config();

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { Pool } = require("pg");
const path = require("path");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const app = express();

app.use(express.json());

app.use(express.text());

app.use(cookieParser());

app.use(express.urlencoded({ extended: true }));

app.use("/public", express.static("public"));

app.get("/", (req, res) => {
  res.redirect("/startseite?page=startseite");
});

app.get("/startseite", (req, res) => {
  res.sendFile(path.join(__dirname, "html_files", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "html_files", "login.html"));
});

app.get("/sign_in", (req, res) => {
  res.sendFile(path.join(__dirname, "html_files", "signin.html"));
});

app.get("/match/:code", async (req, res) => {
  const sessionid = req.cookies?.sessionID;
  const code = req.params.code;
  if (!sessionid) {
    return res.redirect("/login");
  }
  const result = await db.query(
    `SELECT * 
    FROM sessionIDs
    JOIN matches
    ON sessionIDs.user_id = matches.owner_id
    WHERE sessionIDs.session_id = $1 AND matches.code = $2`,
    [sessionid, code],
  );

  if (result.rows.length === 0) {
    return res.redirect("/startseite");
  }
  res.sendFile(path.join(__dirname, "html_files", "match.html"));
});

app.get("/view_match", (req, res) => {
  res.sendFile(path.join(__dirname, "html_files", "view_match.html"));
});

app.get("/api/check_user", async (req, res) => {
  const sessionid = req.cookies?.sessionID;

  if (!sessionid) return res.json({ failed: true });

  const user = await db.query(
    `
    SELECT users.id, users.username
    FROM sessionIDs
    JOIN users
    ON users.id = sessionIDs.user_id
    WHERE sessionIDs.session_id = $1
    `,
    [sessionid],
  );

  if (user.rows.length === 0) {
    return res.json({ failed: true });
  }

  res.json(user.rows[0]);
});

app.post("/api/login", async (req, res) => {
  const message = req.body;

  const result = await db.query("SELECT * FROM users WHERE username = $1", [
    message.username,
  ]);

  if (result.rows.length <= 0) {
    return res.json({
      status: "not found",
    });
  }

  const user = result.rows[0];

  const right = await bcrypt.compare(message.password, user.password);

  if (!right) {
    return res.json({
      status: "incorect password",
    });
  }

  let sessionid = null;

  while (true) {
    sessionid = crypto.randomBytes(32).toString("hex");

    try {
      await db.query(
        "UPDATE sessionIDs SET session_id = $1 WHERE user_id = $2",
        [sessionid, user.id],
      );

      res.cookie("sessionID", sessionid, {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      });

      res.json({
        status: "ok",
      });

      break;
    } catch (error) {
      if (error.code == "23505") {
        continue;
      }

      console.error(error);
    }
  }
});

app.post("/api/signin", async (req, res) => {
  const message = req.body;

  const user = await db.query("SELECT id FROM users WHERE username = $1", [
    message.username,
  ]);

  if (user.rows.length > 0) {
    return res.json({
      status: "user exists",
    });
  }

  const hashedPassword = await bcrypt.hash(message.password, 10);

  const newUser = await db.query(
    "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
    [message.username, hashedPassword],
  );

  let sessionId = null;

  while (true) {
    sessionId = crypto.randomBytes(32).toString("hex");

    try {
      await db.query(
        "INSERT INTO sessionIDs (session_id, user_id) VALUES ($1, $2)",
        [sessionId, newUser.rows[0].id],
      );

      break;
    } catch (error) {
      if (error.code == "23505") {
        continue;
      }

      throw error;
    }
  }

  res.cookie("sessionID", sessionId, {
    maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });

  res.json({
    status: "ok",
  });
});

app.get("/api/logout", (req, res) => {
  if (req.cookies?.sessionID) {
    res.clearCookie("sessionID");
    res.json({
      status: "ok",
    });
  } else {
    res.json({
      status: "failed",
    });
  }
});

app.delete("/api/delete_user", async (req, res) => {
  const sessionid = req.cookies?.sessionID;

  if (!sessionid) {
    return res.json({
      status: "not found",
    });
  }

  const user = await db.query(
    `
    SELECT * 
    FROM users
    WHERE id = (
        SELECT user_id
        FROM sessionIDs
        WHERE session_id = $1
    )`,
    [sessionid],
  );

  const password_correct = await bcrypt.compare(
    req.body.password,
    user.rows[0].password,
  );

  if (!password_correct) {
    return res.json({
      status: "incorect password",
    });
  }

  await db.query(
    `
    DELETE FROM matches
    WHERE owner_id = (
        SELECT user_id
        FROM sessionIDs
        WHERE session_id = $1
    )
    `,
    [sessionid],
  );

  const deleted = await db.query(
    `
    DELETE FROM users
    WHERE id = (
        SELECT user_id
        FROM sessionIDs
        WHERE session_id = $1
    )
    RETURNING id
    `,
    [sessionid],
  );

  if (deleted.rows.length === 0) {
    return res.json({
      status: "not found",
    });
  }

  res.clearCookie("sessionID");

  res.json({
    status: "ok",
  });
});

app.post("/api/creatematch", async (req, res) => {
  const sessionid = req.cookies?.sessionID;
  if (!sessionid) {
    return res.json({
      status: "no user",
    });
  }
  const result = await db.query(
    "SELECT user_id FROM sessionIDs WHERE session_id = $1",
    [sessionid],
  );

  if (result.rows.length === 0) {
    return res.json({
      status: "no user",
    });
  }

  let code = null;
  const ownerid = result.rows[0].user_id;

  while (true) {
    try {
      code = crypto.randomBytes(4).toString("hex");
      await db.query(
        `
      INSERT INTO matches (code, status, data, course, points, owner_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          code,
          "created",
          req.body,
          [],
          {
            sets: [[0, 0]],
            set_win: [0, 0],
            points: [0, 0],
            tiebrake: [0, 0],
            server: req.body.beginner,
            championstiebrake: false,
          },
          ownerid,
        ],
      );
      return res.json({
        code: code,
        status: "ok",
      });
    } catch (error) {
      if (error.code == "23505") {
        continue;
      }

      throw error;
    }
  }
});

app.get("/api/getmatchdata", async (req, res) => {
  const sessionid = req.cookies?.sessionID;
  const pageUrl = req.get("X-page-URL");

  if (!pageUrl) {
    return res.json({
      status: "no match",
    });
  }

  const matchcode = pageUrl.split("/")[2];
  if (!sessionid) {
    return res.json({
      status: "no user",
    });
  }
  const result = await db.query(
    "SELECT user_id FROM sessionIDs WHERE session_id = $1",
    [sessionid],
  );

  if (result.rows.length === 0) {
    return res.json({
      status: "no user",
    });
  }

  const ownerid = result.rows[0].user_id;

  const match = await db.query(
    "SELECT * FROM matches WHERE code = $1 AND owner_id = $2",
    [matchcode, ownerid],
  );

  if (match.rows.length === 0) {
    return res.json({
      status: "no match",
    });
  }

  return res.json({
    status: "ok",
    match: match.rows[0],
  });
});

app.post("/api/updatematch", async (req, res) => {
  const sessionid = req.cookies?.sessionID;
  const pageUrl = req.get("X-page-URL");

  if (!sessionid) {
    return res.json({
      status: "no user",
    });
  }

  if (!pageUrl) {
    return res.json({
      status: "no match",
    });
  }

  const matchcode = pageUrl.split("/")[2];

  const result = await db.query(
    "SELECT user_id FROM sessionIDs WHERE session_id = $1",
    [sessionid],
  );

  if (result.rows.length === 0) {
    return res.json({
      status: "no user",
    });
  }

  const user_id = result.rows[0].user_id;

  let match = null;

  await db.query(
    `
    UPDATE matches
    SET status = $1,
        points = $2,
        course = $3
    WHERE code = $4
    AND owner_id = $5
    RETURNING *
    `,
    [
      req.body.status,
      req.body.points,
      JSON.stringify(req.body.course),
      matchcode,
      user_id,
    ],
  );

  res.json({
    status: "ok",
  });
});

app.get("/api/match_return", async (req, res) => {
  const sessionid = req.cookies?.sessionID;
  const pageUrl = req.get("X-page-URL");

  if (!pageUrl) {
    return res.json({
      status: "no match",
    });
  }

  const matchcode = pageUrl.split("/")[2];
  if (!sessionid) {
    return res.json({
      status: "no user",
    });
  }
  const result = await db.query(
    `
    SELECT matches.*
    FROM sessionIDs
    JOIN matches
    ON sessionIDs.user_id = matches.owner_id
    WHERE sessionIDs.session_id = $1 AND matches.code = $2
    `,
    [sessionid, matchcode],
  );

  if (result.rows.length === 0) {
    return res.json({
      failed: true,
    });
  }

  const courseArray = result.rows[0].course;

  if (courseArray.length === 0 || !courseArray.length) {
    return res.json({
      failed: true,
    });
  }

  const course = courseArray[courseArray.length - 1];

  courseArray.pop();

  const match = await db.query(
    `
    UPDATE matches
    SET points = $1,
        status = $2,
        course = $3
    WHERE code = $4
    AND owner_id = $5
    RETURNING *`,
    [
      JSON.stringify(course.points),
      course.status,
      JSON.stringify(courseArray),
      matchcode,
      result.rows[0].owner_id,
    ],
  );

  if (match.rows.length === 0) {
    return res.json({
      failed: true,
    });
  }

  res.json(match.rows[0]);
});

app.post("/api/getmatches", async (req, res) => {
  const user_ids = req.body.user_ids;

  if (!Array.isArray(req.body.user_ids)) {
    return res.json({
      status: "invalid",
    });
  }

  let output_ids = [];
  for (const id of user_ids) {
    if (typeof id === "number") {
      output_ids.push(id);
    } else if (id == "my_id") {
      const sessionid = req.cookies?.sessionID;
      if (!sessionid) {
        return res.json({
          status: "no user",
        });
      }

      const my_id = await db.query(
        "SELECT user_id FROM sessionIDs WHERE session_id = $1",
        [sessionid],
      );

      if (my_id.rows.length == 0) {
        return res.json({
          status: "no user",
        });
      }
      output_ids.push(my_id.rows[0].user_id);
    }
  }
  if (output_ids.length == 0) {
    return res.json({
      status: "no match",
    });
  }
  const matches = await db.query(
    "SELECT * FROM matches WHERE owner_id = ANY($1) ORDER BY created_at DESC",
    [output_ids],
  );

  if (matches.rows.length == 0) {
    return res.json({
      status: "no match",
    });
  }

  res.json({
    status: "ok",
    matches: matches.rows,
  });
});

app.get("/api/getUsersByName/:name", async (req, res) => {
  const name = req.params.name;
  const sessionid = req.cookies.sessionID;

  if (!sessionid) {
    return res.json({
      status: "no user",
    });
  }

  const user = await db.query(
    "SELECT user_id FROM sessionIDs WHERE session_id = $1",
    [sessionid],
  );

  if (user.rows.length == 0) {
    return res.json({
      status: "no user",
    });
  }

  const userid = user.rows[0].user_id;

  const users = await db.query(
    `
    SELECT id, username FROM users
    WHERE username ILIKE $1
    AND id != $2
    `,
    [name + "%", userid],
  );

  if (users.rows.length == 0) {
    return res.json({
      status: "no users",
    });
  }

  res.json({
    status: "ok",
    users: users.rows,
  });
});

app.post("/api/addfriend", async (req, res) => {
  const sessionid = req.cookies?.sessionID;
  const friendid = req.body?.friendID;

  if (!friendid) {
    return res.json({
      status: "invalid",
    });
  }

  if (!sessionid) {
    return res.json({
      status: "no user",
    });
  }

  const user = await db.query(
    "SELECT user_id FROM sessionIDs WHERE session_id = $1",
    [sessionid],
  );

  if (user.rows.length == 0) {
    return res.json({
      status: "no user",
    });
  }

  try {
    await db.query(
      `
    INSERT INTO 
    friends(user_id, friend_id)
    VALUES($1, $2)
    `,
      [user.rows[0].user_id, friendid],
    );
  } catch (error) {
    console.error(error);
    return res.json({
      status: "invalid",
    });
  }
  res.json({
    status: "ok",
  });
});

app.get("/api/getfriendreq", async (req, res) => {
  const sessionid = req.cookies?.sessionID;

  if (!sessionid) {
    return res.json({
      status: "no user",
    });
  }

  const user = await db.query(
    "SELECT user_id FROM sessionIDs WHERE session_id = $1",
    [sessionid],
  );

  if (user.rows.length === 0) {
    return res.json({
      status: "no user",
    });
  }

  const result = await db.query(
    `
    SELECT u.username, u.id 
    FROM friends f
    JOIN users u
    ON u.id = f.user_id
    WHERE f.friend_id = $1 
    AND f.status = 'pending'
    ORDER BY u.username
    `,
    [user.rows[0].user_id],
  );

  if (result.rows.length == 0) {
    return res.json({
      status: "no friend",
    });
  }

  res.json({
    status: "ok",
    requests: result.rows,
  });
});

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const wss = new WebSocket.Server({
  server,
});

wss.on("connection", (socket) => {
  console.log("WebSocket verbunden");

  socket.on("message", (message) => {});

  socket.on("close", () => {
    console.log("WebSocket getrennt");
  });
});

server.listen(PORT, () => {
  console.log("server läuft auf port:" + PORT);
});
