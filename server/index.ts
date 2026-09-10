import { config } from './config';
import { app } from './app';
import { startKnowledgeBaseRefresh } from './services/knowledgeBaseService';

app.listen(config.port, () => {
  console.info(JSON.stringify({ event: 'server_started', port: config.port }));
  startKnowledgeBaseRefresh();
});
