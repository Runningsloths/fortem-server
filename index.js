const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.resolve(__dirname, "accounts.db");

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
    jobTitle TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE
    )`);
});

// db.close((err) => {
//   if (err) {
//     return console.error(err.message);
//   }
//   console.log("close db connection");
// });

let accounts = {
  1: {
    id: '1',
    name: 'John',
    password: 'pass',
    email: 'rart@gmail.com',
    jobTitle: 'physician',
    phone: '8186969696'
  }
};

let messages = {
  1: {
    id: '1',
    text: 'test',
  },
};

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/message', (req, res) => {
  const id = uuidv4();
  const message = {
    id: id,
    text: req.body.text,
  };

  messages[id] = message;
  return res.send(message);
});

app.post('/addAccount', (req, res) => {
  const id = uuidv4();
  for (const account of Object.values(accounts)) {
    if (req.body.email.toUpperCase() == account.email.toUpperCase())
      return res.status(409).end("Account with this email already exists");
    if (!req.body.email.includes('@') || !req.body.email.includes('.'))
      return res.status(422).end("Invalid email address");
    if (req.body.phone.length != 10)
      return res.status(422).end("Invalid phone number");
  }
  const account = {
    id: id,
    name: req.body.name,
    password: req.body.password,
    email: req.body.email,
    jobTitle: req.body.jobTitle,
    phone: req.body.phone,
  };

  const stmt = db.prepare('INSERT INTO accounts (id, name, password, email, jobTitle, phone) VALUES (?, ?, ?, ?, ? ,?)');
  console.log([ id, account.name, account.password, account.email, account.jobTitle, account.phone ]);
  stmt.run(id, account.name, account.password, account.email, account.jobTitle, account.phone);
  
  return res.send(account);
});


app.listen(3000, () => console.log('Server running on port 3000'));