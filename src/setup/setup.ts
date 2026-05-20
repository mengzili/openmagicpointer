// No module syntax — tsc with module=commonjs would emit `exports.…` which
// throws when the file is loaded via a plain <script> tag in the renderer.

interface SetupGetResponse {
  provider: 'anthropic' | 'openai';
  baseURL: string;
  model: string;
  hasKey: boolean;
}

interface SetupSavePayload {
  provider: 'anthropic' | 'openai';
  baseURL: string;
  model: string;
  apiKey: string;
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
  const modelEl = document.getElementById('model') as HTMLInputElement;
  const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement;
  const apiKeyHint = document.getElementById('apiKeyHint') as HTMLSpanElement;
  const providerHint = document.getElementById('providerHint') as HTMLSpanElement;
  const modelHint = document.getElementById('modelHint') as HTMLSpanElement;
  const errorBox = document.getElementById('error') as HTMLDivElement;
  const form = document.getElementById('form') as HTMLFormElement;
  const cancelBtn = document.getElementById('cancel') as HTMLButtonElement;

  const current = await bridge.get();
  providerEl.value = current.provider;
  baseURLEl.value = current.baseURL;
  modelEl.value = current.model;
  if (current.hasKey) {
    apiKeyEl.placeholder = '•••••••• (saved — leave blank to keep)';
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
    baseURLRow.style.display = isOpenAI ? '' : 'none';

    if (isOpenAI) {
      if (!baseURLEl.value) baseURLEl.value = 'https://api.openai.com/v1';
      providerHint.textContent =
        'Any OpenAI-compatible Chat Completions endpoint — OpenAI, Azure, OpenRouter, Groq, Gemini OpenAI-compat, Ollama, LM Studio, vLLM…';
      modelEl.placeholder = 'gpt-4o-mini';
      modelHint.textContent =
        'Use a vision-capable model. e.g. gpt-4o-mini, gpt-4o, gemini-2.5-flash, llava (Ollama).';
    } else {
      providerHint.textContent = 'Uses the official Anthropic SDK with prompt caching.';
      modelEl.placeholder = 'claude-opus-4-7';
      modelHint.textContent = 'Any vision-capable Claude model — claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5.';
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
        'Stored encrypted via your OS keychain. Leave blank to keep the existing key, or to use the <code>ANTHROPIC_API_KEY</code> environment variable.';
    }
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
      provider: (providerEl.value === 'openai' ? 'openai' : 'anthropic'),
      baseURL: baseURLEl.value.trim(),
      model: modelEl.value.trim(),
      apiKey: apiKeyEl.value, // raw — empty means "keep existing"
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
