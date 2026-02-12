require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Case = require('./models/Case');
  const cases = await Case.find({ 'agentResults.schedulingAgent': { $exists: true } }).sort({createdAt:-1}).limit(10).lean();
  cases.forEach(c => {
    const s = c.agentResults.schedulingAgent;
    console.log(c.caseId, '| state:', c.currentState, '| sched.status:', s.status, '| hasConfirmed:', !!s.confirmedAppointment, '| suggCount:', (s.suggestions || []).length);
  });
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
