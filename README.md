# Consistem Nexus

Busca em linguagem natural sobre cursos e Objetos de Aprendizagem armazenados em planilhas Google. O backend sincroniza as planilhas de uma pasta do Drive e usa o modelo Gemma 4 31B via OpenRouter para selecionar os materiais relacionados.

## Requisitos

- Node.js 20 ou superior.
- APIs Google Drive e Google Sheets habilitadas no Google Cloud.
- Conta de servico com a pasta compartilhada em modo leitor.
- Chave da API do OpenRouter com acesso ao modelo configurado.

## Configuracao

1. Instale as dependencias com `npm install`.
2. Crie `.env` a partir de `.env.example`.
3. Preencha `OPENROUTER_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS` e `GOOGLE_DRIVE_FOLDER_ID`.
4. Confirme o modelo `OPENROUTER_MODEL=google/gemma-4-31b-it`.
5. Execute `npm run dev`.
6. Abra `http://localhost:5173`.

O ID da pasta e o trecho depois de `/folders/` na URL do Google Drive.
Por padrao, somente a aba `MATRIZ` de cada planilha e lida. Altere `GOOGLE_SHEET_NAME` se a aba principal usar outro nome.

O snapshot normalizado e persistido em `.data/knowledge-base.json` e restaurado na inicializacao. Altere `KNOWLEDGE_CACHE_PATH` para usar outro local. Consultas contendo um codigo de programa exato, como `CCPMEC160`, sao resolvidas diretamente; as demais usam ranking textual antes do OpenRouter.

O Drive Changes API e consultado no intervalo de `DRIVE_CHANGES_POLL_INTERVAL_MS` para atualizar somente matrizes alteradas. Uma sincronizacao completa continua sendo executada no intervalo de `KNOWLEDGE_REFRESH_INTERVAL_MS` como reconciliacao. O painel **Qualidade** lista titulos e referencias ausentes, referencias invalidas e possiveis duplicidades.

Os resultados exibem o trecho da matriz usado na correspondencia e todas as URLs HTTPS encontradas em `Referencias`.

## Login corporativo

Crie um cliente OAuth 2.0 do tipo **Aplicativo da Web**, configure a tela de consentimento como interna e adicione a URL do frontend nas origens JavaScript autorizadas. Preencha `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_ALLOWED_DOMAIN`. O backend valida o ID token, o e-mail verificado e o dominio antes de liberar busca, qualidade e sincronizacao.

## Deploy na Vercel

Configure as variaveis abaixo no projeto da Vercel e execute um novo deploy:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_SITE_URL`
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_SHEET_NAME`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_ALLOWED_DOMAIN`
- `APP_ORIGIN`

`GOOGLE_APPLICATION_CREDENTIALS` aponta para um arquivo local e nao funciona na Vercel. Use `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` ou configure separadamente `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` e `GOOGLE_PROJECT_ID`. A chave privada aceita quebras de linha reais ou `\n`. Use a URL de producao completa em `APP_ORIGIN` e `OPENROUTER_SITE_URL`, por exemplo `https://consistem-nexus.vercel.app`.

Adicione essa mesma origem HTTPS no cliente OAuth do Google. O backend usa `/tmp` como cache efemero na Vercel e verifica mudancas do Drive sob demanda, pois funcoes serverless nao mantem timers ativos entre requisicoes.

## Estrutura das planilhas

O sistema procura a linha de cabecalho entre as 10 primeiras linhas de cada aba. Pelo menos uma coluna de nome e obrigatoria.

| Campo | Cabecalhos reconhecidos |
| --- | --- |
| Nome | Nome, Curso, OA, Objeto de Aprendizagem, Titulo |
| Resumo | Resumo, Descricao, Topico, Modulo, Conteudo, Ementa |
| Duracao | Duracao, Carga Horaria, Tempo |
| Link | Link, URL, Material, Acesso |

Quando o link nao existe ou nao usa HTTPS, o resultado direciona para a planilha de origem.

## Comandos

- `npm run dev`: frontend e backend em modo de desenvolvimento.
- `npm run build`: valida o TypeScript e gera o frontend de producao.
- `npm start`: executa a API e serve `dist` quando o build existe.
- `npm test`: executa os testes automatizados.

## Conta de servico

Salve o JSON fora do projeto e do OneDrive. Configure o caminho absoluto em `GOOGLE_APPLICATION_CREDENTIALS` usando barras `/`, inclusive no Windows. Compartilhe a pasta com o `client_email` do JSON em modo leitor. Para Shared Drive, adicione a conta como membro e configure `GOOGLE_SHARED_DRIVE_ID`.
