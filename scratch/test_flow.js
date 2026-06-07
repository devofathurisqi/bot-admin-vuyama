const db = require('../src/utils/db');
const messageHandler = require('../src/handlers/messageHandler');
const workflow = require('../src/utils/workflow');

async function runTests() {
  const testNumber = '62899999999@c.us';
  
  try {
    console.log('=== TEST 1: Register Customer & Verify RAG ===');
    // Ensure test customer is deleted first
    await db('customers').where('phone_number', testNumber).del();
    
    // Register customer
    await db('customers').insert({
      phone_number: testNumber,
      name: 'Test Customer Vuyama',
      status: 'NORMAL',
      created_at: new Date(),
      updated_at: new Date()
    });
    console.log('Test customer registered.');

    // Mock incoming message
    const msg1 = 'Paris Japan vs Paris Legend bedanya apa ya kak? Dan berapa harganya?';
    console.log(`Sending message: "${msg1}"`);
    
    // Check pause state before sending
    let customer = await db('customers').where('phone_number', testNumber).first();
    const isPausedBefore = customer.paused_until && new Date(customer.paused_until) > new Date();
    console.log('Is bot paused before admin reply?', !!isPausedBefore);

    // Generate response
    const response1 = await messageHandler.generateResponse(testNumber, msg1, customer.status);
    console.log('Bot Response intent:', response1.intent);
    console.log('Bot Response text:\n', response1.response);
    
    if (response1.response.includes('[COMPARISON_SHEET]')) {
      console.log('SUCCESS: Bot correctly appended [COMPARISON_SHEET] tag for comparison request!');
    } else {
      console.log('WARNING: Bot did not append [COMPARISON_SHEET] tag.');
    }

    console.log('\n=== TEST 2: Admin Replies (Triggers Bot Pause) ===');
    console.log('Mocking admin manual reply from phone...');
    // Admin replies from phone
    await workflow.pauseBotForCustomer(testNumber, 12);
    
    // Verify customer status updated in DB
    customer = await db('customers').where('phone_number', testNumber).first();
    const isPausedAfter = customer.paused_until && new Date(customer.paused_until) > new Date();
    console.log('Customer Status in DB:', customer.status);
    console.log('Customer Paused Until:', customer.paused_until);
    console.log('Is bot paused after admin reply?', !!isPausedAfter);
    
    if (isPausedAfter && customer.status === 'WAITING_HUMAN') {
      console.log('SUCCESS: Bot successfully paused for 12 hours and status set to WAITING_HUMAN!');
    } else {
      console.error('FAIL: Bot pause logic failed!');
    }

    console.log('\n=== TEST 3: Bot CS Resume ===');
    console.log('Mocking manual resume from dashboard...');
    await workflow.resumeBotForCustomer(testNumber);
    
    customer = await db('customers').where('phone_number', testNumber).first();
    const isPausedResume = customer.paused_until && new Date(customer.paused_until) > new Date();
    console.log('Customer Status in DB:', customer.status);
    console.log('Is bot paused after resume?', !!isPausedResume);
    
    if (!isPausedResume && customer.status === 'NORMAL') {
      console.log('SUCCESS: Bot successfully resumed and status set to NORMAL!');
    } else {
      console.error('FAIL: Bot resume logic failed!');
    }

    // Cleanup test data
    await db('customers').where('phone_number', testNumber).del();
    console.log('\nTest customer cleaned up.');
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await db.destroy();
  }
}

runTests();
