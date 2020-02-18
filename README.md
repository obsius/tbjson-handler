# TBJSON Handler

An event handler based off of the standard DOM event chain, but for TBJSON annotated data.
  
[Read about TBJSON here.](https://www.npmjs.com/package/typed-binary-json)

## Format

Typed Binary JSON provides a way to describe structured data.  
This package follows the TBJSON scheme and provides a way to listen to events (changes) in the structured data.  
The typical use case for this package is needing to listen for a change in a complicated tree structure while being performance minded.  
All of your classes must derive from the Handler Class.  
It is best to have a base `Model` class that inherits from `TbjsonHandler` so that you can add common functionality there.

### Working Example

```js

import Tbjson from 'typed-binary-json';
import Handler from 'tbjson-handler';

class Model extends Handler {

	// a modelType accessor must be present on all classes
	// modelType will be propagated up to allow for selective listening
	get modelType() {
		return this.constructor.modelType;
	}
}

Model.modelType = 'Model'; // set the value of the protype itself, the getter will source from here

class A extends Model {

	@Handler.prop x = 'string'; // handle when x changes
	@Handler.prop y = 'boolean'; // handle when y changes
	z = [new A(), new A()]

	// handle when this function is called
	@Handler.handle addZ(z) {
		this.z.push(z);
	}
}

A.modelType = 'A';

A.tbjson = {

	// by default all properties in the definition below are listened to, set a property to false here to omit one
	handles: {
		z: false // do not listen to z
	},

	// the TBJSON definition
	definition: {
		x: Tbjson.TYPES.STRING, // a string
		y: Tbjson.TYPES.STRING, // a string
		z: [Tbjson.TYPES.ARRAY, A] // an array of class A
	}
};

class B extends Model {
	a = new A();
}

B.modelType = 'B';

B.tbjson = {
	definition: {
		a: A // a is of class A (above)
	}
};

class C extends Model {
	b = new B();
}

C.modelType = 'C';

C.tbjson = {
	definition: {
		b: B // b is of class B (above)
	}
};

let c = new C();

c.listen(null, null, (e) => console.log(e)); // listen for any event

c.b.a.addZ(new A()); // console will print a TbjsonHandlerEvent (below)

// TbjsonHandlerEvent: {
//     obj: c,
//     path: ['A', 'B', 'C'],
//     objs: [a, b, c],
//     type: undefined,
//     property: undefined,
//     value: undefined
// }

```

## Methods

All classes that inherit from `TbjsonHandler` (the default and only export of this package) will have the following methods:

### inject(parentHandler) => undefined

Inject a handler into the object (will crawl all TBJSON defined properties and also add to those).

### handle(e, local) => undefined

Fire an event. If nothing is passed a new `TbjsonHandlerEvent` will be made for the class.
If you've already constructed an event for this class, pass true as arg 2, and the class will not re-add its signature.

### listen(nameOrArrayOrFilterFn, propertyNameOrArray, fn) => destroyer()

Attach a listener to an object.

Takes in:

- arg 1: a `modelType` (class name), or array of them, or a filter function
- arg 2: a property name or array of them
- arg 3: the function to call if an event matches

## Decorators

Use these decorators to control how events will be handled.

### @Handler.inject

Fire an event everytime this function is called and also inject `this` into the first argument passed into the function (`inject()` will be called on the passed object).

### @Handler.injectType(type, objArgIndex)

Same as above but also provide a type (string) and optionally an argument number as to which argument needs injection.
Type will be a field on the event object that bubbled up.

### @Handler.handle

Fire an event everytime this function is called.

### @Handler.handleType(type)

Fire an event everytime this function is called and include a type to be addded to the event object that will bubble up.

### @Handler.prop

Fire an event everytime the property changes. An event type of `changed` will always be set on the propogating event.

## Visible Data

The only data that will be passed up will be of `TbjsonHandlerEvent`.

```js
TbjsonHandlerEvent {
	obj: {}, // the source object
	path: [], // an array of string which are the modelTypes (class names)
	obj: [], // the actual objects that correspond to the path above
	type: 'string', // the type of event
	property: 'string', // if a property has changed, the property name
	value: 'any', // if a property has changed, the new property value
}
```

## Contributing

Feel free to make changes and submit pull requests whenever.

## License

TBJSON Handler uses the [MIT](https://opensource.org/licenses/MIT) license.