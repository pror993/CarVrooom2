/**
 * Seed Script — Fleet Owner + 5 Haryana Service Centers
 * 
 * Creates:
 *  - 1 User (fleet_owner) + UserProfile with Gurugram location
 *  - 5 ServiceCenter documents across Haryana
 *  - Generates 30-day slots for each center
 * 
 * Run: node seedData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const UserProfile = require('./models/UserProfile');
const ServiceCenter = require('./models/ServiceCenter');

const seedData = async () => {
  try {
    await connectDB();
    console.log('\n🌱 Starting seed...\n');

    // ─────────────────────────────────────────────
    // 1. Fleet Owner User + Profile
    // ─────────────────────────────────────────────

    // Check if fleet owner already exists
    let fleetUser = await User.findOne({ email: 'fleet.haryana@carvrooom.com' });

    if (!fleetUser) {
      fleetUser = await User.create({
        email: 'fleet.haryana@carvrooom.com',
        password: 'Fleet@123',
        role: 'fleet_owner',
        isActive: true,
        isVerified: true
      });
      console.log('✅ Fleet Owner user created:', fleetUser.email);
    } else {
      console.log('⏭️  Fleet Owner user already exists:', fleetUser.email);
    }

    // Upsert the profile
    const fleetProfile = await UserProfile.findOneAndUpdate(
      { userId: fleetUser._id },
      {
        userId: fleetUser._id,
        role: 'fleet_owner',
        name: 'Haryana Fleet Services Pvt Ltd',
        phone: '+91-9876500001',
        companyName: 'Haryana Fleet Services Pvt Ltd',
        gstNumber: '06AABCH1234F1ZL',
        address: {
          street: 'DLF Cyber City, Phase 2',
          city: 'Gurugram',
          state: 'Haryana',
          zip: '122002'
        },
        location: {
          type: 'Point',
          coordinates: [77.0890, 28.4947] // [lon, lat]
        },
        notificationPreferences: {
          channel: 'email',
          urgentChannel: 'sms'
        }
      },
      { upsert: true, new: true, runValidators: true }
    );
    console.log('✅ Fleet Owner profile created/updated:', fleetProfile.name);

    // ─────────────────────────────────────────────
    // 2. Service Centers (5 across Haryana)
    // ─────────────────────────────────────────────

    const serviceCenters = [
      {
        serviceCenterId: 'SC-HR-GGN-001',
        name: 'CarVrooom Gurugram – EV Specialist Hub',
        contact: {
          phone: '+91-124-4000001',
          email: 'gurugram.ev@carvrooom.com'
        },
        location: {
          address: 'MG Road, Sector 14',
          city: 'Gurugram',
          state: 'Haryana',
          zipCode: '122001',
          coordinates: { latitude: 28.4595, longitude: 77.0266 }
        },
        specializations: ['EV Diagnostics', 'Battery Systems', 'Tesla', 'Tata EV', 'MG EV', 'General maintenance'],
        services: ['EV Battery Health Check', 'Motor Diagnostics', 'Regenerative Braking', 'Oil Change', 'General Inspection', 'Tire Rotation'],
        capacity: { maxAppointmentsPerDay: 25, maxAppointmentsPerSlot: 5 },
        rating: { average: 4.6, count: 342 },
        isEmergency: true,
        isActive: true
      },
      {
        serviceCenterId: 'SC-HR-FBD-001',
        name: 'CarVrooom Faridabad – Multi-Brand Service',
        contact: {
          phone: '+91-129-4000002',
          email: 'faridabad@carvrooom.com'
        },
        location: {
          address: 'Sector 16 Market Road',
          city: 'Faridabad',
          state: 'Haryana',
          zipCode: '121002',
          coordinates: { latitude: 28.4089, longitude: 77.3178 }
        },
        specializations: ['Maruti Suzuki', 'Hyundai', 'Honda', 'Toyota', 'General maintenance'],
        services: ['Oil Change', 'Battery Replacement', 'Brake Service', 'Tire Rotation', 'General Inspection', 'AC Service', 'Wheel Alignment'],
        capacity: { maxAppointmentsPerDay: 20, maxAppointmentsPerSlot: 4 },
        rating: { average: 4.3, count: 215 },
        isEmergency: false,
        isActive: true
      },
      {
        serviceCenterId: 'SC-HR-RTK-001',
        name: 'CarVrooom Rohtak – Commercial Vehicle Center',
        contact: {
          phone: '+91-1262-400003',
          email: 'rohtak@carvrooom.com'
        },
        location: {
          address: 'Delhi Road, Near Sunaria Chowk',
          city: 'Rohtak',
          state: 'Haryana',
          zipCode: '124001',
          coordinates: { latitude: 28.8955, longitude: 76.6066 }
        },
        specializations: ['Tata Motors', 'Mahindra', 'Ashok Leyland', 'Commercial Vehicles', 'General maintenance'],
        services: ['Engine Overhaul', 'Brake Service', 'Suspension Repair', 'Oil Change', 'General Inspection', 'Fleet Diagnostics'],
        capacity: { maxAppointmentsPerDay: 15, maxAppointmentsPerSlot: 3 },
        rating: { average: 4.1, count: 128 },
        isEmergency: false,
        isActive: true
      },
      {
        serviceCenterId: 'SC-HR-PNP-001',
        name: 'CarVrooom Panipat – Highway Quick Service',
        contact: {
          phone: '+91-180-4000004',
          email: 'panipat@carvrooom.com'
        },
        location: {
          address: 'GT Road, Model Town',
          city: 'Panipat',
          state: 'Haryana',
          zipCode: '132103',
          coordinates: { latitude: 29.3909, longitude: 76.9635 }
        },
        specializations: ['Maruti Suzuki', 'Hyundai', 'Tata Motors', 'Quick Service', 'General maintenance'],
        services: ['Oil Change', 'Battery Replacement', 'Tire Rotation', 'General Inspection', 'Emergency Roadside', 'Coolant Flush'],
        capacity: { maxAppointmentsPerDay: 18, maxAppointmentsPerSlot: 4 },
        rating: { average: 4.0, count: 97 },
        isEmergency: true,
        isActive: true
      },
      {
        serviceCenterId: 'SC-HR-HSR-001',
        name: 'CarVrooom Hisar – Agricultural & SUV Specialist',
        contact: {
          phone: '+91-1662-400005',
          email: 'hisar@carvrooom.com'
        },
        location: {
          address: 'Rajgarh Road, Urban Estate',
          city: 'Hisar',
          state: 'Haryana',
          zipCode: '125001',
          coordinates: { latitude: 29.1492, longitude: 75.7217 }
        },
        specializations: ['Mahindra', 'Toyota', 'Tata Motors', 'SUV Specialist', 'Tractor Servicing', 'General maintenance'],
        services: ['Engine Diagnostics', 'Oil Change', 'Brake Service', 'Suspension Repair', 'General Inspection', '4x4 Drivetrain Service'],
        capacity: { maxAppointmentsPerDay: 12, maxAppointmentsPerSlot: 3 },
        rating: { average: 4.2, count: 76 },
        isEmergency: false,
        isActive: true
      }
    ];

    let centersCreated = 0;
    let centersSkipped = 0;
    const savedCenters = [];

    for (const centerData of serviceCenters) {
      const existing = await ServiceCenter.findOne({ serviceCenterId: centerData.serviceCenterId });

      if (existing) {
        console.log(`⏭️  ${centerData.serviceCenterId} already exists — skipping`);
        centersSkipped++;
        savedCenters.push(existing);
        continue;
      }

      const center = await ServiceCenter.create(centerData);

      // Generate 30 days of slots
      await center.generateSlots(30);
      console.log(`✅ ${center.serviceCenterId} — ${center.name} (${center.slots.length} slots generated)`);
      centersCreated++;
      savedCenters.push(center);
    }

    // ─────────────────────────────────────────────
    // 3. Summary
    // ─────────────────────────────────────────────

    console.log('\n' + '═'.repeat(60));
    console.log('📊 SEED SUMMARY');
    console.log('═'.repeat(60));
    console.log(`👤 Fleet Owner   : ${fleetProfile.name}`);
    console.log(`   📍 Location   : Gurugram [77.0890, 28.4947]`);
    console.log(`   📧 Email      : ${fleetUser.email}`);
    console.log('');
    console.log(`🔧 Service Centers: ${centersCreated} created, ${centersSkipped} skipped`);
    console.log('─'.repeat(60));

    for (const sc of savedCenters) {
      const slotsCount = sc.slots ? sc.slots.filter(s => s.status === 'available').length : 0;
      const geoCoords = sc.geoLocation?.coordinates || [0, 0];
      console.log(`   ${sc.serviceCenterId} | ${sc.location.city.padEnd(10)} | ⭐${sc.rating.average} | 📅 ${slotsCount} slots | 📍 [${geoCoords[0]}, ${geoCoords[1]}]`);
    }

    console.log('─'.repeat(60));
    console.log('✅ Seed complete!\n');

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    if (error.code === 11000) {
      console.error('   Duplicate key — some data may already exist. Use --force to reseed.');
    }
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
};

seedData();
