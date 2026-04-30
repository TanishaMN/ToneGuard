// popup.js
// Handles all the logic for the popup UI

// ─────────────────────────────────────────
// On popup open — load saved settings
// ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  
  // Load saved settings from Chrome storage
  chrome.storage.sync.get(['enabled', 'sensitivity'], (settings) => {
    
    // Set toggle state
    const toggle = document.getElementById('enabled-toggle');
    toggle.checked = settings.enabled !== false; // default true

    // Set sensitivity button state
    const sensitivity = settings.sensitivity || 'medium';
    document.querySelectorAll('.sens-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.value === sensitivity) {
        btn.classList.add('active');
      }
    });
  });

  // Check if backend is running
  checkBackendStatus();
});

// ─────────────────────────────────────────
// Toggle — enable/disable extension
// ─────────────────────────────────────────

document.getElementById('enabled-toggle').addEventListener('change', (e) => {
  const enabled = e.target.checked;
  
  chrome.storage.sync.set({ enabled }, () => {
    console.log('ToneGuard: enabled =', enabled);
  });
});

// ─────────────────────────────────────────
// Sensitivity buttons
// ─────────────────────────────────────────

document.querySelectorAll('.sens-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    
    // Remove active from all buttons
    document.querySelectorAll('.sens-btn').forEach(b => {
      b.classList.remove('active');
    });
    
    // Add active to clicked button
    btn.classList.add('active');
    
    // Save to Chrome storage
    const sensitivity = btn.dataset.value;
    chrome.storage.sync.set({ sensitivity }, () => {
      console.log('ToneGuard: sensitivity =', sensitivity);
    });
  });
});

// ─────────────────────────────────────────
// Check if FastAPI backend is running
// ─────────────────────────────────────────

async function checkBackendStatus() {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');

  try {
    // Ping the backend health check endpoint
    const response = await fetch('https://toneguard-api.onrender.com/health', {
      method: 'GET',
    });

    if (response.ok) {
      // Backend is running
      dot.classList.remove('offline');
      text.textContent = 'Backend connected';
    } else {
      throw new Error('Backend error');
    }

  } catch (error) {
    // Backend is not running
    dot.classList.add('offline');
    text.textContent = 'Backend offline — start server';
  }
}