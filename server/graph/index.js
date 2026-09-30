const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const autoload = require('auto-load')
const { makeExecutableSchema } = require('@graphql-tools/schema')

const authDirectiveTransformer = require('./directives/auth')
const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = require('./directives/rate-limit')

/* global WIKI */

WIKI.logger.info(`Loading GraphQL Schema...`)

// Schemas

let typeDefs = [rateLimitDirectiveTypeDefs]
let schemas = fs.readdirSync(path.join(WIKI.SERVERPATH, 'graph/schemas'))
schemas.forEach(schema => {
  typeDefs.push(fs.readFileSync(path.join(WIKI.SERVERPATH, `graph/schemas/${schema}`), 'utf8'))
})

// Resolvers

let resolvers = {}
const resolversObj = _.values(autoload(path.join(WIKI.SERVERPATH, 'graph/resolvers')))
resolversObj.forEach(resolver => {
  _.merge(resolvers, resolver)
})

// Build Schema + Apply Directives

let schema = makeExecutableSchema({
  typeDefs,
  resolvers
})
schema = authDirectiveTransformer(schema)
schema = rateLimitDirectiveTransformer(schema)

WIKI.logger.info(`GraphQL Schema: [ OK ]`)

module.exports = {
  schema
}
