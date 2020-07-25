const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { OPEN_CREATE } = require('sqlite3');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.resolve(__dirname, "test.sqlite");

let db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("connected to sqlite db");
});

db.serialize((err) => {
  if (err) {
    return console.error(err);
  }
  db.run("CREATE TABLE test(info TEXT)");
  db.run("INSERT INTO test (info) VALUES ('info1')");
})

db.close((err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("close db connection");
});

let accounts = {
  1: {
    id: '1',
    name: 'John',
    password: 'pass',
    email: 'rart@gmail.com',
    jobTitle: 'physician',
  }
}

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
})

app.post('/account', (req, res) => {
  const id = uuidv4();
  for (const account of Object.values(accounts)) {
    console.log(account);
    if (req.body.email.toUpperCase() == account.email.toUpperCase()) {
      return res.status(409).end("Account with this email already exists");
    }
    if (!req.body.email.includes('@') || !req.body.email.includes('.')) {
      return res.status(400).end("Invalid email address");
    }
  }
  const account = {
    id: id,
    name: req.body.name,
    password: req.body.password,
    email: req.body.email,
    jobTitle: req.body.jobTitle,
  };

  accounts[id] = account;
  return res.send(account);
})

app.listen(3000, () => console.log('Server running on port 3000'));