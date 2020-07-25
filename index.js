const express = require('express');
const { v4: uuidv4 } = require('uuid');

let messages = {
  1: {
    id: '1',
    text: 'test',
  },
};

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/', (req, res) => {
  const id = uuid();
  const message = {
    id: id,
    text: req.body.text,
  };

  messages[id] = message;
  
  return res.send(message);
})

app.listen(3000, () => console.log('Server running on port 3000'));