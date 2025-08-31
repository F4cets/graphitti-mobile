declare module 'eventsource-polyfill' {
  const EventSourcePolyfill: any;
  export default EventSourcePolyfill;
}

declare module 'firebase/auth/react-native' {
  export function initializeAuth(app: any, options: any): any;
  export function getReactNativePersistence(storage: any): any;
}

declare global {
  var EventTarget: {
    new(): EventTarget;
  };
  interface EventTarget {
    listeners: { [type: string]: Function[] };
    addEventListener(type: string, listener: Function): void;
    removeEventListener(type: string, listener: Function): void;
    dispatchEvent(event: Event): boolean;
  }
  var Event: {
    new(type: string): Event;
  };
  interface Event {
    type: string;
    defaultPrevented: boolean;
    preventDefault(): void;
  }
  var EventSource: typeof EventSource;
}