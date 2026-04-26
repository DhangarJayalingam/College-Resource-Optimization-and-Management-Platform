const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';

function getResourceStatusWebSocketUrl() {
  const apiUrl = new URL(API_BASE_URL);
  apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  apiUrl.pathname = '/ws/resource-status';
  apiUrl.search = '';
  apiUrl.hash = '';
  return apiUrl.toString();
}

function createFrame(command: string, headers: Record<string, string> = {}, body = '') {
  const serializedHeaders = Object.entries(headers)
    .map(([key, value]) => `${key}:${value}`)
    .join('\n');

  return `${command}\n${serializedHeaders}\n\n${body}\0`;
}

export function subscribeToResourceStatus(onMessage: () => void) {
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let isClosed = false;
  let subscriptionId = `resource-status-${Date.now()}`;
  let buffer = '';

  const clearReconnect = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (isClosed || reconnectTimer !== null) {
      return;
    }

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2000);
  };

  const handleFrame = (frame: string) => {
    const [rawHeaderBlock = '', body = ''] = frame.split('\n\n');
    const [command] = rawHeaderBlock.split('\n');

    if (command === 'CONNECTED') {
      socket?.send(
        createFrame('SUBSCRIBE', {
          id: subscriptionId,
          destination: '/topic/resource-status'
        })
      );
      return;
    }

    if (command === 'MESSAGE') {
      onMessage();
    }
  };

  const processIncoming = (chunk: string) => {
    buffer += chunk;

    let frameEnd = buffer.indexOf('\0');
    while (frameEnd >= 0) {
      const frame = buffer.slice(0, frameEnd);
      buffer = buffer.slice(frameEnd + 1);
      if (frame.trim()) {
        handleFrame(frame);
      }
      frameEnd = buffer.indexOf('\0');
    }
  };

  const connect = () => {
    if (isClosed) {
      return;
    }

    socket = new WebSocket(getResourceStatusWebSocketUrl());

    socket.addEventListener('open', () => {
      subscriptionId = `resource-status-${Date.now()}`;
      socket?.send(
        createFrame('CONNECT', {
          'accept-version': '1.2,1.1,1.0',
          'heart-beat': '10000,10000'
        })
      );
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        processIncoming(event.data);
      }
    });

    socket.addEventListener('close', () => {
      socket = null;
      if (!isClosed) {
        scheduleReconnect();
      }
    });

    socket.addEventListener('error', () => {
      socket?.close();
    });
  };

  connect();

  return () => {
    isClosed = true;
    clearReconnect();

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(createFrame('UNSUBSCRIBE', { id: subscriptionId }));
      socket.send(createFrame('DISCONNECT'));
    }

    socket?.close();
    socket = null;
  };
}
