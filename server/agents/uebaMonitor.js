/**
 * UEBA Monitor - User and Entity Behavior Analytics
 * 
 * Monitors agent execution patterns to detect:
 * - Abnormal execution frequency (too many calls in short time)
 * - Infinite loops or stuck agents
 * - Unusual execution patterns
 * 
 * Stores risk scores in MongoDB for analysis and alerting.
 */

const mongoose = require('mongoose');

// ============================================================================
// UEBA Event Schema
// ============================================================================

const UEBAEventSchema = new mongoose.Schema({
  // Event identification
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Agent information
  agentName: {
    type: String,
    required: true,
    enum: ['MasterAgent', 'DiagnosticAgent', 'CommunicationAgent', 'SchedulingAgent', 'Orchestrator'],
    index: true
  },
  
  // Case/Context reference
  caseId: {
    type: String,
    index: true
  },
  
  vehicleId: {
    type: String,
    index: true
  },
  
  predictionId: {
    type: String
  },
  
  // Execution details
  executionTimestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  executionDuration: {
    type: Number, // milliseconds
    required: true
  },
  
  status: {
    type: String,
    enum: ['started', 'completed', 'failed', 'timeout'],
    required: true
  },
  
  errorMessage: {
    type: String
  },
  
  // Behavioral analysis
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
    index: true
  },
  
  anomalyFlags: [{
    type: {
      type: String,
      enum: ['high_frequency', 'infinite_loop', 'long_duration', 'repeated_failures', 'unusual_pattern']
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    description: String,
    detectedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Context
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
UEBAEventSchema.index({ agentName: 1, executionTimestamp: -1 });
UEBAEventSchema.index({ caseId: 1, executionTimestamp: -1 });
UEBAEventSchema.index({ riskScore: -1, executionTimestamp: -1 });

const UEBAEvent = mongoose.model('UEBAEvent', UEBAEventSchema);

// ============================================================================
// UEBA Monitor Class
// ============================================================================

class UEBAMonitor {
  constructor() {
    // Thresholds for anomaly detection
    this.thresholds = {
      highFrequency: {
        maxCallsPerMinute: 10,    // More than 10 calls/min is suspicious
        windowMs: 60000            // 1 minute window
      },
      infiniteLoop: {
        maxRepeatsInWindow: 5,     // Same agent 5+ times in window
        windowMs: 30000            // 30 second window
      },
      longDuration: {
        maxDurationMs: 30000       // Execution taking > 30 seconds
      },
      repeatedFailures: {
        maxFailuresInWindow: 3,    // 3+ failures in window
        windowMs: 300000           // 5 minute window
      }
    };
    
    // In-memory tracking for real-time analysis
    this.executionHistory = new Map(); // agentName -> array of timestamps
  }
  
  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `UEBA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Log agent execution start
   */
  async logAgentStart(agentName, context = {}) {
    const eventId = this.generateEventId();
    const timestamp = new Date();
    
    console.log(`📊 UEBA: Logging ${agentName} start - ${eventId}`);
    
    // Store in-memory for real-time tracking
    if (!this.executionHistory.has(agentName)) {
      this.executionHistory.set(agentName, []);
    }
    this.executionHistory.get(agentName).push({
      eventId,
      timestamp,
      context
    });
    
    // Clean up old entries (keep last 100 per agent)
    const history = this.executionHistory.get(agentName);
    if (history.length > 100) {
      this.executionHistory.set(agentName, history.slice(-100));
    }
    
    return eventId;
  }
  
  /**
   * Log agent execution completion and analyze behavior
   */
  async logAgentComplete(eventId, agentName, executionDuration, context = {}) {
    const timestamp = new Date();
    
    console.log(`📊 UEBA: Logging ${agentName} complete - ${eventId} (${executionDuration}ms)`);
    
    // Analyze behavior and calculate risk score
    const analysis = await this.analyzeBehavior(agentName, executionDuration, 'completed', context);
    
    // Store in MongoDB
    try {
      const event = new UEBAEvent({
        eventId,
        agentName,
        caseId: context.caseId,
        vehicleId: context.vehicleId,
        predictionId: context.predictionId,
        executionTimestamp: timestamp,
        executionDuration,
        status: 'completed',
        riskScore: analysis.riskScore,
        anomalyFlags: analysis.anomalies,
        metadata: context.metadata || {}
      });
      
      await event.save();
      
      // Alert on high risk
      if (analysis.riskScore >= 70) {
        console.warn(`⚠️  UEBA ALERT: High risk score ${analysis.riskScore} for ${agentName}`);
        analysis.anomalies.forEach(anomaly => {
          console.warn(`   - ${anomaly.type}: ${anomaly.description} (${anomaly.severity})`);
        });
      }
      
      return analysis;
    } catch (error) {
      console.error('❌ UEBA: Failed to store event:', error.message);
      throw error;
    }
  }
  
  /**
   * Log agent execution failure
   */
  async logAgentFailure(eventId, agentName, executionDuration, errorMessage, context = {}) {
    const timestamp = new Date();
    
    console.log(`📊 UEBA: Logging ${agentName} failure - ${eventId}`);
    
    // Analyze behavior (failures contribute to risk score)
    const analysis = await this.analyzeBehavior(agentName, executionDuration, 'failed', context);
    
    // Store in MongoDB
    try {
      const event = new UEBAEvent({
        eventId,
        agentName,
        caseId: context.caseId,
        vehicleId: context.vehicleId,
        predictionId: context.predictionId,
        executionTimestamp: timestamp,
        executionDuration,
        status: 'failed',
        errorMessage,
        riskScore: analysis.riskScore,
        anomalyFlags: analysis.anomalies,
        metadata: context.metadata || {}
      });
      
      await event.save();
      
      return analysis;
    } catch (error) {
      console.error('❌ UEBA: Failed to store failure event:', error.message);
      throw error;
    }
  }
  
  /**
   * Analyze agent behavior and detect anomalies
   */
  async analyzeBehavior(agentName, executionDuration, status, context = {}) {
    const anomalies = [];
    let riskScore = 0;
    
    // Get recent execution history for this agent
    const history = this.executionHistory.get(agentName) || [];
    const now = Date.now();
    
    // 1. Check for HIGH FREQUENCY execution
    const recentCalls = history.filter(h => 
      now - h.timestamp.getTime() < this.thresholds.highFrequency.windowMs
    );
    
    if (recentCalls.length > this.thresholds.highFrequency.maxCallsPerMinute) {
      anomalies.push({
        type: 'high_frequency',
        severity: 'high',
        description: `${agentName} called ${recentCalls.length} times in last minute (threshold: ${this.thresholds.highFrequency.maxCallsPerMinute})`
      });
      riskScore += 30;
    }
    
    // 2. Check for INFINITE LOOP pattern
    const veryRecentCalls = history.filter(h => 
      now - h.timestamp.getTime() < this.thresholds.infiniteLoop.windowMs
    );
    
    if (veryRecentCalls.length >= this.thresholds.infiniteLoop.maxRepeatsInWindow) {
      anomalies.push({
        type: 'infinite_loop',
        severity: 'critical',
        description: `Possible infinite loop: ${agentName} executed ${veryRecentCalls.length} times in ${this.thresholds.infiniteLoop.windowMs}ms`
      });
      riskScore += 50;
    }
    
    // 3. Check for LONG DURATION
    if (executionDuration > this.thresholds.longDuration.maxDurationMs) {
      anomalies.push({
        type: 'long_duration',
        severity: 'medium',
        description: `Execution took ${executionDuration}ms (threshold: ${this.thresholds.longDuration.maxDurationMs}ms)`
      });
      riskScore += 20;
    }
    
    // 4. Check for REPEATED FAILURES (query MongoDB)
    if (status === 'failed') {
      const recentFailures = await UEBAEvent.countDocuments({
        agentName,
        status: 'failed',
        executionTimestamp: {
          $gte: new Date(now - this.thresholds.repeatedFailures.windowMs)
        }
      });
      
      if (recentFailures >= this.thresholds.repeatedFailures.maxFailuresInWindow) {
        anomalies.push({
          type: 'repeated_failures',
          severity: 'high',
          description: `${recentFailures} failures in last ${this.thresholds.repeatedFailures.windowMs / 60000} minutes`
        });
        riskScore += 40;
      }
    }
    
    // 5. Check for UNUSUAL PATTERN (same caseId being processed multiple times)
    if (context.caseId) {
      const caseHistory = history.filter(h => 
        h.context && h.context.caseId === context.caseId &&
        now - h.timestamp.getTime() < 60000 // Last minute
      );
      
      if (caseHistory.length > 3) {
        anomalies.push({
          type: 'unusual_pattern',
          severity: 'medium',
          description: `Case ${context.caseId} processed ${caseHistory.length} times by ${agentName} in last minute`
        });
        riskScore += 25;
      }
    }
    
    // Cap risk score at 100
    riskScore = Math.min(riskScore, 100);
    
    return {
      riskScore,
      anomalies
    };
  }
  
  /**
   * Get risk summary for a specific case
   */
  async getCaseRiskSummary(caseId) {
    const events = await UEBAEvent.find({ caseId })
      .sort({ executionTimestamp: -1 })
      .limit(50);
    
    if (events.length === 0) {
      return {
        caseId,
        totalEvents: 0,
        averageRiskScore: 0,
        maxRiskScore: 0,
        anomalyCount: 0,
        agents: []
      };
    }
    
    const totalRisk = events.reduce((sum, e) => sum + e.riskScore, 0);
    const maxRisk = Math.max(...events.map(e => e.riskScore));
    const anomalyCount = events.reduce((sum, e) => sum + e.anomalyFlags.length, 0);
    
    const agentStats = {};
    events.forEach(e => {
      if (!agentStats[e.agentName]) {
        agentStats[e.agentName] = { count: 0, failures: 0, avgDuration: 0 };
      }
      agentStats[e.agentName].count++;
      if (e.status === 'failed') agentStats[e.agentName].failures++;
      agentStats[e.agentName].avgDuration += e.executionDuration;
    });
    
    Object.keys(agentStats).forEach(agent => {
      agentStats[agent].avgDuration = Math.round(agentStats[agent].avgDuration / agentStats[agent].count);
    });
    
    return {
      caseId,
      totalEvents: events.length,
      averageRiskScore: Math.round(totalRisk / events.length),
      maxRiskScore: maxRisk,
      anomalyCount,
      agents: agentStats
    };
  }
  
  /**
   * Get high-risk events across all cases
   */
  async getHighRiskEvents(limit = 20, minRiskScore = 50) {
    return await UEBAEvent.find({
      riskScore: { $gte: minRiskScore }
    })
      .sort({ riskScore: -1, executionTimestamp: -1 })
      .limit(limit);
  }
  
  /**
   * Clean up old UEBA events (retention policy)
   */
  async cleanupOldEvents(retentionDays = 30) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const result = await UEBAEvent.deleteMany({
      executionTimestamp: { $lt: cutoffDate }
    });
    
    console.log(`🧹 UEBA Cleanup: Removed ${result.deletedCount} events older than ${retentionDays} days`);
    return result.deletedCount;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

const uebaMonitor = new UEBAMonitor();

module.exports = {
  uebaMonitor,
  UEBAEvent,
  UEBAMonitor
};
