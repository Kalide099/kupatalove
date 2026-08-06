// Hostinger (and other cPanel/Phusion Passenger hosts) often looks for "app.js" by default.
// This file simply imports our main server to ensure it starts correctly.

require('./server.js');
