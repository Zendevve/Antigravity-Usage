import express from 'express';

const app = express();
const port = process.env.ANTIGRAVITY_PORT ? parseInt(process.env.ANTIGRAVITY_PORT) : 13338;

let depletionCounter = 0;

app.use((req, res, next) => {
  if (req.query.fail === '503') {
    res.status(503).json({ error: 'Service Unavailable' });
    return;
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/v1/quota/status', (req, res) => {
  depletionCounter++;
  const remainingPercent = Math.max(0, 100 - (depletionCounter * 0.5));

  res.json({
    sourceId: 'mock-server',
    remainingPercent,
    remainingTokens: Math.floor(remainingPercent * 100000),
    totalTokens: 10000000,
    model: 'Gemini 3 Pro',
    fetchedAt: new Date(),
    freshnessMs: 1500,
  });
});

app.listen(port, () => {
  console.log(`Mock Antigravity server listening on port ${port}`);
});
