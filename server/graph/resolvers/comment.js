const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

/**
 * Approved comments are visible to everyone, pending ones to their author and to moderators
 */
const isVisibleComment = (cm, user, isModerator) => {
  if (cm.isApproved !== false && cm.isApproved !== 0) {
    return true
  }
  return isModerator || (user && user.id !== 2 && cm.authorId === user.id)
}

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
      const page = await WIKI.models.pages.query().select('pages.id', 'pages.extra').findOne({ localeCode: args.locale, path: args.path })
        .withGraphJoined('tags')
        .modifyGraph('tags', builder => {
          builder.select('tag')
        })
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['read:comments'], { tags: page.tags, ...args })) {
          if (_.get(page, 'extra.commentsDisabled', false) === true) {
            return []
          }
          const isModerator = WIKI.auth.checkAccess(context.req.user, ['manage:comments'], { tags: page.tags, ...args })
          const comments = await WIKI.models.comments.query().where('pageId', page.id).orderBy('createdAt')
          return comments.filter(c => isVisibleComment(c, context.req.user, isModerator)).map(c => ({
            ...c,
            replyTo: c.replyTo || 0,
            isApproved: c.isApproved !== false && c.isApproved !== 0,
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
        const pageCtx = {
          path: page.path,
          locale: page.localeCode,
          tags: page.tags
        }
        if (WIKI.auth.checkAccess(context.req.user, ['read:comments'], pageCtx) &&
          isVisibleComment(cm, context.req.user, WIKI.auth.checkAccess(context.req.user, ['manage:comments'], pageCtx))) {
          return {
            ...cm,
            isApproved: cm.isApproved !== false && cm.isApproved !== 0,
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
    },
    /**
     * Comments for moderation (built-in provider), newest first
     */
    async moderation (obj, args, context) {
      const limit = _.clamp(_.toSafeInteger(args.limit) || 50, 1, 200)
      const rows = await WIKI.models.knex('comments')
        .join('pages', 'comments.pageId', 'pages.id')
        .select('comments.id', 'comments.replyTo', 'comments.render', 'comments.name', 'comments.isApproved', 'comments.createdAt',
          'pages.id as pageId', 'pages.localeCode', 'pages.path', 'pages.title')
        .modify(qb => {
          if (args.pendingOnly) { qb.where('comments.isApproved', false) }
          if (args.before > 0) { qb.where('comments.id', '<', args.before) }
        })
        .orderBy('comments.id', 'desc')
        .limit(limit * 4)
      return _.take(rows.filter(r => WIKI.auth.checkAccess(context.req.user, ['manage:comments'], { path: r.path, locale: r.localeCode })), limit).map(r => ({
        id: r.id,
        replyTo: r.replyTo || 0,
        render: r.render,
        authorName: r.name,
        isApproved: r.isApproved !== false && r.isApproved !== 0,
        createdAt: r.createdAt,
        pageId: r.pageId,
        pageLocale: r.localeCode,
        pagePath: r.path,
        pageTitle: r.title
      }))
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
        const cm = await WIKI.models.comments.query().select('isApproved').findById(cmId)
        const isPending = Boolean(cm) && (cm.isApproved === false || cm.isApproved === 0)
        return {
          responseResult: graphHelper.generateSuccess(isPending ? 'Your comment is awaiting approval by a moderator.' : 'New comment posted successfully'),
          id: cmId,
          isPending
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
     * Approve a comment held for moderation
     */
    async approve (obj, args, context) {
      try {
        const cm = await WIKI.models.comments.query().select('id', 'pageId').findById(args.id)
        if (!cm) {
          throw new WIKI.Error.CommentNotFound()
        }
        const page = await WIKI.models.pages.query().select('path', 'localeCode').findById(cm.pageId).withGraphFetched('tags')
        if (!page || !WIKI.auth.checkAccess(context.req.user, ['manage:comments'], { path: page.path, locale: page.localeCode, tags: page.tags })) {
          throw new WIKI.Error.CommentManageForbidden()
        }
        await WIKI.models.comments.query().patch({ isApproved: true }).where('id', cm.id)
        return {
          responseResult: graphHelper.generateSuccess('Comment approved.')
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
