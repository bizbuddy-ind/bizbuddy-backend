// index.js
const express = require('express');
const bodyParser = require('body-parser');
const { MessagingResponse } = require('twilio').twiml;

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/webhook', (req, res) => {
  console.log('🔔 Incoming webhook:', req.body);
  
  const twiml = new MessagingResponse();
  const incoming = req.body.Body || '';
  twiml.message(`You said: ${incoming}`);

  console.log('↪️ Replying with:', `Hey! You said: ${incoming}`);
  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));