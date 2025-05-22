// Firestore setup
const admin = require('firebase-admin');
// Parse the service account JSON from the env var
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Optional: you can set the project explicitly if needed
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});
const db = admin.firestore();

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

app.post('/webhook', async (req, res) => {
  const twiml = new MessagingResponse();
  const incoming = (req.body.Body || '').trim().toLowerCase();
  const from = req.body.From;

  try {
    if (incoming.startsWith('book ')) {
      // Booking request
      const service = incoming.split(' ')[1];
      const duration = config.services[service];

      if (!duration) {
        twiml.message(`Sorry, we don't offer '${service}'. Available: ${Object.keys(config.services).join(', ')}.`);
      } else {
        // Calculate slots
        const slots = [];
        for (let h = config.hours.start; h + duration/60 <= config.hours.end; h++) {
          slots.push(`${h}:00`);
        }
        // Save session to Firestore
        await db.collection('sessions').doc(from).set({ service, slots });
        twiml.message(`Available ${service} slots today: ${slots.join(', ')}.\nReply "confirm HH:MM" to book.`);
      }

    } else if (incoming.startsWith('confirm ')) {
      // Confirmation request
      const time = incoming.split(' ')[1];
      const sessionDoc = await db.collection('sessions').doc(from).get();

      if (!sessionDoc.exists) {
        twiml.message(`No active booking found. Please send "book <service>" first.`);
      } else {
        const { service, slots } = sessionDoc.data();
        if (!slots.includes(time)) {
          twiml.message(`That slot isn't available. Available: ${slots.join(', ')}.`);
        } else {
          // Persist the booking
          await db.collection('bookings').add({
            customer: from,
            service,
            time,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          // Clear the session
          await db.collection('sessions').doc(from).delete();
          twiml.message(`Your ${service} is confirmed for today at ${time}. Thank you!`);
        }
      }

    } else {
      // Fallback: echo
      twiml.message(`Hey - You said: ${req.body.Body || ''}`);
    }

  } catch (err) {
    console.error('Webhook Error:', err);
    twiml.message('Oops! Something went wrong. Please try again later.');
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
