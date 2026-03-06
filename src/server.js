import app from './app.js';
import { config } from './config/constants.js';

const PORT = config.PORT;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${config.NODE_ENV}`);
});