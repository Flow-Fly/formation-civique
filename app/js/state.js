/** Simple pub/sub state management */
const state = {};
const listeners = {};

export function getState(key) {
  return state[key];
}

export function setState(key, value) {
  const old = state[key];
  state[key] = value;
  if (listeners[key]) {
    listeners[key].forEach((fn) => fn(value, old));
  }
}

export function subscribe(key, fn) {
  if (!listeners[key]) listeners[key] = [];
  listeners[key].push(fn);
  // Return unsubscribe function
  return () => {
    listeners[key] = listeners[key].filter((f) => f !== fn);
  };
}

export function updateState(key, updater) {
  setState(key, updater(state[key]));
}
