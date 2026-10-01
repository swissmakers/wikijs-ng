const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async comments() { return {} }
  },
  Mutation: {
    async comments() { return {} }
  },
  CommentQuery: {
    /**
     * Fetch list of Comments Providers
     */
    async providers(obj, args, context, info) {
      const providers = await WIKI.models.commentProviders.getProviders()
      return providers.map(provider => {
        const providerInfo = _.find(WIKI.data.commentProviders, ['key', provider.key]) || {}
        return {
          ...providerInfo,
          ...provider,
          config: graphHelper.moduleConfigToKV(provider.config, providerInfo.props)
        }
      })
    },
    /**
     * Fetch list of comments for a page
     */
    async list (obj, args, context) {
      const page = await WIKI.models.pages.query().select('pages.id').findOne({ localeCode: args.locale, path: args.path })
        .withGraphJoined('tags')
        .modifyGraph('tags', builder => {
          builder.select('tag')
        })
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['read:comments'], { tags: page.tags, ...args })) {
          const comments = await WIKI.models.comments.query().where('pageId', page.id).orderBy('createdAt')
          return comments.map(c => ({
            ...c,
            replyTo: c.replyTo || 0,
            authorName: c.name,
            authorEmail: c.email,
            authorIP: c.ip
          }))
        } else {
          throw new WIKI.Error.CommentViewForbidden()
        }
      } else {
        return []
      }
    },
    /**
     * Fetch a single comment
     */
    async single (obj, args, context) {
      const cm = await WIKI.data.commentProvider.getCommentById(args.id)
      if (!cm || !cm.pageId) {
        throw new WIKI.Error.CommentNotFound()
      }
      const page = await WIKI.models.pages.query().select('localeCode', 'path').findById(cm.pageId)
        .withGraphJoined('tags')
        .modifyGraph('tags', builder => {
          builder.select('tag')
        })
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['read:comments'], {
          path: page.path,
          locale: page.localeCode,
          tags: page.tags
        })) {
          return {
            ...cm,
            authorName: cm.name,
            authorEmail: cm.email,
            authorIP: cm.ip
          }
        } else {
          throw new WIKI.Error.CommentViewForbidden()
        }
      } else {
        WIKI.logger.warn(`Comment #${cm.id} is linked to a page #${cm.pageId} that doesn't exist! [ERROR]`)
        throw new WIKI.Error.CommentGenericError()
      }
    }
  },
  CommentMutation: {
    /**
     * Create New Comment
     */
    async create (obj, args, context) {
      try {
        const cmId = await WIKI.models.comments.postNewComment({
          ...args,
          user: context.req.user,
          ip: context.req.ip
        })
        return {
          responseResult: graphHelper.generateSuccess('New comment posted successfully'),
          id: cmId
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Update an Existing Comment
     */
    async update (obj, args, context) {
      try {
        const cmRender = await WIKI.models.comments.updateComment({
          ...args,
          user: context.req.user,
          ip: context.req.ip
        })
        return {
          responseResult: graphHelper.generateSuccess('Comment updated successfully'),
          render: cmRender
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Delete an Existing Comment
     */
    async delete (obj, args, context) {
      try {
        await WIKI.models.comments.deleteComment({
          id: args.id,
          user: context.req.user,
          ip: context.req.ip
        })
        return {
          responseResult: graphHelper.generateSuccess('Comment deleted successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Update Comments Providers
     */
    async updateProviders(obj, args, context) {
      try {
        for (let provider of args.providers) {
          await WIKI.models.commentProviders.query().patch({
            isEnabled: provider.isEnabled,
            config: graphHelper.kvToModuleConfig(provider.config)
          }).where('key', provider.key)
        }
        await WIKI.models.commentProviders.initProvider()
        return {
          responseResult: graphHelper.generateSuccess('Comment Providers updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
