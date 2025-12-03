// Imagen 4 page interactions
(function() {
  const $ = (sel) => document.querySelector(sel);
  const promptEl = $('#prompt');
  const ratioEl = $('#ratio');
  const countEl = $('#count');
  const btnGen = $('#btnGen');
  const btnClear = $('#btnClear');
  const statusEl = $('#status');
  const resultsEl = $('#results');
  const logEl = $('#log');
  const backendEl = $('#backend');
  const useDirectEl = $('#use-direct');
  const keyFieldEl = $('#key-field');
  const apiKeyEl = $('#apiKey');
  const rememberKeyEl = $('#rememberKey');

  const LS_KEY = 'imagen4_api_key';

  function setStatus(text, danger = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('danger', !!danger);
  }

  function appendLog(entry) {
    try {
      if (typeof entry === 'string') {
        logEl.textContent = `${logEl.textContent}\n${entry}`.trim();
      } else {
        const s = JSON.stringify(entry, null, 2);
        logEl.textContent = `${logEl.textContent}\n${s}`.trim();
      }
    } catch (e) {
      logEl.textContent = `${logEl.textContent}\n[log error] ${e}`.trim();
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function clearResults() {
    resultsEl.innerHTML = '';
    logEl.textContent = '';
    setStatus('就绪');
  }

  function makeThumb(src, idx) {
    const wrap = document.createElement('div');
    wrap.className = 'thumb';
    const img = document.createElement('img');
    img.alt = `生成图片 ${idx+1}`;
    img.loading = 'lazy';
    img.src = src;
    const bar = document.createElement('div');
    bar.className = 'bar';
    const aOpen = document.createElement('a');
    aOpen.className = 'btn outline';
    aOpen.textContent = '新窗口打开';
    aOpen.href = src;
    aOpen.target = '_blank';
    aOpen.rel = 'noopener';
    const aDl = document.createElement('a');
    aDl.className = 'btn';
    aDl.textContent = '下载';
    aDl.href = src;
    aDl.download = `imagen4_${Date.now()}_${idx+1}.png`;
    bar.append(aOpen, aDl);
    wrap.append(img, bar);
    return wrap;
  }

  function itemToSrc(item) {
    try {
      if (!item) return null;
      if (typeof item === 'string') {
        if (item.startsWith('data:')) return item;
        if (/^https?:\/\//.test(item)) return item;
        // assume raw base64
        return `data:image/png;base64,${item}`;
      }
      if (item.url) return item.url;
      if (item.b64) return `data:image/png;base64,${item.b64}`;
      if (item.base64) return `data:image/png;base64,${item.base64}`;
      if (item.dataUrl) return item.dataUrl;
      if (item.image && (item.image.base64 || item.image.b64)) {
        return `data:image/png;base64,${item.image.base64 || item.image.b64}`;
      }
    } catch (e) {
      appendLog({ parse_item_error: String(e) });
    }
    return null;
  }

  async function generateViaProxy({ backend, prompt, ratio, count }) {
    const payload = {
      prompt,
      aspect_ratio: ratio,
      number_of_images: Number(count)
    };
    const res = await fetch(backend, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`代理返回状态 ${res.status}: ${txt}`);
    }
    const json = await res.json();
    appendLog({ proxy_response_keys: Object.keys(json || {}) });
    const items = (json && (json.images || json.results || json.data)) || [];
    return items.map(itemToSrc).filter(Boolean);
  }

  async function generateViaDirect({ apiKey, prompt, ratio, count }) {
    // 尝试使用 Google GenAI 风格 generateImages 接口（可能随服务变更）
    // 强烈建议使用后端代理！
    const url = 'https://aihubmix.com/gemini/v1beta/models/imagen-4.0-fast-generate-001:generateImages';
    const payload = {
      // 该负载结构根据公开资料推测，实际以服务方为准
      prompt,
      numberOfImages: Number(count),
      aspectRatio: ratio
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`直连失败 ${res.status}: ${txt}`);
    }
    const json = await res.json();
    appendLog({ direct_response_keys: Object.keys(json || {}) });
    // 兼容几种可能字段名
    const arr = json.generated_images || json.images || json.results || [];
    const items = arr.map((g) => {
      if (g?.image?.image_bytes) {
        // 原始 bytes base64
        return `data:image/png;base64,${g.image.image_bytes}`;
      }
      return itemToSrc(g);
    }).filter(Boolean);
    if (!items.length) appendLog(json);
    return items;
  }

  async function onGenerate() {
    const prompt = (promptEl.value || '').trim();
    const ratio = ratioEl.value;
    const count = Math.max(1, Math.min(4, Number(countEl.value || 1)));
    const backend = (backendEl.value || '').trim();
    const useDirect = !!useDirectEl.checked;
    const apiKey = apiKeyEl.value.trim();

    if (!prompt) {
      setStatus('请输入英文 Prompt', true);
      return;
    }
    if (useDirect && !apiKey) {
      setStatus('直连需要 API Key', true);
      return;
    }

    btnGen.disabled = true;
    setStatus('正在生成...');
    appendLog({ ts: new Date().toISOString(), prompt, ratio, count, mode: useDirect ? 'direct' : 'proxy' });

    try {
      const t0 = performance.now();
      const srcs = useDirect
        ? await generateViaDirect({ apiKey, prompt, ratio, count })
        : await generateViaProxy({ backend, prompt, ratio, count });
      const dt = ((performance.now() - t0) / 1000).toFixed(2);
      setStatus(`完成：${srcs.length} 张 · ${dt}s`);
      if (!srcs.length) {
        appendLog('[warn] 未获得图片，请检查日志或切换模式');
      }
      srcs.forEach((src, i) => resultsEl.appendChild(makeThumb(src, i)));
    } catch (err) {
      console.error(err);
      setStatus(String(err.message || err), true);
      appendLog({ error: String(err), stack: String(err.stack || '') });
    } finally {
      btnGen.disabled = false;
    }
  }

  // Events
  useDirectEl.addEventListener('change', () => {
    keyFieldEl.style.display = useDirectEl.checked ? '' : 'none';
  });

  rememberKeyEl.addEventListener('change', () => {
    try {
      if (rememberKeyEl.checked) {
        localStorage.setItem(LS_KEY, apiKeyEl.value || '');
      } else {
        localStorage.removeItem(LS_KEY);
      }
    } catch (_) {}
  });

  apiKeyEl.addEventListener('input', () => {
    if (rememberKeyEl.checked) {
      try { localStorage.setItem(LS_KEY, apiKeyEl.value || ''); } catch (_) {}
    }
  });

  btnGen.addEventListener('click', (e) => { e.preventDefault(); onGenerate(); });
  btnClear.addEventListener('click', (e) => { e.preventDefault(); clearResults(); });

  // Init
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      apiKeyEl.value = saved;
      rememberKeyEl.checked = true;
    }
  } catch (_) {}
})();

