const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const geolib = require('geolib');

const DB_PATH = path.resolve(__dirname, "info.db");
const saltRounds = 10;
const JWT_SECRET = process.env.TOKEN;

let db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("connected to sqlite db");
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL UNIQUE
    )`);
  db.run(`CREATE TABLE IF NOT EXISTS doctors (
    id TEXT PRIMARY KEY,
    jobTitle TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    isAvailable BOOLEAN NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL UNIQUE
    )`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    timestamp INTEGER NOT NULL
    )`);
});

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  for (let key in req.body)
    if (req.body[key])
      req.body[key] = String(req.body[key]).trim()
  next();
});

const authJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log("jwt error\n");
            console.log(err);
            res.status(401).end("Unauthorized");
            return;
        }
        req.user = user;
        next();
    });
  }
  else {
    res.status(401).end("Unauthorized");
  }
};

app.post('/addAccount', (req, res) => {
  const id = uuidv4();

  if (
    !req.body.name ||
    !req.body.email ||
    !req.body.phone
  ) {
    res.status(422).end("Invalid POST body");
    return;
  }

  bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
    if (err) {
      console.log("bcrypt error");
      res.status(500).end("Internal Server Error");
      return;
    }
    const stmt = db.prepare("INSERT INTO accounts (id, name, password, email, phone) VALUES (?, ?, ?, ?, ?)");
    stmt.run([
      id,
      req.body.name,
      hash,
      req.body.email,
      req.body.phone
    ], (err) => {
      if (err) {
        if (err.message.includes("accounts.email"))
          res.status(422).end("This email already exists.");
        else if (err.message.includes("accounts.phone"))
          res.status(422).end("This phone number already exists.");
        else 
          res.status(500).end("Internal Server Error");
      }
      else {
        const authToken = jwt.sign({ id, email: req.body.email }, JWT_SECRET);
        res.status(200).end(JSON.stringify({ authToken }));
      }
    });
  });
});

app.post('/addDoctor', (req, res) => {
  if (
    !req.body.jobTitle ||
    !req.body.latitude ||
    !req.body.longitude ||
    !req.body.isAvailable ||
    !req.body.email ||
    !req.body.phone ||
    !parseFloat(req.body.latitude) ||
    !parseFloat(req.body.longitude) ||
    !(req.body.isAvailable === 'true' || req.body.isAvailable === 'false')
  ) {
    res.status(422).end("Invalid POST body");
    return;
  }

  const id = uuidv4();

  const stmt = db.prepare("INSERT INTO doctors (id, jobTitle, latitude, longitude, isAvailable, email, phone) VALUES (?, ?, ?, ?, ? ,?, ?)");
  stmt.run([
    id,
    req.body.jobTitle,
    parseFloat(req.body.latitude),
    parseFloat(req.body.longitude),
    req.body.isAvailable === 'true',
    req.body.email,
    req.body.phone
  ], (err) => {
    if (err) {
      if (err.message.includes("accounts.email"))
        res.status(422).end("This email already exists.");
      if (err.message.includes("accounts.phone"))
        res.status(422).end("This phone number already exists.");
      else
        res.status(500).end("Internal Server Error");
    }
    else {
      res.status(200).end("Success");
    }
  });
});

app.post('/getDoctor', authJWT, (req, res) => {
  if (
    !req.body.id
  ) {
    res.status(422).end("Invalid POST body");
    return;
  }

  const stmt = db.prepare("SELECT id, jobTitle, latitude, longitude, isAvailable, email, phone FROM doctors WHERE id = ?");
  stmt.get([
      req.body.id.trim()
  ], (err, row) => {
    if (err) res.status(500).end("Internal Server Error");
    else if (row) {
      res.status(200).end(JSON.stringify(row));
    }
    else {
      res.status(422).end("Doctor ID Not Found");
    }
  });
});

app.post('/getDoctorsNearMe', authJWT, (req, res) => {
  if (
    !req.body.latitude ||
    !req.body.longitude ||
    !req.body.distance ||
    !parseFloat(req.body.latitude) ||
    !parseFloat(req.body.longitude) ||
    !parseInt(req.body.distance)
  ) {
    res.status(422).end("Invalid POST body");
    return;
  }

  const stmt = db.prepare("SELECT id, jobTitle, latitude, longitude, isAvailable, email, phone FROM doctors");
  stmt.all((err, rows) => {
    if (err) res.status(500).end("Internal Server Error");
    const nearbyDoctors = rows.map((row) => {
      return { 
        ...row,
        distance: geolib.getPreciseDistance(
          { latitude: parseFloat(req.body.latitude), longitude: parseFloat(req.body.longitude) },
          { latitude: row.latitude, longitude: row.longitude }
        ) / 1609.34,
      }
    }).filter((row) => {
      return row.distance < parseInt(req.body.distance);
    }).sort((a, b) => {
      return a.distance - b.distance;
    });
    res.status(200).end(JSON.stringify(nearbyDoctors));
  });
});

app.post('/getConversation', authJWT, (req, res) => {
  if (
    !req.body.id
  ) {
    res.status(422).end("Invalid POST body");
    return;
  }

  const stmt = db.prepare("SELECT sender, receiver FROM messages WHERE sender = ? OR receiver = ?");
  stmt.all([
    req.user.id,
    req.user.id
  ], (err, rows) => {
    if (err) res.status(500).end("Internal Server Error");
    else if (rows) {
      const conversations = [ ...new Set(rows.map(row => (req.user.id === row.sender ? row.receiver : row.sender))) ];
      res.status(200).end(JSON.stringify(conversations));
    }
  });
});

app.post('/sendMessage', authJWT, (req, res) => {
  if (
    !req.body.content ||
    !req.body.receiver
  ) {
    res.status(422).end("Invalid POST body");
    return;
  }

  const id = uuidv4();

  const stmt = db.prepare("INSERT INTO messages (id, content, sender, receiver, timestamp) VALUES (?, ?, ?, ?, strftime('%s', 'now'))");
  stmt.run([
    id,
    req.body.content,
    req.user.id,
    req.body.receiver
  ], (err) => {
    if (err) res.status(500).end("Internal Server Error");
    else res.status(200).end("Success");
  });
}); 

app.post('/getMessage', authJWT, (req, res) => {
  if (
    !req.body.participant
  ) {
    res.status(422).end("Invalid POST body");
    return;
  }

  const stmt = db.prepare("SELECT id, content, sender, receiver, timestamp FROM messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) ORDER BY timestamp DESC");
  stmt.all([
    req.user.id,
    req.body.participant,
    req.body.participant,
    req.user.id
  ], (err, rows) => {
    if (err) res.status(500).end("Internal Server Error");
    else if (rows) {
      res.status(200).end(JSON.stringify(rows));
    }
    else {
      res.status(404).end("Message Not Found");
    }
  });
})

app.post('/userLogin', (req, res) => {
  if (
    !req.body.email ||
    !req.body.password
  ) {
    res.status(422).end("Invalid POST body");
    return;
  }

  const stmt = db.prepare("SELECT id, password FROM accounts WHERE email = (?)");
  stmt.get([
    req.body.email
  ], (err, row) => {
    if (err) {
      res.status(500).end("Internal Server Error");
    }
    if (!row) {
      res.status(400).end("Incorrect email or password");
    }
    else {
      hash = row.password;
      bcrypt.compare(req.body.password, hash, (err, result) => {
        if (err) {
          throw err;
        }
        if (result) {
          const authToken = jwt.sign({ id: row.id, email: row.email }, JWT_SECRET);
          res.status(200).end(JSON.stringify({ authToken }));
        }
        else
          res.status(422).end("Incorrect email or password");
      });
    }
  });
});

process.on('exit', () => {
  db.close((err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log("close db connection");
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));
