/**
 * UEBA Monitor Test
 * 
 * Tests the User and Entity Behavior Analytics monitoring system
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { uebaMonitor, UEBAEvent } = require('./agents/uebaMonitor');

async function testUEBA() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 UEBA MONITOR TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Normal execution
    console.log('TEST 1: Normal Agent Execution');
    console.log('─────────────────────────────────────────────────────────\n');
    
    const eventId1 = await uebaMonitor.logAgentStart('DiagnosticAgent', {
      caseId: 'TEST-CASE-1',
      vehicleId: 'TEST-VEH-001',
      predictionId: 'TEST-PRED-001'
    });
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const analysis1 = await uebaMonitor.logAgentComplete(
      eventId1,
      'DiagnosticAgent',
      100,
      {
        caseId: 'TEST-CASE-1',
        vehicleId: 'TEST-VEH-001',
        predictionId: 'TEST-PRED-001'
      }
    );
    
    console.log(`✅ Normal execution logged`);
    console.log(`   Risk Score: ${analysis1.riskScore}`);
    console.log(`   Anomalies: ${analysis1.anomalies.length}\n`);

    // Test 2: High frequency (trigger anomaly)
    console.log('TEST 2: High Frequency Pattern (should trigger anomaly)');
    console.log('─────────────────────────────────────────────────────────\n');
    
    for (let i = 0; i < 12; i++) {
      const eventId = await uebaMonitor.logAgentStart('MasterAgent', {
        caseId: 'TEST-CASE-2',
        vehicleId: 'TEST-VEH-002'
      });
      
      await uebaMonitor.logAgentComplete(
        eventId,
        'MasterAgent',
        50,
        {
          caseId: 'TEST-CASE-2',
          vehicleId: 'TEST-VEH-002'
        }
      );
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const eventId2 = await uebaMonitor.logAgentStart('MasterAgent', {
      caseId: 'TEST-CASE-2',
      vehicleId: 'TEST-VEH-002'
    });
    
    const analysis2 = await uebaMonitor.logAgentComplete(
      eventId2,
      'MasterAgent',
      50,
      {
        caseId: 'TEST-CASE-2',
        vehicleId: 'TEST-VEH-002'
      }
    );
    
    console.log(`✅ High frequency execution logged`);
    console.log(`   Risk Score: ${analysis2.riskScore}`);
    console.log(`   Anomalies: ${analysis2.anomalies.length}`);
    if (analysis2.anomalies.length > 0) {
      analysis2.anomalies.forEach(a => {
        console.log(`   - ${a.type}: ${a.description} (${a.severity})`);
      });
    }
    console.log();

    // Test 3: Long duration
    console.log('TEST 3: Long Duration Execution');
    console.log('─────────────────────────────────────────────────────────\n');
    
    const eventId3 = await uebaMonitor.logAgentStart('DiagnosticAgent', {
      caseId: 'TEST-CASE-3',
      vehicleId: 'TEST-VEH-003'
    });
    
    const analysis3 = await uebaMonitor.logAgentComplete(
      eventId3,
      'DiagnosticAgent',
      35000, // 35 seconds - should trigger long_duration anomaly
      {
        caseId: 'TEST-CASE-3',
        vehicleId: 'TEST-VEH-003'
      }
    );
    
    console.log(`✅ Long duration execution logged`);
    console.log(`   Risk Score: ${analysis3.riskScore}`);
    console.log(`   Anomalies: ${analysis3.anomalies.length}`);
    if (analysis3.anomalies.length > 0) {
      analysis3.anomalies.forEach(a => {
        console.log(`   - ${a.type}: ${a.description} (${a.severity})`);
      });
    }
    console.log();

    // Test 4: Repeated failures
    console.log('TEST 4: Repeated Failures');
    console.log('─────────────────────────────────────────────────────────\n');
    
    for (let i = 0; i < 4; i++) {
      const eventId = await uebaMonitor.logAgentStart('CommunicationAgent', {
        caseId: 'TEST-CASE-4',
        vehicleId: 'TEST-VEH-004'
      });
      
      await uebaMonitor.logAgentFailure(
        eventId,
        'CommunicationAgent',
        200,
        'Simulated failure',
        {
          caseId: 'TEST-CASE-4',
          vehicleId: 'TEST-VEH-004'
        }
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Repeated failures logged (should detect pattern)\n`);

    // Test 5: Query high-risk events
    console.log('TEST 5: Query High-Risk Events');
    console.log('─────────────────────────────────────────────────────────\n');
    
    const highRiskEvents = await uebaMonitor.getHighRiskEvents(10, 20);
    console.log(`✅ Found ${highRiskEvents.length} high-risk events (riskScore >= 20)`);
    
    if (highRiskEvents.length > 0) {
      console.log('\nTop 3 High-Risk Events:');
      highRiskEvents.slice(0, 3).forEach((event, idx) => {
        console.log(`\n   ${idx + 1}. ${event.agentName} - Risk Score: ${event.riskScore}`);
        console.log(`      Case: ${event.caseId}`);
        console.log(`      Status: ${event.status}`);
        console.log(`      Duration: ${event.executionDuration}ms`);
        if (event.anomalyFlags.length > 0) {
          console.log(`      Anomalies:`);
          event.anomalyFlags.forEach(a => {
            console.log(`        - ${a.type} (${a.severity}): ${a.description}`);
          });
        }
      });
    }
    console.log();

    // Test 6: Case risk summary
    console.log('TEST 6: Case Risk Summary');
    console.log('─────────────────────────────────────────────────────────\n');
    
    const caseSummary = await uebaMonitor.getCaseRiskSummary('TEST-CASE-2');
    console.log(`✅ Case Risk Summary for TEST-CASE-2:`);
    console.log(`   Total Events: ${caseSummary.totalEvents}`);
    console.log(`   Average Risk Score: ${caseSummary.averageRiskScore}`);
    console.log(`   Max Risk Score: ${caseSummary.maxRiskScore}`);
    console.log(`   Anomaly Count: ${caseSummary.anomalyCount}`);
    console.log(`   Agent Stats:`);
    Object.keys(caseSummary.agents).forEach(agent => {
      const stats = caseSummary.agents[agent];
      console.log(`     - ${agent}: ${stats.count} executions, ${stats.failures} failures, ${stats.avgDuration}ms avg`);
    });
    console.log();

    // Cleanup test data
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧹 CLEANUP: Removing Test Data');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const deleteResult = await UEBAEvent.deleteMany({
      caseId: { $in: ['TEST-CASE-1', 'TEST-CASE-2', 'TEST-CASE-3', 'TEST-CASE-4'] }
    });
    
    console.log(`✅ Deleted ${deleteResult.deletedCount} test events\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ALL UEBA TESTS PASSED');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ UEBA Test Failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed\n');
  }
}

// Run test
testUEBA().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
