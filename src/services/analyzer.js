const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require('../utils/logger');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!API_KEY) {
  logger.error("GEMINI_API_KEY is not defined in environment variables for analyzer service");
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * Call Gemini API to analyze the conversation, update memory, extract intent,
 * and check if the intent is clear.
 * 
 * @param {string} phoneNumber - Customer phone number
 * @param {Array} activeHistory - Array of raw messages from the last 3 days
 * @param {string} latestMessage - Customer's latest message
 * @param {Object} currentMemory - Current memory object { summary, conversation_state, extracted_intent }
 * @returns {Promise<Object>} - Analyzed context: { summary, extracted_intent, is_intent_clear, clarification_question, conversation_state }
 */
const analyzeConversation = async (phoneNumber, activeHistory, latestMessage, currentMemory = null) => {
  if (!genAI) {
    logger.warn('Gemini client for analyzer is not initialized due to missing API key. Falling back to default analysis.');
    return getFallbackAnalysis(latestMessage, currentMemory);
  }

  const prompt = `You are the conversation brain for Vuyama (AI WhatsApp Admin Assistant named Vumin).
Your job is to analyze the customer's latest message in context of their 3-day history and current memory.
You must:
1. Update the conversation summary (compressing details from the last 3 days).
2. Extract the customer's intent.
3. Determine if the customer's request is clear or unclear/ambiguous.
4. Draft a friendly clarifying question if the intent is unclear.
5. Update the conversation state.

Current Memory:
- Summary: ${currentMemory && currentMemory.summary ? currentMemory.summary : 'No summary yet.'}
- State: ${currentMemory && currentMemory.conversation_state ? currentMemory.conversation_state : 'idle'}
- Last Intent: ${currentMemory && currentMemory.extracted_intent ? currentMemory.extracted_intent : 'None'}

Active 3-Day Chat History:
${activeHistory.map(h => `${h.sender === 'customer' ? 'Customer' : h.sender === 'agent' ? 'Admin' : 'Bot'}: ${h.message}`).join('\n')}
Latest Message from Customer: "${latestMessage}"

INTENT CLARITY RULES:
- Set "is_intent_clear" to false if:
  * The customer says words like "iya", "yang itu", "jadi gimana?", "jadi gimana kak?", "terus?", "mau donk", "ooh gitu" without specifying what product/service/offer they mean.
  * The customer is asking to order but has not specified what they want to order and you cannot infer it from the 3-day context.
  * The customer's request is ambiguous or vague, or refers to some previous context that is missing or not fully specified (e.g. "warnanya ready?", "ukurannya apa aja?" without mentioning what hijab/mukena they are referring to).
- Set "is_intent_clear" to true if the query is clear, standard FAQ, greeting, or is complete.

CLARIFICATION QUESTION RULES:
- The question must be written in a warm, friendly, natural Indonesian language matching the Vuyama CS tone.
- Use emojis and gentle WhatsApp abbreviations (like "ya kak", "ready kak").
- Refer specifically to the ambiguity. E.g. If they said "yang itu", ask: "Maksud Kakak produk Paris Japan or Paris Jadul? 😊" or "Bahan label yang akrilik atau plat besi kak? agar Vumin tidak salah info... 😊".

You MUST return a JSON object with the following fields:
{
  "summary": "String (max 3-4 sentences summarizing recent discussions, focusing on details relevant for the admin/AI to know)",
  "extracted_intent": "GREETING | PRODUCT_INQUIRY | ORDER_INTENT | ORDER_FORMAT | DROPSHIP_INFO | LABEL_INFO | SHIPPING_INFO | COMPLAINT | OTHER",
  "is_intent_clear": true/false,
  "clarification_question": "String (or null if is_intent_clear is true)",
  "conversation_state": "greeting | product_discussion | reseller_inquiry | order_drafting | complaint_escalation | idle"
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    const content = result.response.text().trim();
    const parsed = JSON.parse(content);

    return {
      summary: parsed.summary || '',
      extracted_intent: parsed.extracted_intent || 'OTHER',
      is_intent_clear: parsed.is_intent_clear !== false,
      clarification_question: parsed.is_intent_clear === false ? (parsed.clarification_question || 'Bisa dijelaskan lebih detail kak agar kami bantu dengan tepat? 😊') : null,
      conversation_state: parsed.conversation_state || 'idle'
    };
  } catch (error) {
    logger.error({ err: error }, 'Error in Gemini analyzeConversation');
    return getFallbackAnalysis(latestMessage, currentMemory);
  }
};

/**
 * Fallback analyzer if Gemini API fails or is not configured
 */
const getFallbackAnalysis = (latestMessage, currentMemory) => {
  const normalized = latestMessage.trim().toLowerCase();
  
  // Basic heuristic analysis
  let intent = 'OTHER';
  let isClear = true;
  let clarification = null;
  let state = currentMemory ? currentMemory.conversation_state : 'idle';

  if (/^(halo|hai|assalamu|p\b)/i.test(normalized)) {
    intent = 'GREETING';
    state = 'greeting';
  } else if (/komplain|kecewa|salah kirim|jelek|lambat/i.test(normalized)) {
    intent = 'COMPLAINT';
    state = 'complaint_escalation';
  } else if (/cara order|order|pesan|format/i.test(normalized)) {
    intent = 'ORDER_INTENT';
    state = 'order_drafting';
  } else if (normalized === 'iya' || normalized === 'yang itu' || normalized === 'jadi gimana') {
    intent = 'OTHER';
    isClear = false;
    clarification = 'Bisa dibantu diperjelas maksudnya kak? Biar kami tidak salah memberikan informasi... 😊';
  }

  return {
    summary: currentMemory ? currentMemory.summary : 'Percakapan berlangsung.',
    extracted_intent: intent,
    is_intent_clear: isClear,
    clarification_question: clarification,
    conversation_state: state
  };
};

module.exports = {
  analyzeConversation,
  MODEL_NAME
};
