import type { EventBus } from "./event-bus.js";
import type { ViewProjector } from "./view-projector.js";
export interface ViewEventBridgeStop {
    (): void;
}
/**
 * Wire the bridge. Returns a function that unsubscribes (used in tests +
 * for graceful daemon shutdown). The bridge subscribes to event-bus and
 * only fires for known coordination event types.
 */
export declare function wireViewEventBridge(eventBus: EventBus, viewProjector: ViewProjector): ViewEventBridgeStop;
//# sourceMappingURL=view-event-bridge.d.ts.map