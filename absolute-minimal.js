const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Absolute minimal server - just respond to any request
app.use((req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Absolute minimal server running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Absolute minimal server running on port ${PORT}`);
  console.log('This should work on Railway!');
});
