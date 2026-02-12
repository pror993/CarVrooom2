import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = 'ws://localhost:3000/ws/pipeline';

/**
 * React hook for connecting to the pipeline WebSocket.
 * Provides real-time events: tick, prediction, alert, healthy, tick_summary, state
 */
export function usePipelineSocket() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [schedulerState, setSchedulerState] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [tickInfo, setTickInfo] = useState(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setConnected(true);
      console.log('🔌 Pipeline WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setLastEvent(msg);

        switch (msg.event) {
          case 'state':
            setSchedulerState(msg.data);
            break;
          case 'tick':
            setTickInfo(msg.data);
            break;
          case 'prediction':
            setPredictions(prev => [msg.data, ...prev].slice(0, 100));
            break;
          case 'alert':
            setAlerts(prev => [msg.data, ...prev].slice(0, 50));
            break;
          case 'tick_summary':
            // Update scheduler state from tick summary
            setSchedulerState(prev => prev ? {
              ...prev,
              tickCount: msg.data.tickCount,
              simDay: msg.data.simDay,
            } : prev);
            break;
          case 'healthy':
            // Could update vehicle status
            break;
          default:
            break;
        }
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('🔌 Pipeline WebSocket disconnected');
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = (error) => {
      console.error('WS error:', error);
    };

    wsRef.current = ws;
  }, []);

  const sendAction = useCallback((action) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    connected,
    schedulerState,
    lastEvent,
    alerts,
    predictions,
    tickInfo,
    sendAction,
    clearAlerts: () => setAlerts([]),
    clearPredictions: () => setPredictions([]),
  };
}
