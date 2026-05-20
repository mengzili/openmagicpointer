// No module syntax — tsc with module=commonjs would emit `exports.…` which
// throws when the file is loaded via a plain <script> tag in the renderer.

interface SetupGetResponse {
  provider: 'anthropic' | 'openai';
  baseURL: string;
  model: string;
  aggressiveness: number;
  hasKey: boolean;
  hasAuthToken: boolean;
  envBaseURL: string;
  envHasAuthToken: boolean;
  envHasApiKey: boolean;
}

interface SetupSavePayload {
  provider: 'anthropic' | 'openai';
  baseURL: string;
  model: string;
  aggressiveness: number;
  apiKey: string;
  authToken: string;
}

interface SetupBridge {
  get(): Promise<SetupGetResponse>;
  save(payload: SetupSavePayload): Promise<{ ok: boolean; error?: string }>;
  cancel(): Promise<void>;
}

(async function () {
  const bridge = (window as unknown as { setup: SetupBridge }).setup;

  const providerEl = document.getElementById('provider') as HTMLSelectElement;
  const baseURLEl = document.getElementById('baseURL') as HTMLInputElement;
  const baseURLRow = document.getElementById('baseURLRow') as HTMLLabelElement;
  const baseURLHint = document.getElementById('baseURLHint') as HTMLSpanElement;
  const baseURLOptional = document.getElementById('baseURLOptional') as HTMLSpanElement;
  const modelEl = document.getElementById('model') as HTMLInputElement;
  const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement;
  const apiKeyHint = document.getElementById('apiKeyHint') as HTMLSpanElement;
  const authTokenEl = document.getElementById('authToken') as HTMLInputElement;
  const authTokenRow = document.getElementById('authTokenRow') as HTMLLabelElement;
  const providerHint = document.getElementById('providerHint') as HTMLSpanElement;
  const modelHint = document.getElementById('modelHint') as HTMLSpanElement;
  const envBanner = document.getElementById('envBanner') as HTMLDivElement;
  const errorBox = document.getElementById('error') as HTMLDivElement;
  const form = document.getElementById('form') as HTMLFormElement;
  const cancelBtn = document.getElementById('cancel') as HTMLButtonElement;

  const current = await bridge.get();
  providerEl.value = current.provider;
  baseURLEl.value = current.baseURL || current.envBaseURL || '';
  modelEl.value = current.model;
  if (current.hasKey) apiKeyEl.placeholder = '•••••••• (saved — leave blank to keep)';
  if (current.hasAuthToken) authTokenEl.placeholder = '•••••••• (saved — leave blank to keep)';

  const aggressivenessEl = document.getElementById('aggressiveness') as HTMLInputElement;
  const aggressivenessHint = document.getElementById('aggressivenessHint') as HTMLSpanElement;
  aggressivenessEl.value = String(current.aggressiveness || 3);

  const LEVEL_LABELS = [
    '', 'Level 1: minimal — only hints when clearly stuck.',
    'Level 2: quiet — hints occasionally when idle.',
    'Level 3: balanced — hints when idle and useful.',
    'Level 4: active — hints freely when you pause.',
    'Level 5: very proactive — hints as often as possible.',
  ];
  function updateAggressivenessHint() {
    aggressivenessHint.textContent = LEVEL_LABELS[Number(aggressivenessEl.value)] || '';
  }
  aggressivenessEl.addEventListener('input', updateAggressivenessHint);
  updateAggressivenessHint();

  // Surface env-detected values so users see why their proxy setup will work
  // without any further input.
  if (current.envBaseURL || current.envHasAuthToken || current.envHasApiKey) {
    const bits: string[] = [];
    if (current.envBaseURL) bits.push(`<code>ANTHROPIC_BASE_URL</code> → <code>${escapeHtml(current.envBaseURL)}</code>`);
    if (current.envHasAuthToken) bits.push('<code>ANTHROPIC_AUTH_TOKEN</code> ✓');
    if (current.envHasApiKey) bits.push('<code>ANTHROPIC_API_KEY</code> / <code>OPENAI_API_KEY</code> ✓');
    envBanner.innerHTML =
      'Detected in environment: ' +
      bits.join(' · ') +
      ' — these will be used automatically. Save anything below to persist for launches outside this shell.';
    envBanner.hidden = false;
  }

  function isLocalUrl(url: string): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
    } catch {
      return false;
    }
  }

  function updateProviderRows(): void {
    const isOpenAI = providerEl.value === 'openai';

    // Endpoint URL is always shown (Anthropic users may need it for proxies),
    // just labelled differently.
    if (isOpenAI) {
      if (!baseURLEl.value) baseURLEl.value = 'https://api.openai.com/v1';
      baseURLOptional.textContent = '';
      baseURLHint.innerHTML =
        'Examples: <code>https://api.openai.com/v1</code>, ' +
        '<code>http://localhost:11434/v1</code> (Ollama), ' +
        '<code>https://openrouter.ai/api/v1</code>, ' +
        '<code>https://generativelanguage.googleapis.com/v1beta/openai</code> (Gemini).';
      providerHint.textContent =
        'Any OpenAI-compatible Chat Completions endpoint — OpenAI, Azure, OpenRouter, Groq, Gemini OpenAI-compat, Ollama, LM Studio, vLLM…';
      modelEl.placeholder = 'gpt-4o-mini';
      modelHint.textContent =
        'Use a vision-capable model. e.g. gpt-4o-mini, gpt-4o, gemini-2.5-flash, llava (Ollama).';
      authTokenRow.style.display = 'none';
    } else {
      baseURLOptional.textContent = '(optional — leave blank for api.anthropic.com)';
      baseURLHint.innerHTML =
        'Override only if routing through a proxy. ' +
        'Examples: <code>http://127.0.0.1:8787</code> (claude-code-router), ' +
        '<code>http://localhost:4000</code> (LiteLLM).';
      providerHint.textContent =
        'Uses the official Anthropic SDK with prompt caching. Respects ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN env vars.';
      modelEl.placeholder = 'claude-opus-4-7';
      modelHint.textContent =
        'Any vision-capable Claude model — claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5.';
      authTokenRow.style.display = '';
    }

    updateKeyHint();
  }

  function updateKeyHint(): void {
    const isOpenAI = providerEl.value === 'openai';
    const local = isOpenAI && isLocalUrl(baseURLEl.value);
    if (local) {
      apiKeyHint.innerHTML =
        '<code>localhost</code> endpoint detected — most local servers (Ollama, LM Studio, llama.cpp) don\'t need a key.';
    } else if (isOpenAI) {
      apiKeyHint.innerHTML =
        'Stored encrypted via your OS keychain. Leave blank to keep the existing key, or to use the <code>OPENAI_API_KEY</code> environment variable.';
    } else {
      apiKeyHint.innerHTML =
        'Stored encrypted via your OS keychain. Leave blank to keep the existing key, or to use the <code>ANTHROPIC_API_KEY</code> environment variable. Use the Auth token field below instead if your proxy uses Bearer auth.';
    }
  }

  function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
    );
  }

  providerEl.addEventListener('change', updateProviderRows);
  baseURLEl.addEventListener('input', updateKeyHint);
  updateProviderRows();

  cancelBtn.addEventListener('click', () => {
    void bridge.cancel();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;

    const payload: SetupSavePayload = {
      provider: providerEl.value === 'openai' ? 'openai' : 'anthropic',
      baseURL: baseURLEl.value.trim(),
      model: modelEl.value.trim(),
      aggressiveness: Number(aggressivenessEl.value) || 3,
      apiKey: apiKeyEl.value,
      authToken: authTokenEl.value,
    };

    if (!payload.model) {
      showError('Model name is required.');
      return;
    }
    if (payload.provider === 'openai' && !payload.baseURL) {
      showError('Endpoint URL is required for OpenAI-compatible providers.');
      return;
    }

    const res = await bridge.save(payload);
    if (!res.ok) showError(res.error || 'Could not save settings.');
  });

  function showError(msg: string): void {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }
})();
