const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.json());

// API routes first
app.get('/open-file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'path parameter is required' });
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ filePath: path.resolve(filePath), content });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read file: ' + error.message });
  }
});

app.post('/save-markdown', (req, res) => {
  const { filePath, content } = req.body;

  if (!filePath || !content) {
    return res.status(400).json({ error: 'File path and content are required' });
  }

  try {
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save file: ' + error.message });
  }
});

// Static files last
app.use(express.static(__dirname));

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
