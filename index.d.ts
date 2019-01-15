/// <reference types="node" />
/// <reference types="graphql" />

declare module 'graphql-add-middleware' {

  export function addMiddleware (
    schema: GraphQLSchema,
    path: string,
    fn: (root: any, args: any, context: any, info: any, next: () => Promise<any>) => any,
  ): void;
};