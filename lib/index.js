'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Tbjson = _interopDefault(require('typed-binary-json'));

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

  inject(parentHandler) {
    this[PARENT_HANDLER] = parentHandler; // search tbjson types

    let definition = Tbjson.definition(this);

    for (let key in definition) {
      // must be an object
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

  handle(e, local = false) {
    // only handle if a parent handler is prenset
    if (this[PARENT_HANDLER]) {
      if (!e) {
        e = new TbjsonHandlerEvent(this);
      } else if (!local) {
        e.path.push(this.modelType);
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

Handler.inject = (proto, propertyName, descriptor) => {
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

Handler.injectType = (type, objArgIndex) => {
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

Handler.handle = (proto, propertyName, descriptor) => {
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

Handler.handleType = (type, objArgIndex) => {
  if (typeof type != 'string' || objArgIndex !== undefined && (!Number.isFinite(objArgIndex) || objArgIndex < 0)) {
    throw new Error('[tbjson-handler] "handleType()" must be passed a type and an optional argument index');
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

Handler.handleProp = (proto, propertyName, descriptor) => {
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


class TbjsonHandlerEvent {
  constructor(obj, type, property, value) {
    _defineProperty(this, "cancelled", false);

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

function walk(obj, parentHandler) {
  if (obj && typeof obj == 'object') {
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

function isPropertyFunction(proto, propertyName, descriptor) {
  return typeof proto == 'object' && typeof propertyName == 'string' && typeof descriptor == 'object' && typeof descriptor.value == 'function';
}

function isProperty(proto, propertyName, descriptor) {
  return typeof proto == 'object' && typeof propertyName == 'string' && typeof descriptor == 'object';
}

module.exports = TbjsonHandler;
