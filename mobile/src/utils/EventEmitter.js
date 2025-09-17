/**
 * Echo Mobile App - Event Emitter Utility
 * Provides event handling functionality for services and components
 */

/**
 * Simple EventEmitter implementation for React Native
 * Provides pub/sub functionality for decoupled communication
 */
export class EventEmitter {
  constructor() {
    this.events = new Map();
    this.maxListeners = 10;
  }

  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function
   * @param {Object} options - Options object
   * @param {boolean} options.once - If true, listener will be removed after first call
   * @param {boolean} options.prepend - If true, listener will be added to the beginning
   */
  on(event, listener, options = {}) {
    if (typeof event !== 'string') {
      throw new TypeError('Event name must be a string');
    }

    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }

    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    const listeners = this.events.get(event);

    // Check max listeners
    if (listeners.length >= this.maxListeners) {
      console.warn(`EventEmitter: Maximum listeners (${this.maxListeners}) exceeded for event '${event}'`);
    }

    const listenerWrapper = {
      listener,
      once: options.once || false,
      context: options.context || null,
    };

    if (options.prepend) {
      listeners.unshift(listenerWrapper);
    } else {
      listeners.push(listenerWrapper);
    }

    return this;
  }

  /**
   * Add a one-time event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function
   */
  once(event, listener) {
    return this.on(event, listener, { once: true });
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function to remove
   */
  off(event, listener) {
    if (!this.events.has(event)) {
      return this;
    }

    const listeners = this.events.get(event);
    const index = listeners.findIndex(wrapper => wrapper.listener === listener);

    if (index > -1) {
      listeners.splice(index, 1);

      // Clean up empty event arrays
      if (listeners.length === 0) {
        this.events.delete(event);
      }
    }

    return this;
  }

  /**
   * Remove all listeners for an event, or all events if no event specified
   * @param {string} [event] - Event name (optional)
   */
  removeAllListeners(event) {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to listeners
   */
  emit(event, ...args) {
    if (!this.events.has(event)) {
      return false;
    }

    const listeners = this.events.get(event).slice(); // Create a copy to avoid issues with modifications during iteration
    let hasListeners = false;

    for (const wrapper of listeners) {
      hasListeners = true;

      try {
        if (wrapper.context) {
          wrapper.listener.apply(wrapper.context, args);
        } else {
          wrapper.listener(...args);
        }
      } catch (error) {
        console.error(`EventEmitter: Error in listener for event '${event}':`, error);
        // Continue executing other listeners even if one fails
      }

      // Remove one-time listeners
      if (wrapper.once) {
        this.off(event, wrapper.listener);
      }
    }

    return hasListeners;
  }

  /**
   * Get the number of listeners for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    if (!this.events.has(event)) {
      return 0;
    }
    return this.events.get(event).length;
  }

  /**
   * Get all listeners for an event
   * @param {string} event - Event name
   * @returns {Function[]} Array of listener functions
   */
  listeners(event) {
    if (!this.events.has(event)) {
      return [];
    }
    return this.events.get(event).map(wrapper => wrapper.listener);
  }

  /**
   * Get all event names that have listeners
   * @returns {string[]} Array of event names
   */
  eventNames() {
    return Array.from(this.events.keys());
  }

  /**
   * Set the maximum number of listeners per event
   * @param {number} max - Maximum number of listeners
   */
  setMaxListeners(max) {
    if (typeof max !== 'number' || max < 0) {
      throw new TypeError('Max listeners must be a non-negative number');
    }
    this.maxListeners = max;
    return this;
  }

  /**
   * Get the maximum number of listeners per event
   * @returns {number} Maximum number of listeners
   */
  getMaxListeners() {
    return this.maxListeners;
  }

  /**
   * Add a listener to the beginning of the listeners array
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function
   */
  prependListener(event, listener) {
    return this.on(event, listener, { prepend: true });
  }

  /**
   * Add a one-time listener to the beginning of the listeners array
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function
   */
  prependOnceListener(event, listener) {
    return this.on(event, listener, { prepend: true, once: true });
  }

  /**
   * Create a promise that resolves when the event is emitted
   * @param {string} event - Event name
   * @param {number} [timeout] - Optional timeout in milliseconds
   * @returns {Promise} Promise that resolves with event arguments
   */
  waitFor(event, timeout) {
    return new Promise((resolve, reject) => {
      let timeoutId;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      const listener = (...args) => {
        cleanup();
        resolve(args);
      };

      this.once(event, listener);

      if (timeout && timeout > 0) {
        timeoutId = setTimeout(() => {
          this.off(event, listener);
          reject(new Error(`Timeout waiting for event '${event}' after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  /**
   * Pipe events from this emitter to another emitter
   * @param {EventEmitter} target - Target event emitter
   * @param {string|string[]} [events] - Specific events to pipe (all if not specified)
   */
  pipe(target, events) {
    if (!(target instanceof EventEmitter)) {
      throw new TypeError('Target must be an EventEmitter instance');
    }

    const eventsToPipe = events ? (Array.isArray(events) ? events : [events]) : this.eventNames();

    eventsToPipe.forEach(event => {
      this.on(event, (...args) => {
        target.emit(event, ...args);
      });
    });

    return this;
  }

  /**
   * Create a filtered event emitter that only emits events matching a condition
   * @param {Function} filter - Filter function that receives (event, ...args) and returns boolean
   * @returns {EventEmitter} New filtered event emitter
   */
  filter(filter) {
    const filtered = new EventEmitter();

    // Pipe all events through the filter
    this.eventNames().forEach(event => {
      this.on(event, (...args) => {
        if (filter(event, ...args)) {
          filtered.emit(event, ...args);
        }
      });
    });

    return filtered;
  }

  /**
   * Create a mapped event emitter that transforms events
   * @param {Function} mapper - Mapper function that receives (event, ...args) and returns {event, args}
   * @returns {EventEmitter} New mapped event emitter
   */
  map(mapper) {
    const mapped = new EventEmitter();

    this.eventNames().forEach(event => {
      this.on(event, (...args) => {
        try {
          const result = mapper(event, ...args);
          if (result && typeof result === 'object') {
            const { event: newEvent, args: newArgs } = result;
            mapped.emit(newEvent || event, ...(newArgs || args));
          }
        } catch (error) {
          console.error('EventEmitter: Error in mapper function:', error);
        }
      });
    });

    return mapped;
  }

  /**
   * Get debug information about the event emitter
   * @returns {Object} Debug information
   */
  debug() {
    const info = {
      totalEvents: this.events.size,
      totalListeners: 0,
      events: {},
      maxListeners: this.maxListeners,
    };

    this.events.forEach((listeners, event) => {
      info.totalListeners += listeners.length;
      info.events[event] = {
        listenerCount: listeners.length,
        listeners: listeners.map(wrapper => ({
          once: wrapper.once,
          hasContext: !!wrapper.context,
          functionName: wrapper.listener.name || 'anonymous',
        })),
      };
    });

    return info;
  }
}

// Create a global event emitter instance for app-wide events
export const globalEventEmitter = new EventEmitter();

// Export default
export default EventEmitter;