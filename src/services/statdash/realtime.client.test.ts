import { createSessionSseClient } from './realtime.client';

class FakeEventSource {
  listeners: Record<string, Array<(event: Event | MessageEvent<string>) => void>> = {};
  close = vi.fn();

  constructor(_url: string) {}

  addEventListener(type: string, listener: (event: Event | MessageEvent<string>) => void) {
    this.listeners[type] = this.listeners[type] ?? [];
    this.listeners[type].push(listener);
  }

  emit(type: string, event: Event | MessageEvent<string>) {
    (this.listeners[type] ?? []).forEach((listener) => listener(event));
  }
}

describe('realtime client', () => {
  it('forwards parsed messages and connection events', () => {
    const onConnected = vi.fn();
    const onMessage = vi.fn();
    const onDisconnected = vi.fn();
    const OriginalEventSource = globalThis.EventSource;
    const fake = new FakeEventSource('http://localhost');
    class MockEventSource {
      constructor(_url: string, _init?: EventSourceInit) {
        return fake as unknown as EventSource;
      }
    }
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

    const client = createSessionSseClient('session-1', {
      onConnected,
      onMessage,
      onDisconnected,
    });

    fake.emit('open', new Event('open'));
    fake.emit(
      'message',
      new MessageEvent('message', {
        data: JSON.stringify({
          sessionId: 'session-1',
          version: 2,
          type: 'snapshot',
        }),
      }),
    );
    client.close();

    expect(onConnected).toHaveBeenCalled();
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', version: 2 }),
    );
    expect(onDisconnected).toHaveBeenCalled();
    globalThis.EventSource = OriginalEventSource;
  });
});
