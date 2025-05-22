// index.js
const express = require('express');
const bodyParser = require('body-parser');
const { MessagingResponse } = require('twilio').twiml;
const fs = require('fs');

// Load business config
const config = JSON.parse(fs.readFileSync('business.json', 'utf8'));

// In-memory sessions store
const sessions = {};

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Health-check endpoint (optional)
app.get('/', (req, res) => {
  res.send('BizBuddy backend is live and ready for /webhook');
});

app.post('/webhook', (req, res) => {
  const twiml = new MessagingResponse();
  const incoming = (req.body.Body || '').trim().toLowerCase();
  const from = req.body.From;

  // Booking request: "book haircut"
  if (incoming.startsWith('book ')) {
    const service = incoming.split(' ')[1];
    const duration = config.services[service];

    if (!duration) {
      twiml.message(
        `Sorry, we don't offer '${service}'. Available: ${Object.keys(config.services).join(', ')}.`
      );
    } else {
      // Calculate slots
      const slots = [];
      for (let h = config.hours.start; h + duration/60 <= config.hours.end; h++) {
        slots.push(`${h}:00`);
      }
      // Save session for confirmation
      sessions[from] = { service, slots };

      twiml.message(
        `Available ${service} slots today: ${slots.join(', ')}.\nReply "confirm HH:MM" to book.`
      );
    }

  // Confirmation request: "confirm 10:00"
  } else if (incoming.startsWith('confirm ')) {
    const time = incoming.split(' ')[1];
    const session = sessions[from];

    if (!session) {
      twiml.message(
        `I don't have a booking session for you. Please send "book <service>" first.`
      );
    } else if (!session.slots.includes(time)) {
      twiml.message(
        `That slot isn't available. Available: ${session.slots.join(', ')}. Reply with a valid time.`
      );
    } else {
      // Confirm booking
      twiml.message(
        `Your ${session.service} is confirmed for today at ${time}. Thank you!`
      );
      // Clear the session
      delete sessions[from];
    }

  // Fallback: echo
  } else {
    twiml.message(`You said: ${req.body.Body || ''}`);
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
