const express = require('express');
const app = express();

app.get('/test', (req, res) => {
    console.log('Test route called');
    res.json({ message: 'Hello World' });
});

console.log('Starting minimal server...');
app.listen(3002, () => {
    console.log('Minimal server running on port 3002');
});
