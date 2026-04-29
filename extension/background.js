// background.js
// Runs silently in the background even when popup is closed
// Acts as a bridge between content.js and the extension

// Listen for when extension is first installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('ToneGuard installed successfully!');
  
  // Set default settings when extension is first installed
  chrome.storage.sync.set({
    enabled: true,          // extension is on by default
    sensitivity: 'medium',  // medium sensitivity by default
  });
});

// Listen for messages from content.js or popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.type === 'GET_SETTINGS') {
    // popup.js or content.js asking for current settings
    chrome.storage.sync.get(['enabled', 'sensitivity'], (settings) => {
      sendResponse(settings);
    });
    return true; // keeps message channel open for async response
  }

  if (message.type === 'UPDATE_SETTINGS') {
    // popup.js sending updated settings
    chrome.storage.sync.set(message.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }

});