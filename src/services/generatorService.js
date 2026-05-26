const { faker } = require('@faker-js/faker');
const store = require('../store/dbStore');

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Health', 'Other'];
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Gifts', 'Investments', 'Refund', 'Other'];

let generatorInterval = null;
let wsClients = new Set();

const registerClient = (ws) => { wsClients.add(ws); ws.on('close', () => wsClients.delete(ws)); };
const broadcast = (eventType, data) => {
  const message = JSON.stringify({ type: eventType, data });
  wsClients.forEach((client) => { if (client.readyState === 1) client.send(message); });
};

const generateFakeTransaction = (tripId = null, userId = null) => {
  const type = faker.helpers.arrayElement(['expense', 'income']);
  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return { type, title: faker.helpers.arrayElement([faker.commerce.productName(), faker.lorem.words(2)]), amount: parseFloat(faker.finance.amount({ min: 5, max: 1500, dec: 2 })), category: faker.helpers.arrayElement(categories), date: faker.date.between({ from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), to: new Date() }).toISOString().split('T')[0], tripId: tripId || null, userId: userId || null };
};

const startGenerator = (batchSize = 3, intervalMs = 2000, tripId = null, userId = null) => {
  if (generatorInterval) return { started: false, message: 'Generator already running' };
  generatorInterval = setInterval(async () => {
    const batch = [];
    for (let i = 0; i < batchSize; i++) { const t = await store.addTransaction(generateFakeTransaction(tripId, userId)); batch.push(t); }
    const result = await store.getTransactions(tripId, 1, 1, null, userId);
    broadcast('NEW_TRANSACTIONS', { batch, total: result.pagination.total, statistics: await store.getStatistics(tripId, userId) });
  }, intervalMs);
  return { started: true, message: `Generator started — ${batchSize} transactions every ${intervalMs}ms` };
};

const stopGenerator = () => {
  if (!generatorInterval) return { stopped: false, message: 'Generator is not running' };
  clearInterval(generatorInterval);
  generatorInterval = null;
  broadcast('GENERATOR_STOPPED', { message: 'Generator stopped' });
  return { stopped: true, message: 'Generator stopped' };
};

const isRunning = () => generatorInterval !== null;
module.exports = { startGenerator, stopGenerator, isRunning, registerClient, broadcast };