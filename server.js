require("dotenv").config();

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { Pool } = require("pg");
const path = require("path");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const UAParser = require("ua-parser-js");

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const app = express();

const getCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    status: "too many requests",
  },
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
});

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

app.get("/sign_up", (req, res) => {
  res.sendFile(path.join(__dirname, "html_files", "signup.html"));
});

app.get("/passwort-aendern", (req, res) => {
  res.sendFile(path.join(__dirname, "html_files", "change-password.html"));
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

app.use("/api", async (req, res, next) => {
  const sessionid = req.cookies?.sessionID;

  if (!sessionid) {
    req.userid = null;
    return next();
  }

  const result = await db.query(
    "SELECT user_id FROM sessionIDs WHERE session_id = $1",
    [sessionid],
  );

  req.userid = result.rows[0]?.user_id ?? null;

  next();
});

app.get("/api/check_user", async (req, res) => {
  const userid = req.userid;

  if (!userid) return res.json({ failed: true });

  const user = await db.query(
    `
    SELECT id, username
    FROM users
    WHERE id = $1
    `,
    [userid],
  );

  if (user.rows.length === 0) {
    return res.json({ failed: true });
  }

  res.json(user.rows[0]);
});

app.post("/api/login", loginLimiter, async (req, res) => {
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
      const existingSession = await db.query(
        "SELECT 1 FROM sessionIDs WHERE user_id = $1",
        [user.id],
      );

      if (existingSession.rows.length > 0) {
        await db.query(
          "UPDATE sessionIDs SET session_id = $1 WHERE user_id = $2",
          [sessionid, user.id],
        );
      } else {
        await db.query(
          "INSERT INTO sessionIDs (session_id, user_id) VALUES ($1, $2)",
          [sessionid, user.id],
        );
      }

      res.cookie("sessionID", sessionid, {
        ...getCookieOptions(),
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
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
      return res.json({ status: "error" });
    }
  }
});

app.post("/api/signup", async (req, res) => {
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
    ...getCookieOptions(),
    maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
  });

  res.json({
    status: "ok",
  });
});

app.post("/api/changePassword", loginLimiter, async (req, res) => {
  const user_id = req.userid;
  if (!user_id)
    return res.json({
      status: "no accound",
    });

  const oldPassword =
    typeof req.body?.oldPassword === "string" ? req.body.oldPassword : "";
  const newPassword =
    typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!oldPassword || !newPassword) {
    return res.json({
      status: "invalid",
    });
  }

  const user = await db.query("SELECT password FROM users WHERE id = $1", [
    user_id,
  ]);

  if (user.rows.length === 0) {
    return res.json({
      status: "no accound",
    });
  }

  const right = await bcrypt.compare(oldPassword, user.rows[0].password);

  if (!right)
    return res.json({
      status: "incorect password",
    });

  if (oldPassword === newPassword) {
    return res.json({
      status: "same password",
    });
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  try {
    await db.query("UPDATE users SET password = $1 WHERE id = $2", [
      newHash,
      user_id,
    ]);
  } catch (error) {
    console.error(error);
    return res.json({
      status: "error",
      error: error,
    });
  }
  res.json({
    status: "ok",
  });
});

app.get("/api/logout", async (req, res) => {
  const sessionid = req.cookies?.sessionID;

  if (sessionid) {
    try {
      await db.query("DELETE FROM sessionIDs WHERE session_id = $1", [
        sessionid,
      ]);
    } catch (error) {
      console.error(error);
    }
  }

  res.clearCookie("sessionID", getCookieOptions());

  if (sessionid) {
    return res.json({
      status: "ok",
    });
  }

  res.json({
    status: "failed",
  });
});

app.delete("/api/delete_user", async (req, res) => {
  const userid = req.userid;

  if (!userid) {
    return res.json({
      status: "not found",
    });
  }

  const user = await db.query(
    `
    SELECT * 
    FROM users
    WHERE id = $1`,
    [userid],
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
    WHERE owner_id = $1
    `,
    [userid],
  );

  const deleted = await db.query(
    `
    DELETE FROM users
    WHERE id = $1
    RETURNING id
    `,
    [userid],
  );

  if (deleted.rows.length === 0) {
    return res.json({
      status: "not found",
    });
  }

  res.clearCookie("sessionID", getCookieOptions());

  res.json({
    status: "ok",
  });
});

app.post("/api/creatematch", async (req, res) => {
  const ownerid = req.userid;
  if (!ownerid) {
    return res.json({
      status: "no accound",
    });
  }

  let code = null;

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
  const ownerid = req.userid;
  const pageUrl = req.get("X-page-URL");

  if (!pageUrl) {
    return res.json({
      status: "no match",
    });
  }

  const matchcode = pageUrl.split("/")[2];

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
  const user_id = req.userid;
  const pageUrl = req.get("X-page-URL");

  if (!user_id) {
    return res.json({
      status: "no accound",
    });
  }

  if (!pageUrl) {
    return res.json({
      status: "no match",
    });
  }

  const matchcode = pageUrl.split("/")[2];

  const match = await db.query(
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

  if (match.rows.length == 0)
    return res.json({
      status: "no match",
    });

  updateViewers(match.rows[0]);

  res.json({
    status: "ok",
  });
});

app.get("/api/match_return", async (req, res) => {
  const userid = req.userid;
  const pageUrl = req.get("X-page-URL");

  if (!pageUrl) {
    return res.json({
      status: "no match",
    });
  }

  const matchcode = pageUrl.split("/")[2];
  if (!userid) {
    return res.json({
      status: "no accound",
    });
  }
  const result = await db.query(
    `
    SELECT *
    FROM matches
    WHERE owner_id = $1 AND matches.code = $2
    `,
    [userid, matchcode],
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
  const status = req.body.status;

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
      const userid = req.userid;
      if (!userid) {
        return res.json({
          status: "no accound",
        });
      }

      output_ids.push(userid);
    }
  }
  if (output_ids.length == 0) {
    return res.json({
      status: "no match",
    });
  }
  let matches;
  if (status === "all") {
    matches = await db.query(
      `
      SELECT matches.*, users.username 
      FROM matches
      JOIN users
      ON matches.owner_id = users.id
      WHERE matches.owner_id = ANY($1) ORDER BY matches.created_at DESC
      `,
      [output_ids],
    );
  } else if (status) {
    matches = await db.query(
      `
      SELECT matches.*, users.username 
      FROM matches
      JOIN users
      ON matches.owner_id = users.id
      WHERE matches.owner_id = ANY($1) 
      AND matches.status = $2
      ORDER BY matches.created_at DESC
      `,
      [output_ids, status],
    );
  } else {
    return res.json({
      status: "invalid",
    });
  }

  if (matches.rows.length == 0) {
    return res.json({
      status: "no match",
    });
  }

  const matchoutput = matches.rows;

  matchoutput.forEach((match) => {
    if (match.owner_id == req.userid) {
      match.username = "du";
    }
  });

  res.json({
    status: "ok",
    matches: matches.rows,
  });
});

app.get("/api/getUsersByName/:name", async (req, res) => {
  const name = req.params.name;
  const userid = req.userid;

  if (!userid) {
    return res.json({
      status: "no accound",
    });
  }

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

  await Promise.all(
    users.rows.map(async (user) => {
      user.friendstatus = await getFriendStatus(user.id);
    }),
  );

  res.json({
    status: "ok",
    users: users.rows,
  });

  async function getFriendStatus(id) {
    const result = await db.query(
      `
      SELECT * 
      FROM friends
      WHERE (user_id = $1 AND friend_id = $2)
      OR (friend_id = $1 AND user_id = $2)`,
      [id, userid],
    );

    if (result.rows.length == 0) return "no friend";

    const friend = result.rows[0];

    if (friend.status == "pending") {
      if (friend.user_id == id) {
        return "his request";
      } else {
        return "my request";
      }
    } else {
      return "friend";
    }
  }
});

app.post("/api/addfriend", async (req, res) => {
  const userid = req.userid;
  const friendid = req.body?.friendID;

  if (!friendid) {
    return res.json({
      status: "invalid",
    });
  }

  if (!userid) {
    return res.json({
      status: "no accound",
    });
  }

  try {
    await db.query(
      `
    INSERT INTO 
    friends(user_id, friend_id)
    VALUES($1, $2)
    `,
      [userid, friendid],
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
  const userid = req.userid;

  if (!userid) {
    return res.json({
      status: "no accound",
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
    [userid],
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

app.post("/api/confirmFriend", async (req, res) => {
  const userid = req.userid;
  const friendid = req.body.friend_id;

  if (!friendid)
    return res.json({
      status: "invalid",
    });

  if (!userid)
    return res.json({
      status: "no accound",
    });

  const result = await db.query(
    `
    UPDATE friends
    SET status = 'accepted'
    WHERE user_id = $1
    AND friend_id = $2
    AND status = 'pending'
    RETURNING *
    `,
    [friendid, userid],
  );

  if (result.rows.length == 0)
    return res.json({
      status: "not found",
    });

  res.json({
    status: "ok",
  });
});

app.get("/api/getFriends/:type", async (req, res) => {
  const userid = req.userid;
  const type = req.params.type;

  if (!userid)
    return res.json({
      status: "no accound",
    });

  const result = await db.query(
    `
    SELECT
    CASE
    WHEN user_id = $1 THEN friend_id
    ELSE user_id
    END AS friend_id
    FROM friends
    WHERE (user_id = $1 OR friend_id = $1)
    AND status = 'accepted'
    `,
    [userid],
  );

  if (result.rows.length == 0)
    return res.json({
      status: "no friend",
    });

  const friendids = result.rows.map((row) => row.friend_id);

  if (type == "name") {
    const friends = await db.query(
      `
      SELECT id, username
      FROM users
      WHERE id = ANY($1) 
      `,
      [friendids],
    );

    res.json({
      status: "ok",
      friends: friends.rows,
    });
  } else if (type == "id") {
    res.json({
      status: "ok",
      friend_ids: friendids,
    });
  } else {
    res.json({
      status: "invalid",
    });
  }
});

app.get("/api/getMyFriendreq", async (req, res) => {
  const user_id = req.userid;
  if (!user_id)
    return res.json({
      status: "no accound",
    });

  const friendreq = await db.query(
    `SELECT users.id, users.username
    FROM users
    JOIN friends
    ON users.id = friends.friend_id
    WHERE friends.user_id = $1
    AND friends.status = 'pending'`,
    [user_id],
  );

  res.json({
    status: "ok",
    req: friendreq.rows,
  });
});

app.delete("/api/deleteFriend/:id", async (req, res) => {
  const userid = req.userid;
  const friendid = req.params.id;

  if (!userid)
    return res.json({
      status: "no accound",
    });

  const result = await db.query(
    `
    DELETE FROM friends
    WHERE (user_id = $1 AND friend_id = $2)
    OR (friend_id = $1 AND user_id = $2)
    RETURNING *`,
    [userid, friendid],
  );

  if (result.rows.length == 0)
    return res.json({
      status: "not found",
    });

  res.json({
    status: "ok",
  });
});

app.post("/api/favoritNames", async (req, res) => {
  const user_id = req.userid;
  if (!user_id)
    return res.json({
      status: "no accound",
    });

  const name = String(req.body.name || "").trim();
  if (!name)
    return res.json({
      status: "invalid",
    });

  const user = await db.query(
    `
    UPDATE users
    SET settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{favoritNames}',
      COALESCE((settings->'favoritNames')::jsonb, '[]'::jsonb) || jsonb_build_array($2::text)
    )
    WHERE id = $1
    AND NOT (COALESCE((settings->'favoritNames')::jsonb, '[]'::jsonb) @> jsonb_build_array($2::text))
    RETURNING *`,
    [user_id, name],
  );

  if (user.rows.length == 0)
    return res.json({
      status: "failed",
    });

  res.json({
    status: "ok",
  });
});

app.get("/api/favoritNames", async (req, res) => {
  const user_id = req.userid;
  if (!user_id)
    return res.json({
      status: "no accound",
    });

  const names = await db.query(
    `
    SELECT COALESCE(
      (
        SELECT jsonb_agg(value)
        FROM jsonb_array_elements_text(COALESCE(settings->'favoritNames', '[]'::jsonb)) AS value
      ),
      '[]'::jsonb
    ) AS names
    FROM users
    WHERE id = $1`,
    [user_id],
  );

  if (names.rows.length == 0)
    return res.json({
      status: "no name",
    });

  res.json({
    status: "ok",
    names: names.rows[0]?.names ?? [],
  });
});

app.delete("/api/favoritNames", async (req, res) => {
  const user_id = req.userid;
  if (!user_id)
    return res.json({
      status: "no accound",
    });
  const name = req.body.name;
  if (!name)
    return res.json({
      status: "invalid",
    });

  const user = await db.query(
    `
    UPDATE users
    SET settings = jsonb_set(
      settings,
      '{favoritNames}',
      COALESCE(
        (
          SELECT jsonb_agg(value)
          FROM jsonb_array_elements_text(settings->'favoritNames') AS value
          WHERE value <> $2
        ),
        '[]'::jsonb
      )
    )
    WHERE id = $1
    RETURNING *;`,
    [user_id, name],
  );
  if (user.rows.length == 0)
    return res.json({
      status: "not found",
    });

  res.json({
    status: "ok",
  });
});

app.get("/api/getUsernameById/:id", async (req, res) => {
  const id = req.params.id;
  const user = await db.query("SELECT username FROM users WHERE id = $1", [id]);
  if (user.rows.length == 0)
    return res.json({
      status: "not found",
    });
  res.json({
    status: "ok",
    username: user.rows[0].username,
  });
});

app.post("/api/searchMatch", async (req, res) => {
  const searchtext = req.body;
  const userid = req.userid;

  if (!userid)
    return res.json({
      status: "no accound",
    });

  const friends = await db.query(
    `
    SELECT
    CASE
    WHEN user_id = $1 THEN friend_id
    ELSE user_id
    END AS friend_id
    FROM friends
    WHERE (user_id = $1 OR friend_id = $1)
    AND status = 'accepted'
    `,
    [userid],
  );

  const friend_ids = friends.rows.map((row) => row.friend_id);

  friend_ids.push(userid);

  const matches = await db.query(
    `
    SELECT matches.*, users.username
    FROM matches 
    JOIN users ON matches.owner_id = users.id
    WHERE (users.id = ANY($2)
    AND (matches.data->>'player1' ILIKE '%' || $1 || '%'
    OR matches.data->>'player2' ILIKE '%' || $1 || '%'
    OR matches.data->>'tournament' ILIKE '%' || $1 || '%'
    OR users.username = $1))
    OR matches.code = $1
    ORDER BY matches.created_at DESC`,
    [searchtext, friend_ids],
  );
  if (matches.rows.length == 0) {
    return res.json({
      status: "no match",
    });
  }
  matches.rows.forEach((match) => {
    if (match.owner_id == userid) {
      match.my = true;
    } else {
      match.my = false;
    }
  });
  res.json({
    status: "ok",
    matches: matches.rows,
  });
});

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const wss = new WebSocket.Server({
  server,
});

let matchviewers = [];

wss.on("connection", (socket) => {
  console.log("WebSocket verbunden");

  socket.on("message", async (message) => {
    const { type, data } = JSON.parse(message.toString());
    if (type === "loginViewer") {
      matchviewers.push({
        matchcode: data.matchcode,
        ws: socket,
      });

      const match = await db.query("SELECT * FROM matches WHERE code = $1", [
        data.matchcode,
      ]);

      socket.send(
        JSON.stringify({
          type: "getmatchData",
          data: {
            matchsettings: match.rows[0],
          },
        }),
      );
    }
  });

  socket.on("close", () => {
    console.log("WebSocket getrennt");

    matchviewers = matchviewers.filter((viewer) => viewer.ws !== socket);
  });
});

function updateViewers(matchsettings) {
  const viewers = matchviewers.filter(
    (v) => v.matchcode === matchsettings.code,
  );

  viewers.forEach((viewer) => {
    viewer.ws.send(
      JSON.stringify({
        type: "updateMatch",
        data: {
          matchsettings: matchsettings,
        },
      }),
    );
  });
}

server.listen(PORT, () => {
  console.log("server läuft auf port:" + PORT);
});
