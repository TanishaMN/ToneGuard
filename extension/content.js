// ToneGuard content.js v2.0

const TYPING_DELAY = 2500;      // 2.5 seconds — reduced API calls
const MIN_LENGTH = 10;           // minimum characters to analyze
const SIMILARITY_THRESHOLD = 0.85; // skip if text is 85% same as last

let typingTimer = null;
let currentInput = null;
let lastAnalyzedText = '';       // stores last analyzed text
let lastResult = null;           // stores last tone result

// ─────────────────────────────────────────
// Text similarity check
// Prevents API call if text barely changed
// ─────────────────────────────────────────
function getSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(s1, s2) {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// ─────────────────────────────────────────
// Attach listeners to all text inputs
// ─────────────────────────────────────────
function attachToInputs() {
  const selectors = [
    'textarea',
    'input[type="text"]',
    '[contenteditable="true"]',
    '[role="textbox"]',
  ];

  const inputs = document.querySelectorAll(selectors.join(','));
  inputs.forEach(input => {
    if (input.dataset.toneguardAttached) return;
    input.dataset.toneguardAttached = 'true';
    input.addEventListener('input', () => handleTyping(input));
    input.addEventListener('focus', () => { currentInput = input; });
    input.addEventListener('blur', () => {
      // small delay so click on tone bar doesn't close it
      setTimeout(() => {
        const bar = document.getElementById('toneguard-bar');
        if (bar && !bar.matches(':hover')) {
          // don't remove — let user interact with suggestions
        }
      }, 200);
    });
  });
}

// ─────────────────────────────────────────
// Handle typing
// ─────────────────────────────────────────
function handleTyping(input) {
  const text = (input.value || input.innerText || '').trim();

  if (text.length < MIN_LENGTH) {
    removeToneBar();
    lastAnalyzedText = '';
    return;
  }

  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    analyzeToneOnly(text, input);
  }, TYPING_DELAY);
}

// ─────────────────────────────────────────
// Step 1 — Analyze tone only (cheap call)
// No suggestions yet — saves API quota
// ─────────────────────────────────────────
async function analyzeToneOnly(text, input) {
  // Skip if text is too similar to last analyzed
  const similarity = getSimilarity(text, lastAnalyzedText);
  if (similarity >= SIMILARITY_THRESHOLD && lastResult) {
    console.log('ToneGuard: Skipping — text too similar');
    showTonePillOnly(lastResult, input);
    return;
  }

  try {
    // ─────────────────────────────────────────
    // PRE-FILTER — run TF.js model locally first
    // Zero API calls for non-negative messages
    // ─────────────────────────────────────────
    const negative = await isNegative(text);

    if (!negative) {
      // Message is not negative — show neutral instantly
      // No API call needed!
      console.log('ToneGuard: Pre-filter says NOT negative — skipping API');
      lastAnalyzedText = text;
      lastResult = {
        anger: 0.0,
        passive_aggressive: 0.0,
        sarcasm: 0.0,
        warmth: 0.1,
        neutral: 0.9,
        assertive: 0.1,
        negative_tone_detected: false,
        used_fallback: false,
        error_message: null
      };
      showTonePillOnly(lastResult, input, false);
      return;
    }

    // Message is potentially negative — call Groq
    console.log('ToneGuard: Pre-filter says NEGATIVE — calling backend');
    showLoadingBar();

    const response = await fetch('https://toneguard-api.onrender.com/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        get_suggestions: false
      })
    });

    if (!response.ok) throw new Error('Backend error');

    const result = await response.json();
    lastAnalyzedText = text;
    lastResult = result;

    showTonePillOnly(result, input, result.used_fallback);

  } catch (error) {
    removeToneBar();
    console.log('ToneGuard: Backend not available', error);
  }
}

// ─────────────────────────────────────────
// Step 2 — Get suggestions (only on demand)
// Called when user clicks "Get suggestions"
// ─────────────────────────────────────────
async function getSuggestions(text, input) {
  try {
    // Show loading in suggestions area
    const suggestionsArea = document.getElementById('tg-suggestions-area');
    if (suggestionsArea) {
      suggestionsArea.innerHTML = `
        <div class="tg-loading">
          <span class="tg-dot"></span>
          <span class="tg-dot"></span>
          <span class="tg-dot"></span>
          <span class="tg-loading-text">Getting suggestions...</span>
        </div>
      `;
    }

    const response = await fetch('https://toneguard-api.onrender.com/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        get_suggestions: true  // now we want suggestions
      })
    });

    if (!response.ok) throw new Error('Backend error');

    const result = await response.json();

    // Update suggestions area
    if (suggestionsArea) {
      if (result.used_fallback) {
        suggestionsArea.innerHTML = `
          <div class="tg-error-msg">
            ToneGuard is facing some technical issues — 
            it might not give you the best suggestions right now.
            Tone detection is still working.
          </div>
        `;
      } else {
        suggestionsArea.innerHTML = buildSuggestionsHTML(result);
        attachUseButtons(input);
      }
    }

  } catch (error) {
    const suggestionsArea = document.getElementById('tg-suggestions-area');
    if (suggestionsArea) {
      suggestionsArea.innerHTML = `
        <div class="tg-error-msg">
          ToneGuard is facing some technical issues — 
          it might not give you the best suggestions right now.
        </div>
      `;
    }
  }
}

// ─────────────────────────────────────────
// Show tone pill only (no suggestions)
// ─────────────────────────────────────────
function showTonePillOnly(result, input, hasFallbackError = false) {
  removeToneBar();

  // Option C — if fallback, show ONLY error, no tone pill
  if (hasFallbackError) {
    const bar = document.createElement('div');
    bar.id = 'toneguard-bar';
    bar.innerHTML = `
      <div class="tg-header">
        <span class="tg-logo">ToneGuard</span>
        <button class="tg-close" id="tg-close-btn">×</button>
      </div>
      <div class="tg-error-msg">
        ToneGuard is facing some technical issues — 
        please try again in a moment.
      </div>
    `;
    document.body.appendChild(bar);
    document.getElementById('tg-close-btn').addEventListener('click', () => {
      removeToneBar();
    });
    return;
  }

  // Normal flow — show tone pill + get suggestions button
  const tones = ['anger', 'passive_aggressive', 'sarcasm', 'warmth', 'neutral', 'assertive'];
  const detected = tones.filter(t => result[t] > 0.5);

  const pillsHTML = detected.length > 0
    ? detected.map(tone => {
        const score = Math.round(result[tone] * 100);
        return `<span class="tg-pill tg-${tone}">${tone.replace('_', ' ')} ${score}%</span>`;
      }).join('')
    : `<span class="tg-pill tg-neutral">neutral</span>`;

  const bar = document.createElement('div');
  bar.id = 'toneguard-bar';
  bar.innerHTML = `
    <div class="tg-header">
      <span class="tg-logo">ToneGuard</span>
      <div class="tg-pills">${pillsHTML}</div>
      <button class="tg-close" id="tg-close-btn">×</button>
    </div>
    <div class="tg-divider"></div>
    <button class="tg-get-suggestions-btn" id="tg-get-suggestions-btn">
      Get suggestions
    </button>
    <div id="tg-suggestions-area"></div>
  `;

  document.body.appendChild(bar);

  document.getElementById('tg-close-btn').addEventListener('click', () => {
    removeToneBar();
  });

  document.getElementById('tg-get-suggestions-btn').addEventListener('click', () => {
    const text = (input.value || input.innerText || '').trim();
    document.getElementById('tg-get-suggestions-btn').style.display = 'none';
    getSuggestions(text, input);
  });
}

// ─────────────────────────────────────────
// Build suggestions HTML
// ─────────────────────────────────────────
function formatText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>');
}

function buildSuggestionsHTML(result) {
  const suggestions = [
    { text: result.rewrite_1, label: result.rewrite_1_label || 'Professional' },
    { text: result.rewrite_2, label: result.rewrite_2_label || 'Friendly' },
    { text: result.rewrite_3, label: result.rewrite_3_label || 'Concise' },
  ].filter(s => s.text);

  if (suggestions.length === 0) {
    return `<div class="tg-error-msg">No suggestions available right now.</div>`;
  }

  return `
    <div class="tg-suggestions-label">Suggestions</div>
    ${suggestions.map((s, i) => `
      <div class="tg-suggestion-card">
        <div class="tg-suggestion-header">
          <span class="tg-suggestion-tag">${s.label}</span>
          <button class="tg-use-btn" 
            data-index="${i}" 
            data-text="${encodeURIComponent(s.text)}">
            Use this
          </button>
        </div>
        <div class="tg-suggestion-text">${formatText(s.text)}</div>
      </div>
    `).join('')}
  `;
}

// ─────────────────────────────────────────
// Attach "Use this" button handlers
// ─────────────────────────────────────────
function attachUseButtons(input) {
  document.querySelectorAll('.tg-use-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Strip markdown before applying
      let text = decodeURIComponent(btn.dataset.text);
      text = text.replace(/\*\*(.*?)\*\*/g, '$1');
      text = text.replace(/_(.*?)_/g, '$1');

      if (input) {
        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
          input.value = text;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // contenteditable — Gmail, Slack, LinkedIn
          input.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, text);
        }
      }

      btn.textContent = 'Applied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Use this';
        btn.classList.remove('copied');
      }, 2000);

      setTimeout(() => removeToneBar(), 1500);
    });
  });
}

// ─────────────────────────────────────────
// Loading bar
// ─────────────────────────────────────────
function showLoadingBar() {
  removeToneBar();
  const bar = document.createElement('div');
  bar.id = 'toneguard-bar';
  bar.innerHTML = `
    <div class="tg-header">
      <span class="tg-logo">ToneGuard</span>
    </div>
    <div class="tg-loading">
      <span class="tg-dot"></span>
      <span class="tg-dot"></span>
      <span class="tg-dot"></span>
      <span class="tg-loading-text">Analyzing tone...</span>
    </div>
  `;
  document.body.appendChild(bar);
}

function removeToneBar() {
  const existing = document.getElementById('toneguard-bar');
  if (existing) existing.remove();
}

// ─────────────────────────────────────────
// Watch for dynamically added inputs
// ─────────────────────────────────────────
const observer = new MutationObserver(() => {
  attachToInputs();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

attachToInputs();
console.log('ToneGuard: Active v2.0');