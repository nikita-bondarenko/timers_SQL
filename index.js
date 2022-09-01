require("dotenv").config();

const express = require("express");
const nunjucks = require("nunjucks");
const { nanoid } = require("nanoid");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const randomid = require("random-id");

const knex = require("knex")({
  client: "pg",
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
});

const findUserByUsername = async (username) =>
  knex("users")
    .select()
    .where({ username })
    .limit(1)
    .then((res) => res[0]);

const findUserBySessionId = async (sessionId) => {
  const session = await knex("sessions")
    .select("user_id")
    .where({ session_id: sessionId })
    .limit(1)
    .then((res) => res[0]);

  if (!session) {
    return;
  }

  return knex("users")
    .select()
    .where({ id: session.user_id })
    .limit(1)
    .then((res) => res[0]);
};

const findTimersByUserId = async (id) => {
  const timers = await knex("timers").select().where({ user_id: id });
  return timers;
};

const createSession = async (userId) => {
  const session_id = randomid();

  await knex("sessions").insert({
    user_id: userId,
    session_id,
  });

  return session_id;
};

const createUser = async ({ username, password }) => {
  await knex("users").insert({
    username,
    password,
  });
};

const createTimer = async (timer) => {
  await knex("timers").insert(timer);
};

const deleteSession = async (sessionId) => {
  await knex("sessions").where({ session_id: sessionId }).delete();
};

const app = express();

nunjucks.configure("views", {
  autoescape: true,
  express: app,
  tags: {
    blockStart: "[%",
    blockEnd: "%]",
    variableStart: "[[",
    variableEnd: "]]",
    commentStart: "[#",
    commentEnd: "#]",
  },
});

app.set("view engine", "njk");

app.use(express.json());
app.use(express.static("public"));

const hash = (d) => crypto.createHash("sha512").update(d).digest("hex");

app.use(cookieParser());

const auth = () => async (req, res, next) => {
  if (!req.cookies["sessionId"]) {
    return next();
  }
  const user = await findUserBySessionId(req.cookies["sessionId"]);
  req.user = user;
  req.sessionId = req.cookies["sessionId"];
  next();
};

app.post("/login", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  const { password, username } = req.body;
  const pswhash = hash(password);
  const user = await findUserByUsername(username);
  if (!!user && user.password === pswhash) {
    const sessionId = await createSession(user.id);
    res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/");
  } else {
    res.redirect("/?authError=true");
  }
});

app.post("/signup", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  const { password, username } = req.body;
  const user = await findUserByUsername(username);
  if (user) {
    res.redirect("/?signError=true");
    return;
  }
  const pswhash = hash(password);
  const body = { username, password: pswhash };
  createUser(body);
  res.redirect("/");
});

app.get("/", auth(), async (req, res) => {
  res.render("index", {
    user: req.user,
    authError: req.query.authError === "true" ? "Wrong username or password" : req.query.authError,
    signError: req.query.signError === "true" ? "User with this name is already exists" : req.query.signError,
  });
});

app.get("/logout", auth(), async (req, res) => {
  if (!req.user) {
    res.redirect("/");
  } else {
    await deleteSession(req.sessionId);
    res.clearCookie("sessionId").redirect("/");
  }
});

class Timer {
  constructor(req) {
    const description = req.body.description;
    const start = String(Date.now());
    const userId = req.user.id;
    return {
      user_id: userId,
      start,
      description,
      is_active: true,
      timer_id: nanoid(),
    };
  }
}

async function isAuthorized(req) {
  const sessionId = req.cookies.sessionId;
  const user = await findUserBySessionId(sessionId);
  return sessionId && user;
}

app.post("/api/timers", auth(), async (req, res) => {
  const isAuth = await isAuthorized(req);
  if (!isAuth) {
    return res.sendStatus(401);
  }
  const timer = new Timer(req);
  createTimer(timer);
  res.json({ id: timer.timer_id }).status(201);
});

app.get("/api/timers", auth(), async (req, res) => {
  const isAuth = await isAuthorized(req);
  if (!isAuth) {
    return res.sendStatus(401);
  }
  const userId = req.user.id;

  const timers = await findTimersByUserId(userId);
  const now = Date.now();
  // console.log("timers", timers);
  const soughtData = timers.reduce((arr, item) => {
    return String(item.is_active) === String(req.query.isActive)
      ? [
          ...arr,
          {
            ...item,
            progress: now - Number(item.start),
            start: Number(item.start),
            end: now,
            duration: now - Number(item.start),
          },
        ]
      : arr;
  }, []);

  res.status(200).json(soughtData);
});

app.post("/api/timers/:id/stop", async (req, res) => {
  const isAuth = await isAuthorized(req);
  if (!isAuth) {
    return res.sendStatus(401);
  }

  const isActive = await knex("timers")
    .where({ timer_id: req.params.id })
    .update("is_active", false)
    .returning("is_active")
    .then((res) => res[0].is_active);
  if (!isActive) {
    res.sendStatus(204);
  } else {
    res.sendStatus(500);
  }
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`  Listening on http://localhost:${port}`);
});
