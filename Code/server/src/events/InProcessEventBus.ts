type Handler = (payload: unknown) => void | Promise<void>;

class InProcessEventBus {
  private handlers = new Map<string, Set<Handler>>();

  subscribe(event: string, handler: Handler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  async publish(event: string, payload: unknown): Promise<void> {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of [...set]) {
      await h(payload);
    }
  }
}

let bus: InProcessEventBus | null = null;

export function getEventBus(): InProcessEventBus {
  if (!bus) bus = new InProcessEventBus();
  return bus;
}
