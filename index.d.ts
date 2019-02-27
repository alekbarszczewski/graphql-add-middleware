/// <reference types="node" />
/// <reference types="graphql" />

declare module 'graphql-add-middleware' {
  import { GraphQLSchema } from 'graphql';

  type middlewareFn = (root: any, args: any, context: any, info: any, next: () => Promise<any>) => Promise<any>;

  export function addMiddleware (
    schema: GraphQLSchema,
    fn: middlewareFn,
  ): void;

  export function addMiddleware (
    schema: GraphQLSchema,
    path: string,
    fn: middlewareFn,
  ): void;
}