import { config } from './config.js';
import { app } from './app.js';
import { startKnowledgeBaseRefresh } from './services/knowledgeBaseService.js';

app.listen(config.port, () => {
  console.info(JSON.stringify({ event: 'server_started', port: config.port }));
  startKnowledgeBaseRefresh();
});
