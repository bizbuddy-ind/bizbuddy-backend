const fs = require('fs');
const config = JSON.parse(fs.readFileSync('business.json', 'utf8'));
const express = require('express');
const bodyParser = require('body-parser');
const { MessagingResponse } = require('twilio').twiml;

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/webhook', (req, res) => {
  const twiml = new MessagingResponse();
  const incoming = (req.body.Body || '').trim().toLowerCase();

  if (incoming.startsWith('book ')) {
    const service = incoming.split(' ')[1];
    const duration = config.services[service];

    if (!duration) {
      twiml.message(
        `Sorry, we don't offer '${service}'. Available: ${Object.keys(config.services).join(', ')}.`
      );
    } else {
      const slots = [];
      for (let h = config.hours.start; h + duration/60 <= config.hours.end; h++) {
        slots.push(`${h}:00`);
      }
      twiml.message(
        `Available ${service} slots today: ${slots.join(', ')}. Reply with a time to confirm.`
      );
    }
  } else {
    // Fallback to echo
    twiml.message(`You said: ${req.body.Body || ''}`);
  }

  res.writeHead(200, { 'Content-Type':'text/xml' });
  res.end(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));