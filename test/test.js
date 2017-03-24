
import { makeExecutableSchema, addResolveFunctionsToSchema } from 'graphql-tools';
import { graphql } from 'graphql';
import { expect } from 'chai';
import GraphqlQueryTree from 'graphql-query-tree';
import { addMiddleware } from './../dist/graphql-middleware';

const typeDefs = [`
  type User {
    id: Int!
    name: String!
  }
  type Post {
    id: Int!
    title: String!
    author: User!
  }
  type Query {
    posts: [Post!]!
    user: User
  }
  type Mutation {
    test: User
  }
  type schema {
    query: Query
    mutation: Mutation
  }
`];

const resolvers = {
  Query: {
    posts (root, args, context, info) {
      return [{ id: 1, title: 'a', author: { id: 1, name: 'John' } }];
    },
    user (root, args, context, info) {
      return null;
    },
  },
};

describe('graphql-middleware', function () {

  beforeEach(function () {
    this.schema = makeExecutableSchema({ typeDefs, resolvers });
  })

  it('should return correct result without middleware', async function () {
    const query = `
      query {
        posts { id, title, author { id, name } }
      }
    `;
    const result = await graphql(this.schema, query);
    expect(result.data.posts).to.eql([{ id: 1, title: 'a', author: { id: 1, name: 'John' } }]);
  });

  it('should allow to run middleware after resolver', async function () {
    addMiddleware(this.schema, async function (root, args, context, info, next) {
      const result = await next();
      return result.concat([{ id: 2, title: 'b', author: { id: 2, name: 'Jack' } }]);
    });
    const query = `
      query {
        posts { id, title, author { id, name } }
      }
    `;
    const result = await graphql(this.schema, query);
    expect(result.data.posts).to.eql([
      { id: 1, title: 'a', author: { id: 1, name: 'John' } },
      { id: 2, title: 'b', author: { id: 2, name: 'Jack' } },
    ]);
  });

  it('should allow to run middleware instead of resolver', async function () {
    addMiddleware(this.schema, async function (root, args, context, info, next) {
      return [{ id: 2, title: 'b', author: { id: 2, name: 'Jack' } }];
    });
    const query = `
      query {
        posts { id, title, author { id, name } }
      }
    `;
    const result = await graphql(this.schema, query);
    expect(result.data.posts).to.eql([
      { id: 2, title: 'b', author: { id: 2, name: 'Jack' } },
    ]);
  });

  it('should allow to run more than one middleware and preserve correct order', async function () {
    addMiddleware(this.schema, async function (root, args, context, info, next) {
      const result = await next();
      return result.concat([{ id: 3, title: 'c', author: { id: 3, name: 'Peter' } }]);
    });
    addMiddleware(this.schema, async function (root, args, context, info, next) {
      const result = await next();
      return result.concat([{ id: 2, title: 'b', author: { id: 2, name: 'Jack' } }]);
    });
    const query = `
      query {
        posts { id, title, author { id, name } }
      }
    `;
    const result = await graphql(this.schema, query);
    expect(result.data.posts).to.eql([
      { id: 1, title: 'a', author: { id: 1, name: 'John' } },
      { id: 2, title: 'b', author: { id: 2, name: 'Jack' } },
      { id: 3, title: 'c', author: { id: 3, name: 'Peter' } },
    ]);
  });

  it('should allow to modify arguments', async function () {
    addMiddleware(this.schema, async function (root, args, context, info, next) {
      root._changed = args._changed = context._changed = info._changed = true;
      return await next();
    });
    let rootChanged, argsChanged, contextChanged, infoChanged;
    addMiddleware(this.schema, async function (root, args, context, info, next) {
      rootChanged = root._changed;
      argsChanged = args._changed;
      contextChanged = context._changed;
      infoChanged = info._changed;
      return await next();
    });
    const query = `
      query {
        posts { id, title, author { id, name } }
      }
    `;
    const result = await graphql(this.schema, query, {}, {}, {});
    expect(result.data.posts).to.eql([
      { id: 1, title: 'a', author: { id: 1, name: 'John' } },
    ]);
    expect(rootChanged).to.equal(true);
    expect(argsChanged).to.equal(true);
    expect(contextChanged).to.equal(true);
    expect(infoChanged).to.equal(true);
  });

  it('should affect nested resolvers', async function () {
    addResolveFunctionsToSchema(this.schema, {
      Post: {
        author (root, args, context, info) {
          return { id: 1, name: 'Mark' };
        },
      },
    });
    const query = `
      query {
        posts { id, title, author { id, name } }
      }
    `;
    const result = await graphql(this.schema, query, {}, {}, {});
    expect(result.data.posts).to.eql([{ id: 1, title: 'a', author: { id: 1, name: 'Mark' } }]);
    addMiddleware(this.schema, async function (root, args, context, info, next) {
      const tree = new GraphqlQueryTree(info);
      const path = `${tree.getParentType()}.${tree.getParentField()}`;
      if (path === 'Post.author') {
        return { id: 10, name: 'Jacob' };
      } else {
        return await next();
      }
    });
    const result2 = await graphql(this.schema, query);
    expect(result2.data.posts).to.eql([{ id: 1, title: 'a', author: { id: 10, name: 'Jacob' } }]);
  });

  it('should add middleware only to given type', async function () {
    const query = `
      query {
        posts { id, title, author { id, name } }
        user { id, name }
      }
    `;
    const result = await graphql(this.schema, query, {}, {}, {});
    expect(result.data.posts).to.eql([{ id: 1, title: 'a', author: { id: 1, name: 'John' } }]);
    expect(result.data.user).to.equal(null);

    let paths = [];

    addMiddleware(this.schema, 'Query.posts', async function (root, args, context, info, next) {
      const tree = new GraphqlQueryTree(info);
      const path = `${tree.getParentType()}.${tree.getParentField()}`;
      paths.push(path);
      return await next();
    });
    await graphql(this.schema, query);
    expect(paths.sort()).to.eql([ 'Query.posts' ]);

    paths = [];

    addMiddleware(this.schema, 'Query.user', async function (root, args, context, info, next) {
      const tree = new GraphqlQueryTree(info);
      const path = `${tree.getParentType()}.${tree.getParentField()}`;
      paths.push(path);
      return await next();
    });
    await graphql(this.schema, query);
    expect(paths.sort()).to.eql([ 'Query.posts', 'Query.user' ]);

    paths = [];

    addMiddleware(this.schema, 'Query', async function (root, args, context, info, next) {
      const tree = new GraphqlQueryTree(info);
      const path = `${tree.getParentType()}.${tree.getParentField()}`;
      paths.push(path);
      return await next();
    });
    await graphql(this.schema, query);
    expect(paths.sort()).to.eql([ 'Query.posts', 'Query.posts', 'Query.user', 'Query.user' ]);

    paths = [];

    await graphql(this.schema, 'mutation { test { id, name } }');
    expect(paths.sort()).to.eql([]);

  });

  it('should work with normal functions', async function () {
    const query = `
      query {
        posts { id, title, author { id, name } }
      }
    `;
    addMiddleware(this.schema, 'Query.posts', function (root, args, context, info, next) {
      return [{ id: 99, title: 'z', author: { id: 99, name: 'Michael' } }];
    });
    const result = await graphql(this.schema, query);
    expect(result.data.posts).to.eql([{ id: 99, title: 'z', author: { id: 99, name: 'Michael' } }]);
  });

  it('should work with promises', async function () {
    const query = `
      query {
        posts { id, title, author { id, name } }
      }
    `;
    addMiddleware(this.schema, 'Query.posts', function (root, args, context, info, next) {
      return Promise.resolve([{ id: 99, title: 'z', author: { id: 99, name: 'Michael' } }]);
    });
    const result = await graphql(this.schema, query);
    expect(result.data.posts).to.eql([{ id: 99, title: 'z', author: { id: 99, name: 'Michael' } }]);
  });

});
