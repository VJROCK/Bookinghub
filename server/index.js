/** BookingHub API server */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('./db');          // creates tables
require('./db/seed');     // seeds demo data on first run

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

const { router: authRouter, requireAuth } = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/api', requireAuth); // everything below needs a token

app.use('/api/masters', require('./routes/masters'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));

// serve built client in production (npm run build, then npm start)
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`BookingHub server running on http://localhost:${PORT}`));
