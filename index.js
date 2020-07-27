const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
    latitude INTEGER NOT NULL,
    longitude INTEGER NOT NULL,
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

  bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
    if (err) {
      console.log("bcrypt error");
      res.status(500).end("Internal Server Error");
      return;
    }
    const stmt = db.prepare("INSERT INTO accounts (id, name, password, email, phone) VALUES (?, ?, ?, ?, ?)");
    stmt.run([ id, req.body.name, hash, req.body.email, req.body.phone ], (err) => {
      if (err) {
        if (err.message.includes("accounts.email"))
          res.status(422).end("This email already exists.");
        else if (err.message.includes("accounts.phone"))
          res.status(422).end("This phone number already exists.");
        else 
          res.status(500).end("Internal Server Error");
      }
      else {
        res.status(200).end("Success");
      }
    });
  });
});

app.post('/addDoctor', (req, res) => {
  const id = uuidv4();

    const stmt = db.prepare("INSERT INTO doctors (id, jobTitle, latitude, longitude, isAvailable, email, phone) VALUES (?, ?, ?, ?, ? ,?, ?)");
    stmt.run([ id, req.body.jobTitle, req.body.latitude, req.body.longitude, req.body.isAvailable, req.body.email, req.body.phone ], (err) => {
      if (err) {
        if (err.message.includes("accounts.email"))
          res.status(422).end("This email already exists.");
        if (err.message.includes("accounts.phone"))
          res.status(422).end("This phone number already exists.");
      }
    });
    
    res.status(200).end("Success");
});

app.post('/addMessage', authJWT, (req, res) => {
  const id = uuidv4();

  const stmt = db.prepare("INSERT INTO messages (id, content, sender, receiver, timestamp) VALUES (?, ?, ?, ?, strftime('%s', 'now'))");
  stmt.run([ id, req.body.content, req.user.id, req.body.receiver ], (err) => {
    if (err)
      console.log(err);
  });

  res.status(200).end("Success");
});

app.post('/userLogin', (req, res) => {
  const stmt = db.prepare("SELECT id, password FROM accounts WHERE email = (?)");
  stmt.get([ req.body.email ], (err, row) => {
    if (err) {
      res.status(500).end("Internal Server Error");
      throw err;
    }
    else if (!row.password) {
      res.status(400).end("Invalid login - Please try again.");
    }
    else {
      hash = row.password;
      bcrypt.compare(req.body.password, hash, (err, result) => {
        if (err) {
          throw err;
        }
        if (result) {
          console.log("\nSUCCESS\n");
          const authToken = jwt.sign({ id: row.id, email: row.email }, JWT_SECRET);
          res.status(200).end(JSON.stringify({ authToken }));
        }
        else
          res.status(422).end("Invalid login - Please try again.");
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