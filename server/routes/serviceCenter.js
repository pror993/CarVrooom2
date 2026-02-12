/**
 * Service Center Dashboard API
 * 
 * GET  /api/service-center/:centerId/dashboard  — full dashboard data
 * GET  /api/service-center/:centerId/appointments — scheduled appointments
 */

const express = require('express');
const router = express.Router();
const ServiceCenter = require('../models/ServiceCenter');
const Case = require('../models/Case');
const Vehicle = require('../models/Vehicle');
const PredictionEvent = require('../models/PredictionEvent');

// ── GET /api/service-center/:centerId/dashboard ─────────────────
router.get('/:centerId/dashboard', async (req, res) => {
  try {
    const { centerId } = req.params;

    // Find the service center — accept both MongoDB _id and serviceCenterId string
    let center = await ServiceCenter.findById(centerId).lean().catch(() => null);
    if (!center) {
      center = await ServiceCenter.findOne({ serviceCenterId: centerId }).lean();
    }
    if (!center) {
      return res.status(404).json({ success: false, error: 'Service center not found' });
    }

    // Build all IDs/names that can identify this center in bookings
    const centerMongoId = center._id.toString();
    const centerStringId = center.serviceCenterId;   // e.g. "SC-HR-GGN-001"
    const centerName = center.name;

    // Find all cases where scheduling agent suggested THIS center
    // or where an appointment was confirmed at this center
    const allCases = await Case.find({
      currentState: { $nin: ['FAILED', 'CANCELLED'] },
    }).sort({ createdAt: -1 }).lean();

    // Filter cases that involve this service center
    const appointments = [];
    const todayStr = new Date().toISOString().split('T')[0];

    const matchesCenter = (id, name) => {
      if (!id && !name) return false;
      const idStr = id?.toString();
      return idStr === centerMongoId || idStr === centerStringId ||
             name === centerName;
    };

    for (const c of allCases) {
      const sched = c.agentResults?.schedulingAgent;
      if (!sched) continue;

      // Check if confirmed/in-progress/completed appointment is at this center
      if (['confirmed', 'in-progress', 'completed'].includes(sched.status) && sched.confirmedAppointment) {
        const conf = sched.confirmedAppointment;
        if (matchesCenter(conf.serviceCenterId, conf.serviceCenter) ||
            matchesCenter(conf.serviceCenterId, conf.centerName)) {
          appointments.push({
            caseId: c.caseId,
            vehicleId: c.vehicleId,
            severity: c.severity,
            failureType: c.metadata?.predictionType || c.metadata?.failureType || 'General Service',
            state: c.currentState,
            date: conf.date,
            timeSlot: conf.timeSlot,
            status: sched.status,
            confirmedAt: conf.confirmedAt,
            completedAt: sched.completedAt,
          });
          continue;
        }
      }

      // Check if any suggestion points to this center (pending approval)
      if (sched.suggestions?.length) {
        for (const s of sched.suggestions) {
          const scId = s.serviceCenter?.id || s.serviceCenter?._id || s.serviceCenterId;
          const scName = s.serviceCenter?.name || s.centerName;
          if (matchesCenter(scId, scName)) {
            appointments.push({
              caseId: c.caseId,
              vehicleId: c.vehicleId,
              severity: c.severity,
              failureType: c.metadata?.predictionType || c.metadata?.failureType || 'General Service',
              state: c.currentState,
              date: s.slot?.date || s.date,
              timeSlot: s.slot?.timeSlot || s.timeSlot,
              status: c.currentState === 'APPOINTMENT_CONFIRMED' ? 'confirmed' : 'pending',
              score: s.score,
              reason: s.reason,
            });
            break; // only count once per case
          }
        }
      }
    }

    // Enrich with vehicle info
    const vehicleIds = [...new Set(appointments.map(a => a.vehicleId))];
    const vehicles = await Vehicle.find({ vehicleId: { $in: vehicleIds } }).lean();
    const vehicleMap = {};
    for (const v of vehicles) {
      vehicleMap[v.vehicleId] = {
        name: `${v.vehicleInfo?.make || ''} ${v.vehicleInfo?.model || ''}`.trim() || v.vehicleId,
        make: v.vehicleInfo?.make,
        model: v.vehicleInfo?.model,
        year: v.vehicleInfo?.year,
        owner: v.owner?.name || 'Unknown',
      };
    }

    // Enrich appointments with vehicle info + frontend-expected field names
    const enrichedAppointments = appointments.map(a => {
      const v = vehicleMap[a.vehicleId] || { name: a.vehicleId };
      return {
        ...a,
        vehicleReg: a.vehicleId,
        vehicleName: v.name,
        vehicle: v,
      };
    });

    // Stats
    const todayAppointments = enrichedAppointments.filter(a => {
      if (!a.date) return false;
      const d = new Date(a.date).toISOString().split('T')[0];
      return d === todayStr;
    });
    const confirmedCount = enrichedAppointments.filter(a => a.status === 'confirmed').length;
    const pendingCount = enrichedAppointments.filter(a => a.status === 'pending').length;
    const inProgressCount = enrichedAppointments.filter(a => a.status === 'in-progress').length;
    const completedCount = enrichedAppointments.filter(a => a.status === 'completed').length;
    const criticalCount = enrichedAppointments.filter(a => a.severity === 'critical' || a.severity === 'high').length;

    // Booked slots from center
    const bookedSlots = (center.slots || []).filter(s => s.status === 'booked');

    res.json({
      success: true,
      center: {
        id: center._id,
        centerId: center.serviceCenterId,
        serviceCenterId: center.serviceCenterId,
        name: center.name,
        location: center.location,
        contact: center.contact,
        rating: center.rating,
        specializations: center.specializations,
        capacity: center.capacity,
        operatingHours: center.operatingHours,
        isEmergency: center.isEmergency,
      },
      stats: {
        todayJobs: todayAppointments.length,
        confirmed: confirmedCount,
        pending: pendingCount,
        inProgress: inProgressCount,
        completed: completedCount,
        critical: criticalCount,
        totalSlots: center.capacity?.dailySlots || center.slots?.length || 0,
        bookedSlots: bookedSlots.length,
      },
      appointments: enrichedAppointments,
    });

  } catch (error) {
    console.error('Service center dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PATCH /api/service-center/:centerId/appointment/:caseId/status ──
router.patch('/:centerId/appointment/:caseId/status', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { status } = req.body; // 'completed', 'in-progress'

    const validStatuses = ['in-progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const caseDoc = await Case.findOne({ caseId });
    if (!caseDoc) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    // Map frontend status to case state
    const stateMap = {
      'in-progress': 'IN_SERVICE',
      'completed': 'COMPLETED',
    };

    caseDoc.currentState = stateMap[status];

    // Update scheduling agent status
    if (caseDoc.agentResults?.schedulingAgent) {
      caseDoc.agentResults.schedulingAgent.status = status;
      if (status === 'completed') {
        caseDoc.agentResults.schedulingAgent.completedAt = new Date().toISOString();
      }
      caseDoc.markModified('agentResults');
    }

    // Add to history
    caseDoc.history.push({
      state: stateMap[status],
      timestamp: new Date(),
      metadata: { updatedBy: 'service_center', status },
    });

    await caseDoc.save();

    res.json({
      success: true,
      caseId: caseDoc.caseId,
      newState: caseDoc.currentState,
      status,
    });
  } catch (error) {
    console.error('Update appointment status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
