require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const SC = require('./models/ServiceCenter');
  const Case = require('./models/Case');

  // 1. Get Gurugram center
  const center = await SC.findOne({ serviceCenterId: 'SC-HR-GGN-001' }).lean();
  console.log('CENTER _id:', center._id.toString());
  console.log('CENTER serviceCenterId:', center.serviceCenterId);
  console.log('CENTER name:', center.name);

  const centerMongoId = center._id.toString();
  const centerStringId = center.serviceCenterId;
  const centerName = center.name;

  // 2. Get confirmed case
  const cc = await Case.findOne({ currentState: 'APPOINTMENT_CONFIRMED' }).lean();
  if (!cc) { console.log('NO CONFIRMED CASE FOUND'); process.exit(0); }

  const conf = cc.agentResults?.schedulingAgent?.confirmedAppointment;
  console.log('\nCONFIRMED APPOINTMENT:');
  console.log('  serviceCenterId:', JSON.stringify(conf?.serviceCenterId));
  console.log('  serviceCenter:', JSON.stringify(conf?.serviceCenter));
  console.log('  centerName:', JSON.stringify(conf?.centerName));
  console.log('  date:', conf?.date);
  console.log('  timeSlot:', conf?.timeSlot);

  // 3. Test matching
  const idStr = conf?.serviceCenterId?.toString();
  console.log('\nMATCHING:');
  console.log('  idStr === centerMongoId:', idStr === centerMongoId, `("${idStr}" vs "${centerMongoId}")`);
  console.log('  idStr === centerStringId:', idStr === centerStringId, `("${idStr}" vs "${centerStringId}")`);
  console.log('  conf.serviceCenter === centerName:', conf?.serviceCenter === centerName);

  // 4. Check suggestions too
  const suggs = cc.agentResults?.schedulingAgent?.suggestions || [];
  console.log('\nSUGGESTIONS:', suggs.length);
  suggs.forEach((s, i) => {
    const scId = s.serviceCenter?.id || s.serviceCenter?._id || s.serviceCenterId;
    const scName = s.serviceCenter?.name || s.centerName;
    console.log(`  [${i}] scId=${JSON.stringify(scId)} scName=${JSON.stringify(scName)}`);
  });

  // 5. Now check what the route's DB config uses
  const dbConfig = require('./config/db');
  console.log('\nDB CONFIG exports:', Object.keys(dbConfig));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
