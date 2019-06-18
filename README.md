
# graphql-add-middleware [![Build Status](https://travis-ci.org/alekbarszczewski/graphql-add-middleware.svg?branch=master)](https://travis-ci.org/alekbarszczewski/graphql-add-middleware)

Easily add middleware to GraphQL schema resolvers

## Installation

```sh
$ npm install --save graphql-add-middleware
```

## Features

* Add middleware to all schema resolvers
* Add middleware to resolvers of given type
* Add middleware to resolver of given field of given type

## Usage

```gql
type User {
  name: String!
}

type Post {
  title: String!
  author: User
}

type Query {
  posts: [Post!]!
  user: User
}

type Mutation {
  createUser: User!
}

schema {
  query: Query
  mutation: Mutation
}
```

```js
import { addMiddleware } from 'graphql-add-middleware';

// add middleware to ALL resolvers (also to nested resolver if they are defined in schema like Post.author)
addMiddleware(schema, async function (root, args, context, info, next) {
  // you can modify root, args, context, info
  const result = await next();
  // you can modify result
  return result; // you must return value
});

// add middleware only to given type
addMiddleware(schema, 'Query', async function (root, args, context, info, next) { ... }); // will add middleware to Query.posts and Query.user
addMiddleware(schema, 'Mutation', async function (root, args, context, info, next) { ... }); // will add middleware to Mutation.createUser
addMiddleware(schema, 'Post', async function (root, args, context, info, next) { ... }); // will add middleware to Post.author (Post.*)

// add middleware only to given type/field
addMiddleware(schema, 'Query.posts', async function (root, args, context, info, next) { ... }); // will add middleware to Query.posts
addMiddleware(schema, 'Post.author', async function (root, args, context, info, next) { ... }); // will add middleware to Post.author
```

## License

[License](LICENSE)
