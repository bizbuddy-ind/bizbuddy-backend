require('dotenv').config();

// Firestore setup
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});
const db = admin.firestore();

// Dependencies
const express = require('express');
const bodyParser = require('body-parser');
const { MessagingResponse } = require('twilio').twiml;
const fs = require('fs');
const classifyIntent = require('./utils/aiRouter'); // ✅ GPT intent router

const config = JSON.parse(fs.readFileSync('business.json', 'utf8'));
const sessions = {};

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.send('BizBuddy backend is live and ready for /webhook');
});

app.post('/webhook', async (req, res) => {
  const twiml = new MessagingResponse();
  const incoming = (req.body.Body || '').trim();
  const lower = incoming.toLowerCase();
  const from = req.body.From;

  try {
    console.log("Incoming message:", incoming);

    if (lower.startsWith('book ')) {
      const service = lower.split(' ')[1];
      const duration = config.services[service];

      if (!duration) {
        twiml.message(`Sorry, we don't offer '${service}'. Available: ${Object.keys(config.services).join(', ')}.`);
      } else {
        const slots = [];
        for (let h = config.hours.start; h + duration/60 <= config.hours.end; h++) {
          slots.push(`${h}:00`);
        }
        await db.collection('sessions').doc(from).set({ service, slots });
        twiml.message(`Available ${service} slots today: ${slots.join(', ')}.\nReply "confirm HH:MM" to book.`);
      }

    } else if (lower.startsWith('confirm ')) {
      // ✅ Convert "4pm", "4:00 PM", etc. to "16:00"
      const rawTime = incoming.replace(/^confirm\s+/i, '').trim();
      let time;

      const timeMatch = rawTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2] ? timeMatch[2] : '00';
        const ampm = timeMatch[3]?.toLowerCase();

        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;

        time = `${hour.toString().padStart(2, '0')}:${minute}`;
      } else {
        time = rawTime;
      }

      const sessionDoc = await db.collection('sessions').doc(from).get();

      if (!sessionDoc.exists) {
        twiml.message(`No active booking found. Please send "book <service>" first.`);
      } else {
        const { service, slots } = sessionDoc.data();
        if (!slots.includes(time)) {
          twiml.message(`That slot isn't available. Available: ${slots.join(', ')}.`);
        } else {
          await db.collection('bookings').add({
            customer: from,
            service,
            time,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          await db.collection('sessions').doc(from).delete();
          twiml.message(`Your ${service} is confirmed for today at ${time}. Thank you!`);
        }
      }

    } else {
      // ✅ GPT Intent Routing
      console.log("Passing to GPT for intent...");
      const aiResult = await classifyIntent(incoming);
      console.log("GPT Response:", aiResult);

      switch (aiResult.intent) {
        case 'BOOK':
          twiml.message(`Got it! You want to book a ${aiResult.service} at ${aiResult.time}. Please use "book <service>" to start.`);
          break;
        case 'RESCHEDULE':
          twiml.message(`To reschedule, please cancel your existing booking and create a new one.`);
          break;
        case 'CALLBACK':
          await db.collection('callbacks').add({
            customer: from,
            message: incoming,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          twiml.message(`We’ve noted your callback request. Someone will reach out soon.`);
          break;
        case 'DELIVERY_REQUEST':
          await db.collection('deliveries').add({
            customer: from,
            details: incoming,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          twiml.message(`Thanks! We’ve received your delivery request.`);
          break;
        case 'FAQ':
          twiml.message(`Here’s what I found: [Coming soon – GPT-based answer]`);
          break;
        default:
          twiml.message(`Sorry, I didn’t get that. Try saying “book haircut” or “I want a call back.”`);
      }
    }

  } catch (err) {
    console.error('❌ Webhook Error:', err.message, err.stack);
    twiml.message('Oops! Something went wrong. Please try again later.');
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Listening on port ${PORT}`));
