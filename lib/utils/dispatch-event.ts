/**
 * Utility to dispatch custom events for the AI stream
 */
export function dispatchAIStreamEvent(type: string, content: any) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('ai-stream', {
      detail: { type, content }
    });
    window.dispatchEvent(event);
  }
}
