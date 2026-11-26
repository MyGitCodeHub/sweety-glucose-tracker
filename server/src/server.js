import app from './app.js';

const DEFAULT_PORT = 3001;

function resolvePort(rawPort) {
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_PORT;
  }

  return parsed;
}

const port = resolvePort(process.env.PORT);

app.listen(port, () => {
  console.log(`Sweety server listening on http://localhost:${port}`);
});
