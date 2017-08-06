
import compose from 'koa-compose';
import { getNullableType } from 'graphql';

const wrapMiddleware = function wrapMiddleware (fn) {
  return function (context = {}, next) {
    const args = (context.args || []).concat(next);
    return fn.apply(this, args);
  }
}

const getType = function getType (type) {
  type = getNullableType(type);
  if (type.ofType) {
    type = getType(type.ofType);
  }
  return type;
};

const pre = function pre (pre, fn) {
  pre = wrapMiddleware(pre);
  if (!fn.__chain) {
    fn = (function (fn) {
      return async function ({ args }) {
        return fn.apply(this, args);
      }
    })(fn);
  }
  const chain = fn.__chain || [fn];
  const last = chain.pop();
  chain.push(pre);
  chain.push(last);
  const newFn = compose(chain);
  const wrappedFn = async function (...args) {
    return newFn.call(this, { args });
  }
  wrappedFn.__chain = chain;
  return wrappedFn;
}

export function addMiddleware (schema, path, fn) {
  if (!fn) {
    fn = path;
    path = null;
  }
  let parentType, parentField;
  if (path) {
    [parentType, parentField] = path.split('.');
  }
  const rootTypes = ([
    schema.getQueryType(),
    schema.getMutationType(),
    schema.getSubscriptionType(),
  ]).filter(x => !!x);
  rootTypes.forEach((type) => {
    addMiddlewareToType(type, fn, { parentType, parentField });
  });
};

const addMiddlewareToType = function (type, fn, {
  parentType,
  parentField,
  middlewaredTypes = {}
}) {

  if (type && type.name && middlewaredTypes[type.name]) {
    // Stop going into recursion with adding middlewares
    // on recursive types
    return;
  } else {
    middlewaredTypes[type.name] = true;
  }


  const matchesParent = parentType ? parentType === type.name : true;
  const fields = type.getFields();
  Object.keys(fields).forEach((fieldName) => {
    const matchesField = parentField ? parentField === fieldName : true;
    if (fields[fieldName].resolve && matchesField) {
      fields[fieldName].resolve = pre(fn, fields[fieldName].resolve);
    }
    const fieldType = getType(fields[fieldName].type);
    if (fieldType.getFields) {
      addMiddlewareToType(fieldType, fn, {
        parentType,
        parentField,
        middlewaredTypes
      });
    }
  });
}
