import { FormEvent, useEffect, useRef, useState } from 'react';
import type { HealthResponse, SearchResponse } from '../shared/search';
import type { QualityIssueType, QualityReport } from '../shared/quality';
import nexusLogo from './Consistem Nexus.png';
import { BlurReveal } from './components/BlurReveal';
import { ShiningText } from './components/ShiningText';

type SearchState = 'idle' | 'loading' | 'success' | 'error';
type AuthUser = { email: string; name: string };
type FavoriteItem = {
  id: string;
  name: string;
  url: string;
  sourceName: string;
  oaType: string | null;
  duration: string | null;
};

function favoritesKey(email: string): string {
  return `nexus:favorites:${email.toLowerCase()}`;
}

function loadFavorites(email: string): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(favoritesKey(email));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is FavoriteItem =>
        typeof entry === 'object' && entry !== null && typeof (entry as FavoriteItem).id === 'string',
    );
  } catch {
    return [];
  }
}

function persistFavorites(email: string, favorites: FavoriteItem[]): void {
  try {
    localStorage.setItem(favoritesKey(email), JSON.stringify(favorites));
  } catch {
    // Armazenamento cheio ou indisponível: mantém em memória.
  }
}

const fallbackExamples = [
  'Integração do módulo Fiscal',
  'Como configurar a folha de pagamento?',
  'Treinamento sobre emissão de NF-e',
];

const loadingMessages = [
  'Entendendo sua pergunta...',
  'Consultando as matrizes...',
  'Comparando materiais relacionados...',
  'Organizando os melhores resultados...',
];

const qualityLabels: Record<QualityIssueType, string> = {
  missing_header: 'Cabeçalho ausente',
  missing_title: 'Título ausente',
  missing_reference: 'Referência ausente',
  invalid_reference: 'Referência inválida',
  duplicate: 'Possível duplicidade',
};

function SearchLoadingPanel() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex((currentIndex) => (currentIndex + 1) % loadingMessages.length);
    }, 1_400);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="loading-panel">
        <span className="loader" aria-hidden="true" />
        <div>
          <ShiningText text={loadingMessages[messageIndex]} />
          <p>A busca pode levar alguns segundos.</p>
        </div>
      </div>
      <div className="skeleton-list" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div className="skeleton-card" key={index}>
            <div className="skeleton-line skeleton-line--sm" />
            <div className="skeleton-line skeleton-line--lg" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--short" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5h5v5M13 11l6-6M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 7v5h-5M4 17v-5h5M6.1 9a7 7 0 0 1 11.7-2L20 12M4 12l2.2 5a7 7 0 0 0 11.7-2" />
    </svg>
  );
}

function ResultCard({
  item,
  index,
  isFavorite,
  onToggleFavorite,
}: {
  item: import('../shared/search').SearchItem;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: (item: import('../shared/search').SearchItem) => void;
}) {
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const [copied, setCopied] = useState(false);
  const visiblePrograms = showAllPrograms ? item.programs : item.programs.slice(0, 3);
  const hiddenCount = item.programs.length - visiblePrograms.length;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article
      className="result-card result-enter"
      style={{ animationDelay: `${Math.min(index, 4) * 90}ms` }}
    >
      <div className="card-accent" aria-hidden="true" />
      <div className="card-content">
        <div className="card-meta">
          <span className="type-badge">{item.oaType ?? 'Material de aprendizagem'}</span>
          {item.oaNumber && <span className="oa-number">OA {item.oaNumber}</span>}
          {item.duration && <span className="duration-badge">{item.duration}</span>}
        </div>
        <div className="card-title-row">
          <h3>{item.name}</h3>
          <button
            type="button"
            className={`fav-button${isFavorite ? ' fav-button--active' : ''}`}
            onClick={() => onToggleFavorite(item)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Remover "${item.name}" dos favoritos` : `Favoritar "${item.name}"`}
            title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
          >
            <span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>
          </button>
        </div>
        {item.unitTitle && <p className="unit-title">{item.unitTitle}</p>}
        {item.summary && <p>{item.summary}</p>}
        {item.programs.length > 0 && (
          <div className="program-list" aria-label="Programas relacionados">
            {visiblePrograms.map((program) => <span key={program}>{program}</span>)}
            {hiddenCount > 0 && (
              <button
                type="button"
                className="program-more"
                onClick={() => setShowAllPrograms((value) => !value)}
                aria-expanded={showAllPrograms}
              >
                {showAllPrograms ? 'Ver menos' : `+${hiddenCount}`}
              </button>
            )}
          </div>
        )}
        {item.matchExcerpt && (
          <details className="match-evidence">
            <summary>Trecho relacionado</summary>
            {item.matchExcerpt}
          </details>
        )}
        {item.references.length > 1 && (
          <div className="reference-list">
            <span>Referências</span>
            {item.references.map((reference, index) => (
              <a href={reference} target="_blank" rel="noreferrer" key={reference} title={reference}>
                {index + 1}
              </a>
            ))}
          </div>
        )}
        <div className="card-footer">
          <span>Fonte: {item.sourceName}</span>
          <div className="card-actions">
            <button type="button" className="copy-button" onClick={() => void copyLink()}>
              {copied ? 'Copiado!' : 'Copiar link'}
            </button>
            <a href={item.url} target="_blank" rel="noreferrer">
              Abrir material <ExternalLinkIcon />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return null;
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function formatSnapshotDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

function authorizationHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function requestHealth(token: string): Promise<HealthResponse> {
  const response = await fetch('/api/health', { headers: authorizationHeaders(token) });
  if (!response.ok) throw new Error('Base indisponível');
  return response.json() as Promise<HealthResponse>;
}

class SearchError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.status = status;
  }
}

async function requestSearch(query: string, token: string): Promise<SearchResponse> {
  let response: Response;
  try {
    response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authorizationHeaders(token) },
      body: JSON.stringify({ query }),
    });
  } catch {
    throw new SearchError('Verifique sua conexão com a internet e tente novamente.', null);
  }

  const responseBody = await response.text();
  let data: SearchResponse | { message?: string } | null = null;

  if (responseBody) {
    try {
      data = JSON.parse(responseBody) as SearchResponse | { message?: string };
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message = data && 'message' in data ? data.message : null;
    if (response.status === 429) {
      throw new SearchError(message ?? 'Muitas buscas em pouco tempo. Aguarde cerca de 1 minuto e tente novamente.', 429);
    }
    if (response.status === 503) {
      throw new SearchError(
        message ?? 'A base de aprendizagem está temporariamente indisponível. Tente novamente em alguns instantes.',
        503,
      );
    }
    if (response.status === 400) {
      throw new SearchError(message ?? 'Digite uma busca entre 3 e 300 caracteres.', 400);
    }
    throw new SearchError(message ?? 'O servidor de busca está indisponível. Reinicie a aplicação e tente novamente.', response.status);
  }

  if (!data || !('items' in data)) {
    throw new SearchError('O servidor devolveu uma resposta inválida. Tente novamente em alguns instantes.', null);
  }

  return data;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

async function waitForGoogleIdentity(): Promise<GoogleIdentityId> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (window.google?.accounts.id) return window.google.accounts.id;
    await wait(100);
  }
  throw new Error('Não foi possível carregar o login do Google. Verifique sua conexão.');
}

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => sessionStorage.getItem('nexus.google_token'));
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState('');
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleIdentityInitializedRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [isQualityOpen, setIsQualityOpen] = useState(false);
  const [isQualityLoading, setIsQualityLoading] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useEffect(() => {
    if (authToken) return;
    let active = true;

    const initializeLogin = async () => {
      try {
        const configResponse = await fetch('/api/auth/config');
        if (!configResponse.ok) throw new Error('Não foi possível configurar o login corporativo.');
        const { clientId } = await configResponse.json() as { clientId: string };
        const googleIdentity = await waitForGoogleIdentity();
        if (!active || !googleButtonRef.current) return;

        if (!googleIdentityInitializedRef.current) {
          googleIdentity.initialize({
            client_id: clientId,
            callback: ({ credential }) => {
              sessionStorage.setItem('nexus.google_token', credential);
              setAuthToken(credential);
              setAuthError('');
            },
          });
          googleIdentityInitializedRef.current = true;
        }
        googleButtonRef.current.replaceChildren();
        googleIdentity.renderButton(googleButtonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 320,
          locale: 'pt-BR',
        });
      } catch (loginError) {
        if (active) setAuthError(loginError instanceof Error ? loginError.message : 'Não foi possível iniciar o login.');
      }
    };

    void initializeLogin();
    return () => { active = false; };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      setAuthUser(null);
      return;
    }

    let active = true;
    fetch('/api/auth/me', { headers: authorizationHeaders(authToken) })
      .then(async (response) => {
        const body = await response.json() as AuthUser | { message?: string };
        if (!response.ok || !('email' in body)) {
          const message = 'message' in body ? body.message : null;
          throw new Error(message ?? 'Sessão inválida');
        }
        const user = body;
        if (active) setAuthUser(user);
      })
      .catch((error: unknown) => {
        if (!active) return;
        sessionStorage.removeItem('nexus.google_token');
        setAuthToken(null);
        setAuthError(error instanceof Error ? error.message : 'Sua sessão expirou. Entre novamente para continuar.');
      });

    return () => { active = false; };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    const handleGlobalKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    const updateHealth = async () => {
      try {
        const response = await requestHealth(authToken);
        if (active) setHealth(response);
      } catch {
        if (active) setHealth({ status: 'unavailable', fileCount: 0, itemCount: 0, qualityIssueCount: 0, suggestions: [], snapshotUpdatedAt: null });
      }
    };

    void updateHealth();
    const interval = window.setInterval(() => void updateHealth(), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [authToken]);

  async function synchronize() {
    if (!authToken) return;
    setIsSyncing(true);
    setSyncFeedback(null);

    try {
      const response = await fetch('/api/sync', { method: 'POST', headers: authorizationHeaders(authToken) });
      const body = await response.text();
      const data = body ? JSON.parse(body) as HealthResponse | { message?: string } : null;
      if (!response.ok || !data || !('status' in data)) {
        const message = data && 'message' in data ? data.message : null;
        throw new Error(message ?? 'Não foi possível atualizar a base.');
      }

      setHealth(data);
      setSyncFeedback({
        type: 'success',
        message: `${data.fileCount} ${data.fileCount === 1 ? 'matriz sincronizada' : 'matrizes sincronizadas'} com sucesso.`,
      });
    } catch (syncError) {
      setSyncFeedback({
        type: 'error',
        message: syncError instanceof Error ? syncError.message : 'Não foi possível atualizar a base.',
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function openQualityReport() {
    if (!authToken) return;
    setIsQualityOpen(true);
    setIsQualityLoading(true);
    try {
      const response = await fetch('/api/quality', { headers: authorizationHeaders(authToken) });
      if (!response.ok) throw new Error('Não foi possível carregar o relatório.');
      setQualityReport(await response.json() as QualityReport);
    } catch (qualityError) {
      setSyncFeedback({
        type: 'error',
        message: qualityError instanceof Error ? qualityError.message : 'Não foi possível carregar o relatório.',
      });
      setIsQualityOpen(false);
    } finally {
      setIsQualityLoading(false);
    }
  }

  async function search(searchQuery: string) {
    if (!authToken) return;
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length < 3) {
      setError('Descreva o material que você procura usando pelo menos 3 caracteres.');
      setErrorStatus(400);
      setState('error');
      return;
    }

    setQuery(normalizedQuery);
    setLastQuery(normalizedQuery);
    setState('loading');
    setError('');
    setErrorStatus(null);
    // Tempo mínimo visível para as mensagens de espera serem lidas
    // e a transição até o resultado não parecer brusca.
    const minimumLoadingTime = wait(1_100);

    try {
      const [response] = await Promise.all([requestSearch(normalizedQuery, authToken), minimumLoadingTime]);
      setResult(response);
      setState('success');
    } catch (searchError) {
      await minimumLoadingTime;
      setError(searchError instanceof Error ? searchError.message : 'Não foi possível concluir a busca.');
      setErrorStatus(searchError instanceof SearchError ? searchError.status : null);
      setState('error');
    }
  }

  function errorGuidance(): { title: string; action: 'retry' | 'adjust' } {
    if (errorStatus === 429) return { title: 'Muitas buscas em pouco tempo.', action: 'retry' };
    if (errorStatus === 503) return { title: 'Base temporariamente indisponível.', action: 'retry' };
    if (errorStatus === 400) return { title: 'Ajuste sua busca.', action: 'adjust' };
    return { title: 'Não conseguimos fazer essa busca.', action: 'retry' };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(query);
  }

  const examples = health?.suggestions.length ? health.suggestions : fallbackExamples;

  useEffect(() => {
    if (!authUser) {
      setFavorites([]);
      setFavoritesOnly(false);
      return;
    }
    setFavorites(loadFavorites(authUser.email));
    setFavoritesOnly(false);
  }, [authUser?.email]);

  function toggleFavorite(item: import('../shared/search').SearchItem) {
    if (!authUser) return;
    setFavorites((current) => {
      const exists = current.some((fav) => fav.id === item.id);
      const next = exists
        ? current.filter((fav) => fav.id !== item.id)
        : [...current, {
            id: item.id,
            name: item.name,
            url: item.url,
            sourceName: item.sourceName,
            oaType: item.oaType,
            duration: item.duration,
          }];
      persistFavorites(authUser.email, next);
      return next;
    });
  }

  function removeFavorite(id: string) {
    if (!authUser) return;
    setFavorites((current) => {
      const next = current.filter((fav) => fav.id !== id);
      persistFavorites(authUser.email, next);
      return next;
    });
  }

  function signOut() {
    sessionStorage.removeItem('nexus.google_token');
    window.google?.accounts.id.disableAutoSelect();
    setAuthToken(null);
    setAuthUser(null);
    setHealth(null);
  }

  if (!authToken || !authUser) {
    return (
      <main className="login-page">
        <section className="login-card" aria-labelledby="login-title">
          <img src={nexusLogo} alt="Consistem Nexus" />
          <p className="eyebrow">BASE INTERNA DE APRENDIZAGEM</p>
          <h1 id="login-title">
            <BlurReveal
              className="login-title-reveal"
              lines={['Encontre conhecimento.', 'Avance com clareza.']}
            />
          </h1>
          <p>Entre com sua conta corporativa para consultar cursos e objetos de aprendizagem da Consistem.</p>
          <div className="google-login" ref={googleButtonRef} />
          {authError && <p className="login-error" role="alert">{authError}</p>}
          {authToken && !authUser && <p className="login-validating">Validando sua conta...</p>}
        </section>
      </main>
    );
  }

  const healthRelative = formatRelativeTime(health?.snapshotUpdatedAt ?? null);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#search">Pular para a busca</a>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Consistem Nexus - início">
          <img src={nexusLogo} alt="Consistem Nexus" />
        </a>
        <div className="topbar-actions">
          <span
            className={`knowledge-label status-${isSyncing ? 'syncing' : health?.status ?? 'unavailable'}`}
            title={health?.snapshotUpdatedAt ? `Atualizada em ${formatSnapshotDate(health.snapshotUpdatedAt)}` : undefined}
          >
            <span className="status-dot" aria-hidden="true" />
            <span className="status-copy">
              {isSyncing
                ? 'Sincronizando...'
                : health?.status === 'ready'
                  ? `${health.fileCount} ${health.fileCount === 1 ? 'matriz' : 'matrizes'} · ${healthRelative ?? 'atualizada'}`
                  : 'Base indisponível'}
            </span>
          </span>
          <button className="quality-button" type="button" onClick={() => void openQualityReport()}>
            Qualidade
            {Boolean(health?.qualityIssueCount) && <span>{health!.qualityIssueCount}</span>}
          </button>
          <button className="sync-button" type="button" onClick={() => void synchronize()} disabled={isSyncing}>
            <SyncIcon />
            <span>{isSyncing ? 'Sincronizando' : 'Sincronizar'}</span>
          </button>
          <button className="logout-button" type="button" onClick={signOut} title={authUser.email}>Sair</button>
        </div>
      </header>

      {syncFeedback && (
        <div className={`sync-toast ${syncFeedback.type}`} role={syncFeedback.type === 'error' ? 'alert' : 'status'}>
          {syncFeedback.message}
          <button type="button" onClick={() => setSyncFeedback(null)} aria-label="Fechar aviso">×</button>
        </div>
      )}

      {isQualityOpen && (
        <div className="quality-overlay" role="presentation" onMouseDown={() => setIsQualityOpen(false)}>
          <section
            className="quality-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quality-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="quality-dialog-header">
              <div>
                <p>QUALIDADE DA BASE</p>
                <h2 id="quality-title">Diagnóstico das matrizes</h2>
              </div>
              <button type="button" onClick={() => setIsQualityOpen(false)} aria-label="Fechar relatório">×</button>
            </div>

            {isQualityLoading && <p className="quality-loading">Carregando diagnóstico...</p>}
            {!isQualityLoading && qualityReport && (
              <>
                <div className="quality-summary">
                  {(Object.entries(qualityReport.counts) as Array<[QualityIssueType, number]>).map(([type, count]) => (
                    <div key={type}>
                      <strong>{count}</strong>
                      <span>{qualityLabels[type]}</span>
                    </div>
                  ))}
                </div>
                <div className="quality-issues">
                  {qualityReport.issues.length === 0 && <p>Nenhum problema encontrado nas matrizes.</p>}
                  {qualityReport.issues.map((issue) => (
                    <article key={issue.id}>
                      <span>{qualityLabels[issue.type]}</span>
                      <strong>{issue.sourceName}</strong>
                      <p>{issue.message}</p>
                      <small>{issue.sheetName}{issue.rowNumber ? ` · Linha ${issue.rowNumber}` : ''}</small>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <main>
        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">CONHECIMENTO, SEM ATALHOS COMPLICADOS</p>
          <h1 id="page-title">
            <BlurReveal
              className="hero-title-reveal"
              lines={['Encontre o material certo', 'para seguir em frente.']}
            />
          </h1>
          <p className="hero-copy">
            Busque por produto, módulo, tema ou nome do curso. O Nexus consulta a base de aprendizagem da Consistem por você.
          </p>

          <form className="search-form" onSubmit={handleSubmit}>
            <label htmlFor="search">O que você quer aprender?</label>
            <div className="search-row">
              <input
                ref={searchInputRef}
                id="search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && query) {
                    event.stopPropagation();
                    setQuery('');
                  }
                }}
                placeholder="Ex.: Onde encontro o treinamento do módulo Fiscal?"
                maxLength={300}
                disabled={state === 'loading'}
                aria-describedby="search-help"
              />
              <button type="submit" disabled={state === 'loading'}>
                {state === 'loading' ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            <p id="search-help" className="search-help">Descreva com suas palavras. Não precisa saber o nome exato. Pressione <kbd>/</kbd> para focar e <kbd>Esc</kbd> para limpar.</p>
          </form>

          {state === 'idle' && (
            <div className="examples" aria-label="Exemplos de busca">
              <span>Experimente buscar</span>
              <div className="example-list">
                {examples.map((example) => (
                  <button key={example} type="button" onClick={() => void search(example)}>{example}</button>
                ))}
              </div>
            </div>
          )}

          {(state === 'idle' || state === 'success') && favorites.length > 0 && (
            <div className="favorites-block" aria-label="Seus favoritos">
              <div className="favorites-block-header">
                <div>
                  <p className="results-label">Seus favoritos</p>
                  <span className="fav-count">{favorites.length} {favorites.length === 1 ? 'salvo' : 'salvos'}</span>
                </div>
                {state === 'success' && result && result.items.length > 0 && (
                  <button
                    type="button"
                    className={`fav-filter${favoritesOnly ? ' fav-filter--active' : ''}`}
                    onClick={() => setFavoritesOnly((value) => !value)}
                    aria-pressed={favoritesOnly}
                  >
                    {favoritesOnly ? 'Ver todos os resultados' : 'Ver só favoritos'}
                  </button>
                )}
              </div>
              {state === 'idle' && (
                <ul className="favorites-list">
                  {favorites.map((fav) => (
                    <li key={fav.id}>
                      <span className="fav-star" aria-hidden="true">★</span>
                      <div className="fav-info">
                        <a href={fav.url} target="_blank" rel="noreferrer">{fav.name}</a>
                        <span>Fonte: {fav.sourceName}</span>
                      </div>
                      <a
                        className="fav-open"
                        href={fav.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir "${fav.name}" em nova aba`}
                      >
                        <ExternalLinkIcon />
                      </a>
                      <button
                        type="button"
                        className="fav-remove"
                        onClick={() => removeFavorite(fav.id)}
                        aria-label={`Remover "${fav.name}" dos favoritos`}
                        title="Remover dos favoritos"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="feedback" aria-live="polite" aria-busy={state === 'loading'}>
          {state === 'loading' && (
            <SearchLoadingPanel />
          )}

          {state === 'error' && (
            <div className="message-panel error-panel" role="alert">
              <div>
                <strong>{errorGuidance().title}</strong>
                <p>{error}</p>
                {errorStatus === 503 && (
                  <p className="error-hint">Sua última base válida continua salva. Aguarde alguns instantes e tente de novo.</p>
                )}
                {errorStatus === 400 && (
                  <p className="error-hint">Use entre 3 e 300 caracteres. Vale módulo, produto, tema ou código do programa.</p>
                )}
              </div>
              {errorGuidance().action === 'retry'
                ? lastQuery && <button type="button" onClick={() => void search(lastQuery)}>Tentar novamente</button>
                : <button type="button" onClick={() => searchInputRef.current?.focus()}>Ajustar busca</button>}
            </div>
          )}

          {state === 'success' && result && (() => {
            const visibleItems = favoritesOnly
              ? result.items.filter((item) => favorites.some((fav) => fav.id === item.id))
              : result.items;
            return (
            <div className="results">
              <div className="results-heading">
                <div>
                  <p className="results-label">RESULTADO DA BUSCA{favoritesOnly ? ' · FAVORITOS' : ''}</p>
                  <h2>{result.items.length > 0 ? 'Materiais encontrados' : 'Nenhum material encontrado'}</h2>
                  <p>{result.answer}</p>
                  {result.items.length === 0 && lastQuery && (
                    <p className="empty-query">Sem resultados para “{lastQuery}”.</p>
                  )}
                </div>
                {visibleItems.length > 0 && <span>{visibleItems.length} {visibleItems.length === 1 ? 'resultado' : 'resultados'}</span>}
              </div>

              {result.items.length > 0 && (
                visibleItems.length === 0 ? (
                  <div className="empty-panel">
                    <p>Nenhum dos resultados desta busca está nos seus favoritos.</p>
                    <button type="button" className="empty-retry" onClick={() => setFavoritesOnly(false)}>
                      Ver todos os resultados
                    </button>
                  </div>
                ) : (
                  <div className="result-list">
                    {visibleItems.map((item, index) => (
                      <ResultCard
                        key={item.id}
                        item={item}
                        index={index}
                        isFavorite={favorites.some((fav) => fav.id === item.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                )
              )}

              {result.items.length === 0 && (
                <div className="empty-panel">
                  <div className="empty-tips">
                    <strong>Como melhorar sua busca</strong>
                    <ul>
                      <li>Busque pelo <em>módulo</em>, <em>produto</em> ou <em>tema</em> em vez da frase completa.</li>
                      <li>Use o nome do curso ou o código do programa (ex.: CCPMEC160).</li>
                      <li>Evite palavras muito genéricas como “treinamento” ou “material”.</li>
                    </ul>
                  </div>
                  <div className="empty-examples">
                    <span>Buscas que funcionam</span>
                    <div className="example-list">
                      {examples.map((example) => (
                        <button key={example} type="button" onClick={() => void search(example)}>{example}</button>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="empty-retry" onClick={() => searchInputRef.current?.focus()}>
                    Tentar outra busca
                  </button>
                </div>
              )}

              <p className="snapshot-time">
                Base atualizada em {formatSnapshotDate(result.snapshotUpdatedAt)} ({formatRelativeTime(result.snapshotUpdatedAt) ?? 'agora'})
              </p>
            </div>
            );
          })()}
        </section>
      </main>

      <footer>
        <span>Consistem Nexus</span>
        <span>Conhecimento interno, encontrado com clareza.</span>
      </footer>
    </div>
  );
}
