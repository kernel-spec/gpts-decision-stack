// Event type enum for delivery-integrity events
export enum DeliveryEventType {
  ArtifactAttemptCreated = 'artifact_attempt_created',
  ArtifactSuperseded = 'artifact_superseded',
  HandoffCompleted = 'handoff_completed',
  HandoffFailed = 'handoff_failed',
  StageLoopDetected = 'stage_loop_detected'
}

// Thin event emission abstraction
export function emitEvent(eventType: DeliveryEventType, payload: object): void {
  // Replace with actual event infra if present, or log for now
  console.log(`[EVENT] ${eventType}`, payload);
}
