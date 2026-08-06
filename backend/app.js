// Hostinger (and other cPanel/Phusion Passenger hosts) often looks for "app.js" by default.
// We wrap the require in a try-catch to log EXACTLY why it's failing on Hostinger.

const fs = require('fs');
const path = require('path');

try {
  require('./server.js');
} catch (error) {
  // Write the error to a physical file so we can debug the 503 error
  const logPath = path.join(__dirname, 'hostinger-debug.log');
  const errorMsg = `[${new Date().toISOString()}] APP CRASH:\n${error.stack || error}\n\n`;
  
  try {
    fs.appendFileSync(logPath, errorMsg);
  } catch (fsErr) {
    console.error("Failed to write to debug log", fsErr);
  }

  console.error("Fatal startup error:", error);
  // Re-throw so Passenger knows it crashed
  throw error;
}
