/**
 * Seed Service Center User Accounts
 * ═══════════════════════════════════
 *
 * Creates User + UserProfile documents for each existing ServiceCenter,
 * linking them via userProfile.serviceCenterId.
 *
 * Each center gets:
 *   - User (email/password, role='service_center')
 *   - UserProfile (linked to ServiceCenter._id)
 *
 * Run:  node seedServiceCenterUsers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const UserProfile = require('./models/UserProfile');
const ServiceCenter = require('./models/ServiceCenter');

// Mapping: serviceCenterId → credentials
const CREDENTIALS = {
  'SC-HR-GGN-001': { email: 'sc.gurugram@carvrooom.com',  password: 'Center@123' },
  'SC-HR-FBD-001': { email: 'sc.faridabad@carvrooom.com', password: 'Center@123' },
  'SC-HR-RTK-001': { email: 'sc.rohtak@carvrooom.com',    password: 'Center@123' },
  'SC-HR-PNP-001': { email: 'sc.panipat@carvrooom.com',   password: 'Center@123' },
  'SC-HR-HSR-001': { email: 'sc.hisar@carvrooom.com',     password: 'Center@123' },
};

const seed = async () => {
  try {
    await connectDB();
    console.log('\n🔧 Seeding Service Center User Accounts...\n');

    const centers = await ServiceCenter.find({ isActive: true }).lean();

    if (!centers.length) {
      console.log('❌ No service centers found. Run seedData.js first.');
      process.exit(1);
    }

    let created = 0, skipped = 0;
    const results = [];

    for (const center of centers) {
      const creds = CREDENTIALS[center.serviceCenterId];
      if (!creds) {
        console.log(`⏭️  No credentials mapped for ${center.serviceCenterId} — skipping`);
        skipped++;
        continue;
      }

      // Check if user already exists
      let user = await User.findOne({ email: creds.email });
      if (user) {
        console.log(`⏭️  User already exists: ${creds.email}`);
        // Ensure profile is linked
        const profile = await UserProfile.findOne({ userId: user._id });
        if (profile) {
          results.push({ center: center.serviceCenterId, name: center.name, email: creds.email, password: creds.password, status: 'exists' });
        }
        skipped++;
        continue;
      }

      // Create user
      user = await User.create({
        email: creds.email,
        password: creds.password,
        role: 'service_center',
        isActive: true,
        isVerified: true,
      });

      // Create user profile linked to service center
      await UserProfile.create({
        userId: user._id,
        role: 'service_center',
        name: center.name,
        phone: center.contact?.phone || '',
        serviceCenterId: center._id,
        address: {
          street: center.location?.address || '',
          city: center.location?.city || '',
          state: center.location?.state || '',
          zip: center.location?.zipCode || '',
        },
        location: center.geoLocation || { type: 'Point', coordinates: [0, 0] },
      });

      console.log(`✅ Created: ${creds.email} → ${center.name}`);
      results.push({ center: center.serviceCenterId, name: center.name, email: creds.email, password: creds.password, status: 'created' });
      created++;
    }

    console.log('\n' + '═'.repeat(70));
    console.log('📊 SERVICE CENTER ACCOUNTS');
    console.log('═'.repeat(70));
    console.log(`Created: ${created} | Skipped: ${skipped}`);
    console.log('─'.repeat(70));
    console.log('  Center ID        | Email                         | Password');
    console.log('─'.repeat(70));
    for (const r of results) {
      console.log(`  ${r.center.padEnd(17)}| ${r.email.padEnd(30)}| ${r.password}`);
    }
    console.log('─'.repeat(70));
    console.log('✅ Done!\n');

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seed();
