// classifier.js
// Loads TensorFlow.js model and runs on-device prediction
// This runs INSIDE the browser — zero API calls needed

let model = null;
let vocab = null;
let isLoading = false;
let isReady = false;

const THRESHOLD = 0.2;
const MAX_LENGTH = 50;
const PAD_TOKEN = 0;
const UNK_TOKEN = 1;

// ─────────────────────────────────────────
// Load model and vocabulary
// Called once when extension starts
// ─────────────────────────────────────────
async function loadModel() {
  if (isReady || isLoading) return;
  isLoading = true;

  try {
    // Get the extension's base URL
    const modelUrl = chrome.runtime.getURL('tfjs_model/model.json');
    const vocabUrl = chrome.runtime.getURL('tfjs_model/vocab.json');

    // Load vocabulary first
    const vocabResponse = await fetch(vocabUrl);
    vocab = await vocabResponse.json();

    // Load TF.js model
    model = await tf.loadLayersModel(modelUrl);

    isReady = true;
    isLoading = false;
    console.log('ToneGuard: Pre-filter model loaded!');

  } catch (error) {
    isLoading = false;
    console.log('ToneGuard: Model load failed:', error);
  }
}

// ─────────────────────────────────────────
// Clean and tokenize text
// Same as Python tokenizer in Colab
// ─────────────────────────────────────────
function cleanText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s!?.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function textToSequence(text) {
  const words = cleanText(text).split(' ');
  const wordToIdx = vocab.word_to_idx;

  // Convert words to indices
  let sequence = words.map(w => wordToIdx[w] !== undefined
    ? wordToIdx[w]
    : UNK_TOKEN
  );

  // Truncate if too long
  sequence = sequence.slice(0, MAX_LENGTH);

  // Pad if too short
  while (sequence.length < MAX_LENGTH) {
    sequence.push(PAD_TOKEN);
  }

  return sequence;
}

// ─────────────────────────────────────────
// Main prediction function
// Returns true if message is negative
// Returns false if message is not negative
// ─────────────────────────────────────────
async function isNegative(text) {
  // If model not ready, default to sending to Groq
  if (!isReady || !model || !vocab) {
    return true;
  }

  try {
    // Convert text to sequence
    const sequence = textToSequence(text);

    // Create tensor
    const inputTensor = tf.tensor2d([sequence], [1, MAX_LENGTH]);

    // Run prediction
    const prediction = model.predict(inputTensor);
    const score = (await prediction.data())[0];

    // Clean up tensors to prevent memory leak
    inputTensor.dispose();
    prediction.dispose();

    console.log(`ToneGuard PreFilter: "${text.slice(0, 30)}..." → score: ${score.toFixed(3)} → ${score > THRESHOLD ? 'NEGATIVE' : 'not negative'}`);

    return score > THRESHOLD;

  } catch (error) {
    console.log('ToneGuard: Prediction error:', error);
    return true; // default to sending to Groq on error
  }
}

// Load model immediately when script runs
loadModel();