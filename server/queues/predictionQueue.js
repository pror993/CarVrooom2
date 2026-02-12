/**
 * BullMQ Prediction Queue
 * ═══════════════════════════════════════════════════════════════
 * 
 * Handles asynchronous vehicle prediction processing:
 *   - Parallel ML API calls for all vehicles
 *   - Stores PredictionEvent in MongoDB
 *   - Checks for duplicate cases before triggering orchestration
 *   - Avoids blocking the main scheduler tick loop
 * 
 * Redis connection required (default: localhost:6379)
 * Install: brew install redis && brew services start redis
 */

const { Queue, Worker } = require('bullmq');
const VehicleTelemetry = require('../models/VehicleTelemetry');
const PredictionEvent = require('../models/PredictionEvent');
const Case = require('../models/Case');
const { orchestrateAgents } = require('../agents/orchestrator');

// Redis connection config
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';
const HEALTHY_RUL_THRESHOLD = parseInt(process.env.HEALTHY_RUL_THRESHOLD || '60');

const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
};

// WebSocket broadcast function (will be set by scheduler)
let broadcastEventFn = null;
// Cancellation flag — when true, running jobs bail out early
let cancelled = false;

function setBroadcastFunction(fn) {
  broadcastEventFn = fn;
}

function isCancelled() {
  return cancelled;
}

// Create queue
const predictionQueue = new Queue('vehicle-predictions', { connection });

// ── Job Processor ────────────────────────────────────────────────
async function processPredictionJob(job) {
  const { vehicleId, rowIndex, simDay } = job.data;

  // Bail out immediately if pipeline was stopped/reset
  if (cancelled) {
    return { vehicleId, action: 'cancelled', reason: 'Pipeline stopped' };
  }

  try {
    // 1. Fetch telemetry data
    const telemetryDocs = await VehicleTelemetry.getRowsUpTo(vehicleId, rowIndex);
    
    if (!telemetryDocs || telemetryDocs.length < 2016) {
      return {
        vehicleId,
        action: 'insufficient_data',
        rows: telemetryDocs?.length || 0,
      };
    }

    // 2. Call ML API
    if (cancelled) return { vehicleId, action: 'cancelled' };
    const mlData = VehicleTelemetry.toMLFormat(telemetryDocs);
    const response = await fetch(`${ML_API_URL}/predict/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: mlData }),
    });

    if (!response.ok) {
      throw new Error(`ML API error: ${response.status}`);
    }

    const mlResult = await response.json();

    // 3. Store PredictionEvent
    const prediction = await PredictionEvent.create({
      vehicleId: mlResult.vehicleId,
      predictionType: mlResult.predictionType,
      confidence: mlResult.confidence,
      etaDays: mlResult.etaDays,
      signals: mlResult.signals,
      modelOutputs: mlResult.modelOutputs,
      source: mlResult.source,
    });

    // Broadcast prediction update via WebSocket
    if (broadcastEventFn) {
      broadcastEventFn('prediction', {
        vehicleId,
        predictionType: mlResult.predictionType,
        etaDays: mlResult.etaDays,
        confidence: mlResult.confidence,
        rowIndex,
        simDay,
      });
    }

    // 4. Check if we need orchestration
    if (mlResult.etaDays >= HEALTHY_RUL_THRESHOLD) {
      // Healthy - no case needed
      if (broadcastEventFn) {
        broadcastEventFn('healthy', {
          vehicleId,
          etaDays: mlResult.etaDays,
          predictionType: mlResult.predictionType,
        });
      }

      return {
        vehicleId,
        action: 'healthy',
        etaDays: mlResult.etaDays,
        predictionType: mlResult.predictionType,
        predictionId: prediction._id.toString(),
      };
    }

    // 5. Check for existing active case with same failure type
    const existingCase = await Case.findOne({
      vehicleId,
      'metadata.predictionType': mlResult.predictionType,
      currentState: { $nin: ['COMPLETED', 'FAILED', 'CANCELLED'] },
    }).sort({ createdAt: -1 }).lean();

    if (existingCase) {
      // Case already exists for this vehicle + failure type
      console.log(`   ⏩ ${vehicleId}: Active case ${existingCase.caseId} exists for ${mlResult.predictionType} — skipping orchestration`);
      
      // Optionally update the case with the new prediction
      await Case.findByIdAndUpdate(existingCase._id, {
        $push: {
          relatedPredictions: prediction._id,
        },
        $set: {
          'metadata.latestPredictionEtaDays': mlResult.etaDays,
          'metadata.latestPredictionConfidence': mlResult.confidence,
        },
      });

      return {
        vehicleId,
        action: 'case_exists',
        predictionType: mlResult.predictionType,
        etaDays: mlResult.etaDays,
        caseId: existingCase.caseId,
        predictionId: prediction._id.toString(),
      };
    }

    // 6. Run orchestration (new case needed)
    if (cancelled) return { vehicleId, action: 'cancelled' };
    console.log(`   ⚠️  ${vehicleId}: RUL ${mlResult.etaDays} days < ${HEALTHY_RUL_THRESHOLD} → running orchestration`);
    const orchResult = await orchestrateAgents(prediction._id);

    // Broadcast alert via WebSocket
    if (broadcastEventFn) {
      broadcastEventFn('alert', {
        vehicleId,
        caseId: orchResult.caseId,
        severity: orchResult.severity,
        predictionType: mlResult.predictionType,
        etaDays: mlResult.etaDays,
        confidence: mlResult.confidence,
        state: orchResult.state,
      });
    }

    return {
      vehicleId,
      action: 'alert',
      predictionType: mlResult.predictionType,
      etaDays: mlResult.etaDays,
      caseId: orchResult.caseId,
      severity: orchResult.severity,
      predictionId: prediction._id.toString(),
    };

  } catch (error) {
    console.error(`   ❌ ${vehicleId}: Error — ${error.message}`);
    throw error; // BullMQ will retry
  }
}

// ── Worker ───────────────────────────────────────────────────────
const worker = new Worker('vehicle-predictions', processPredictionJob, {
  connection,
  concurrency: 6, // Process up to 6 vehicles in parallel
  limiter: {
    max: 10, // Max 10 jobs per duration
    duration: 5000, // 5 seconds
  },
});

console.log('🚀 BullMQ worker started: 6 parallel workers, rate limit 10 jobs/5s');

worker.on('completed', (job) => {
  console.log(`   ✅ Job ${job.id} completed for ${job.data.vehicleId}`);
});

worker.on('failed', (job, err) => {
  console.error(`   ❌ Job ${job.id} failed for ${job.data.vehicleId}:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

// ── Public API ───────────────────────────────────────────────────

/**
 * Add a vehicle prediction job to the queue
 */
async function queueVehiclePrediction(vehicleId, rowIndex, simDay) {
  return predictionQueue.add(
    `predict-${vehicleId}`,
    { vehicleId, rowIndex, simDay },
    {
      jobId: `${vehicleId}-${rowIndex}`, // Prevent duplicate jobs
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50,
      attempts: 2, // Retry once on failure
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    }
  );
}

/**
 * Queue predictions for multiple vehicles in parallel
 * Returns the job objects so caller can wait for completion
 */
async function queueBatchPredictions(vehicles, rowIndex, simDay) {
  const jobs = vehicles.map(vehicleId => 
    queueVehiclePrediction(vehicleId, rowIndex, simDay)
  );
  return Promise.all(jobs);
}

/**
 * Wait for specific jobs to complete (respects cancellation)
 */
async function waitForJobs(jobs) {
  const completionPromises = jobs.map(job => {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        // If cancelled, resolve immediately instead of waiting forever
        if (cancelled) {
          return resolve({ vehicleId: job.data?.vehicleId, action: 'cancelled' });
        }
        try {
          const state = await job.getState();
          if (state === 'completed') {
            resolve(await job.returnvalue);
          } else if (state === 'failed') {
            resolve({ vehicleId: job.data?.vehicleId, action: 'failed' }); // Don't reject — we don't want to crash
          } else {
            setTimeout(checkStatus, 150);
          }
        } catch (err) {
          resolve({ vehicleId: job.data?.vehicleId, action: 'error', error: err.message });
        }
      };
      checkStatus();
    });
  });
  
  return Promise.all(completionPromises);
}

/**
 * Get queue stats
 */
async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    predictionQueue.getWaitingCount(),
    predictionQueue.getActiveCount(),
    predictionQueue.getCompletedCount(),
    predictionQueue.getFailedCount(),
  ]);
  
  return { waiting, active, completed, failed };
}

/**
 * Cancel all pending jobs and drain the queue.
 * Called when the scheduler is stopped or reset.
 */
async function cancelAll() {
  cancelled = true;
  console.log('🛑 Cancelling all queued prediction jobs...');
  try {
    // Remove all waiting jobs
    await predictionQueue.drain();
    // Clean completed/failed
    await predictionQueue.clean(0, 1000, 'completed');
    await predictionQueue.clean(0, 1000, 'failed');
    // Also obliterate delayed jobs
    await predictionQueue.clean(0, 1000, 'delayed');
    console.log('   ✅ Queue drained');
  } catch (err) {
    console.error('   ⚠️  Queue drain error:', err.message);
  }
}

/**
 * Re-enable queue processing (call before start)
 */
function resumeQueue() {
  cancelled = false;
}

/**
 * Clean old jobs
 */
async function cleanQueue() {
  await predictionQueue.clean(0, 100, 'completed');
  await predictionQueue.clean(0, 50, 'failed');
}

/**
 * Close worker and queue (for shutdown)
 */
async function shutdown() {
  console.log('Closing prediction queue and worker...');
  await worker.close();
  await predictionQueue.close();
}

module.exports = {
  predictionQueue,
  worker,
  queueVehiclePrediction,
  queueBatchPredictions,
  waitForJobs,
  getQueueStats,
  cleanQueue,
  cancelAll,
  resumeQueue,
  shutdown,
  setBroadcastFunction,
};
