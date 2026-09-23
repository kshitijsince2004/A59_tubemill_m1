

class InProcessEventBus {
  handlers = new Map();

  subscribe(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  async publish(event, payload) {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of [...set]) {
      await h(payload);
    }
  }
}

let bus = null;

export function getEventBus() {
  if (!bus) bus = new InProcessEventBus();
  return bus;
}