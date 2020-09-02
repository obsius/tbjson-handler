'use strict';

var Tbjson = require('typed-binary-json');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var Tbjson__default = /*#__PURE__*/_interopDefaultLegacy(Tbjson);

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

const HANDLER = Symbol('[tbjson-handler] handler');
const PARENT_HANDLER = Symbol('[tbjson-handler] parent handler');
const INITIALIZERS = Symbol('[tbjson-handler] initializers');
const MASKED = Symbol('[tbjson-handler] masked');
const LISTENERS = Symbol('[tbjson-handler] listeners');
let nextListenerId = 0;
/**
 * TbjsonHandler
 * 
 * An event handler for TBJSON annotated classes.
 */

class TbjsonHandler {
  constructor() {
    _defineProperty(this, HANDLER, true);

    _defineProperty(this, MASKED, {});

    _defineProperty(this, LISTENERS, {
      all: {},
      fns: {},
      models: {},
      props: {}
    });

    if (this[INITIALIZERS]) {
      for (let initializer of this[INITIALIZERS]) {
        initializer.call(this);
      }

      delete this[INITIALIZERS];
    }
  }
  /**
   * Inject a parent handler into this. Recursively adds to all appropriate children.
   * 
   * @param { TbjsonHandler } parentHandler - the parent handler to inject
   */


  inject(parentHandler) {
    this[PARENT_HANDLER] = parentHandler; // search tbjson types

    let definition = Tbjson__default['default'].definition(this);
    let handles = fetchHandles(this);

    for (let key in definition) {
      // ignore handles explictly set to false
      if (handles && handles[key] === false) {
        continue;
      } // ignore typed arrays


      if (ArrayBuffer.isView(this[key])) {
        continue;
      } // must be an object


      if (this[key] && typeof this[key] == 'object') {
        // handler
        if (this[key][HANDLER]) {
          this[key].inject(this); // array or plain object
        } else {
          walk(this[key], this);
        }
      }
    }
  }
  /**
   * Handle an event by dispatching to listerners and forwarding up the tree.
   * 
   * @param { TbjsonHandlerEvent } e - source event
   * @param { boolean } [local] - do not add this to the event path
   */


  handle(e, local = false) {
    // only handle if a parent handler is prenset
    if (this[PARENT_HANDLER]) {
      if (!e) {
        e = new TbjsonHandlerEvent(this);
      } else if (!local) {
        e.path.push(this.modelType);
        e.objs.push(this);
      } // trigger props


      if (e.property) {
        let propListeners = this[LISTENERS].props[e.property];

        if (propListeners) {
          for (let id in propListeners) {
            propListeners[id](e);
          }
        }
      } // trigger models


      if (e.modelType) {
        let modelListeners = this[LISTENERS].models;

        if (modelListeners) {
          for (let id in modelListeners) {
            modelListeners[id](e);
          }
        }
      } // trigger fns


      for (let id in this[LISTENERS].fns) {
        this[LISTENERS].fns[id](e);
      }

      this[PARENT_HANDLER].handle(e);
    }
  }
  /**
   * Add a listener.
   * Returns a destroyer function to unbind.
   * 
   * @param { string | []string | function } [nameOrArrayOrFilterFn] - string / array of strings / function to match the event
   * @param { string | []string } [propertyNameOrArray] - string / array of strings to match a property
   * @param { function } propertyNameOrArray - function to call when the matched event is found
   */


  listen(nameOrArrayOrFilterFn, propertyNameOrArray, fn) {
    // error
    if (typeof fn != 'function') {
      throw new Error('[tbjson-handler] Invalid listener passed: "fn" is not a function');
    }

    let allListeners = this[LISTENERS].all;
    let fnListeners = this[LISTENERS].fns;
    let modelListeners = this[LISTENERS].models;
    let propListeners = this[LISTENERS].props; // all

    if (nameOrArrayOrFilterFn == null) {
      // all
      if (propertyNameOrArray == null) {
        let id = nextListenerId++;
        allListeners[id] = fn;
        return () => {
          delete allListeners[id];
        }; // property
      } else {
        // array
        if (Array.isArray(propertyNameOrArray)) {
          let destroyers = [];

          for (let propertyName of propertyNameOrArray) {
            destroyers.push(this.listen(null, propertyName, fn));
          }

          return () => {
            for (let destroyer of destroyers) {
              destroyer();
            }
          }; // single property
        } else {
          let id = nextListenerId++;

          if (!propListeners[propertyNameOrArray]) {
            propListeners[propertyNameOrArray] = {};
          }

          propListeners[propertyNameOrArray][id] = fn;
          return () => {
            delete propListeners[propertyNameOrArray][id];
          };
        }
      } // single

    } else if (typeof nameOrArrayOrFilterFn == 'string') {
      let id = nextListenerId++;

      if (!modelListeners[nameOrArrayOrFilterFn]) {
        modelListeners[nameOrArrayOrFilterFn] = {};
      }

      modelListeners[nameOrArrayOrFilterFn][id] = fn;
      return () => {
        delete modelListeners[nameOrArrayOrFilterFn][id];
      }; // array
    } else if (Array.isArray(nameOrArrayOrFilterFn)) {
      let destroyers = [];

      for (let nameOrFn of nameOrArrayOrFilterFn) {
        destroyers.push(this.listen(nameOrFn, propertyNameOrArray, fn));
      }

      return () => {
        for (let desoyer of destroyers) {
          desoyer();
        }
      }; // function
    } else if (typeof nameOrArrayOrFilterFn == 'function') {
      let id = nextListenerId++;
      fnListeners[id] = fn;
      return () => {
        delete fnListeners[id];
      }; // error
    } else {
      throw new Error('[tbjson-handler] Invalid listener passed: "nameOrArrayOrFilterFn" is invalid');
    }
  }

}
/**
 * Decorator
 * 
 * Handle a function and emit events.
 * Injects a handler into the first argument.
 */

TbjsonHandler.inject = (proto, propertyName, descriptor) => {
  if (!isPropertyFunction(proto, propertyName, descriptor)) {
    throw new Error('[tbjson-handler] "inject()" must be passed a prototype function');
  }

  let fn = descriptor.value;

  descriptor.value = function (...args) {
    if (args.length && args[0][HANDLER]) {
      args[0].inject(this);
    }

    fn.call(this, ...args);

    if (this[HANDLER]) {
      this.handle();
    }
  };
};
/**
 * Decorator
 * 
 * Handle a function and emit events.
 * Injects a handler into the first argument or specified argument index.
 * 
 * @param { string } type - type of event to propagate
 * @param { number } [objArgIndex] - an argument index to use as the subject for the parent handler injection
 */


TbjsonHandler.injectType = (type, objArgIndex) => {
  if (typeof type != 'string' || objArgIndex !== undefined && (!Number.isFinite(objArgIndex) || objArgIndex < 0)) {
    throw new Error('[tbjson-handler] "injectType()" must be passed a type and an optional argument index');
  }

  return (proto, propertyName, descriptor) => {
    if (!isPropertyFunction(proto, propertyName, descriptor)) {
      throw new Error('[tbjson-handler] "injectType()()" must be passed a prototype function');
    }

    let fn = descriptor.value;

    descriptor.value = function (...args) {
      if (args.length && args[0][HANDLER]) {
        args[0].inject(this);
      }

      fn.call(this, ...args);

      if (this[HANDLER]) {
        this.handle(new TbjsonHandlerEvent(this, type), true);
      }
    };
  };
};
/**
 * Decorator
 * 
 * Handle a function and emit events.
 */


TbjsonHandler.handle = (proto, propertyName, descriptor) => {
  if (!isPropertyFunction(proto, propertyName, descriptor)) {
    throw new Error('[tbjson-handler] "handle()" must be passed a prototype function');
  }

  let fn = descriptor.value;

  descriptor.value = function (...args) {
    fn.call(this, ...args);

    if (this[HANDLER]) {
      this.handle();
    }
  };
};
/**
 * Decorator
 * 
 * Handle a function and emit events.
 * 
 * @param { string } type - type of event to propagate
 */


TbjsonHandler.handleType = type => {
  if (typeof type != 'string') {
    throw new Error('[tbjson-handler] "handleType()" must be passed a type');
  }

  return (proto, propertyName, descriptor) => {
    if (!isPropertyFunction(proto, propertyName, descriptor)) {
      throw new Error('[tbjson-handler] "handleType()()" must be passed a prototype function');
    }

    let fn = descriptor.value;

    descriptor.value = function (...args) {
      fn.call(this, ...args);

      if (this[HANDLER]) {
        this.handle(new TbjsonHandlerEvent(this, type), true);
      }
    };
  };
};
/**
 * Decorator
 * 
 * Handle property changes by removing this property and replacing it with a getter and setter.
 * Adds the underlying property to a symbol.
 */


TbjsonHandler.handleProp = (proto, propertyName, descriptor) => {
  if (!isProperty(proto, propertyName, descriptor)) {
    throw new Error('[tbjson-handler] "handleProp()" must be passed a prototype property');
  }

  if (descriptor.initializer) {
    let value = descriptor.initializer();

    if (!proto[INITIALIZERS]) {
      proto[INITIALIZERS] = [];
    }

    proto[INITIALIZERS].push(function () {
      this[MASKED][propertyName] = value;
    });
  }

  delete descriptor.writable;
  delete descriptor.initializer;

  descriptor.get = function () {
    return this[MASKED][propertyName];
  };

  descriptor.set = function (value) {
    this[MASKED][propertyName] = value;
    this.handle(new TbjsonHandlerEvent(this, 'change', propertyName, value), true);
  };
};
/* internal */

/**
 * TbjsonHandlerEvent
 * 
 * Source event class.
 */


class TbjsonHandlerEvent {
  constructor(obj, type, property, value) {
    _defineProperty(this, "cancelled", false);

    _defineProperty(this, "objs", []);

    this.obj = obj;
    this.path = [obj.modelType];
    this.type = type;
    this.property = property;
    this.value = value;
  }

  stopPropagation() {
    this.cancelled = true;
  }

}
/**
 * Walk an object's properties and inject if a TBJSON type is found.
 * 
 * @param { object } obj - object to recursively search 
 * @param { object } parentHandler - parent handler to inject 
 */


function walk(obj, parentHandler) {
  if (obj && typeof obj == 'object' && !ArrayBuffer.isView(obj)) {
    // array
    if (Array.isArray(obj)) {
      for (let item of obj) {
        walk(item, parentHandler);
      } // object

    } else {
      // handler
      if (obj[HANDLER]) {
        obj.inject(parentHandler); // plain object
      } else {
        for (let key in obj) {
          walk(obj[key], parentHandler);
        }
      }
    }
  }
}
/**
 * Get all handles from a TBJSON classed prototype.
 * 
 * @param { function } prototype - prototype to check for parent of 
 */


function fetchHandles(obj) {
  if (obj && typeof obj == 'object' && obj.constructor.tbjson) {
    let handles = obj.constructor.tbjson.handles;

    for (let parent = obj.constructor; parent = getParent(parent);) {
      if (!parent.tbjson) {
        break;
      }

      if (parent.tbjson.handles) {
        handles = Object.assign({}, parent.tbjson.handles, handles);
      }
    }

    return handles;
  }
}
/**
 * Return the parent of a prototype.
 * 
 * @param { function } prototype - prototype to check for parent of 
 */


function getParent(prototype) {
  let parent = prototype ? Object.getPrototypeOf(prototype) : null;
  return parent && parent.name ? parent : null;
}
/**
 * Determine if a decorator passed function is a protoype function.
 * 
 * @param { function } proto - function's prototype 
 * @param { string } propertyName - function's property's name 
 * @param { object } descriptor - function's descriptor 
 */


function isPropertyFunction(proto, propertyName, descriptor) {
  return typeof proto == 'object' && typeof propertyName == 'string' && typeof descriptor == 'object' && typeof descriptor.value == 'function';
}
/**
 * Determine if a decorator passed property is a protoype property.
 * 
 * @param { function } proto - property's prototype 
 * @param { string } propertyName - property's name 
 * @param { object } descriptor - property's descriptor 
 */


function isProperty(proto, propertyName, descriptor) {
  return typeof proto == 'object' && typeof propertyName == 'string' && typeof descriptor == 'object';
}

module.exports = TbjsonHandler;
