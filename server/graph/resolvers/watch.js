const _ = require('lodash')
const graphHelper = require('../../helpers/graph')
const notifications = require('../../helpers/notifications')

/* global WIKI */

/**
 * Load a page the user may read
 */
const loadReadablePage = async (pageId, user) => {
  const page = await WIKI.models.pages.query().select('id', 'path', 'localeCode', 'title', 'description').findById(pageId).withGraphFetched('tags')
  if (!page) {
    throw new WIKI.Error.PageNotFound()
  }
  if (!WIKI.auth.checkAccess(user, ['read:pages'], { path: page.path, locale: page.localeCode, tags: page.tags })) {
    throw new WIKI.Error.PageViewForbidden()
  }
  return page
}

const success = msg => ({ responseResult: graphHelper.generateSuccess(msg) })

module.exports = {
  Query: {
    async watches () { return {} },
    async bookmarks () { return {} }
  },
  Mutation: {
    async watches () { return {} },
    async bookmarks () { return {} }
  },
  WatchQuery: {
    async list (obj, args, context) {
      const user = graphHelper.assertAuthenticated(context)
      const watches = await WIKI.models.userWatches.query().where('userId', user.id).orderBy('createdAt', 'desc')
      const pages = _.keyBy(await WIKI.models.pages.query()
        .select('id', 'title', 'path', 'localeCode')
        .whereIn('id', _.map(_.filter(watches, ['kind', 'page']), 'pageId')), 'id')
      return watches.map(w => {
        const page = w.kind === 'page' ? pages[w.pageId] : null
        return {
          id: w.id,
          kind: w.kind,
          pageId: w.pageId,
          locale: page ? page.localeCode : w.localeCode,
          path: page ? page.path : w.path,
          title: page ? page.title : null,
          createdAt: w.createdAt
        }
      })
    },
    async status (obj, args, context) {
      const user = graphHelper.assertAuthenticated(context)
      const page = await loadReadablePage(args.pageId, user)
      const watches = await WIKI.models.userWatches.query().where('userId', user.id)
      const pageWatch = _.find(watches, w => w.kind === 'page' && w.pageId === page.id)
      const pathWatch = _.find(watches, w => w.kind === 'path' && w.localeCode === page.localeCode && w.path === page.path)
      const covering = _.find(watches, w => w !== pathWatch && w.kind === 'path' && notifications.matchesWatch(w, { localeCode: page.localeCode, path: page.path }))
      return {
        pageWatchId: pageWatch ? pageWatch.id : 0,
        pathWatchId: pathWatch ? pathWatch.id : 0,
        coveringPath: covering ? `/${covering.path}` : null
      }
    }
  },
  WatchMutation: {
    async watchPage (obj, args, context) {
      try {
        const user = graphHelper.assertAuthenticated(context)
        const page = await loadReadablePage(args.pageId, user)
        const exists = await WIKI.models.userWatches.query().findOne({ userId: user.id, kind: 'page', pageId: page.id })
        if (!exists) {
          await WIKI.models.userWatches.query().insert({ userId: user.id, kind: 'page', pageId: page.id, localeCode: '', path: '' })
        }
        return success('Page watched.')
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async watchPath (obj, args, context) {
      try {
        const user = graphHelper.assertAuthenticated(context)
        const path = _.trim(args.path, '/ ')
        if (path.length > 255 || !_.some(await WIKI.models.locales.query().select('code'), ['code', args.locale])) {
          throw new WIKI.Error.InputInvalid()
        }
        if (!WIKI.auth.checkAccess(user, ['read:pages'], { path, locale: args.locale })) {
          throw new WIKI.Error.PageViewForbidden()
        }
        const exists = await WIKI.models.userWatches.query().findOne({ userId: user.id, kind: 'path', pageId: 0, localeCode: args.locale, path })
        if (!exists) {
          await WIKI.models.userWatches.query().insert({ userId: user.id, kind: 'path', pageId: 0, localeCode: args.locale, path })
        }
        return success('Folder watched.')
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async remove (obj, args, context) {
      try {
        const user = graphHelper.assertAuthenticated(context)
        await WIKI.models.userWatches.query().delete().where({ id: args.id, userId: user.id })
        return success('Watch removed.')
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  BookmarkQuery: {
    async list (obj, args, context) {
      const user = graphHelper.assertAuthenticated(context)
      const bookmarks = await WIKI.models.knex('userBookmarks')
        .join('pages', 'userBookmarks.pageId', 'pages.id')
        .select('userBookmarks.id', 'userBookmarks.pageId', 'userBookmarks.createdAt', 'pages.path', 'pages.localeCode', 'pages.title', 'pages.description')
        .where('userBookmarks.userId', user.id)
        .orderBy('pages.title')
      return bookmarks
        .filter(b => WIKI.auth.checkAccess(user, ['read:pages'], { path: b.path, locale: b.localeCode }))
        .map(b => ({ ...b, locale: b.localeCode }))
    },
    async isBookmarked (obj, args, context) {
      const user = graphHelper.assertAuthenticated(context)
      return Boolean(await WIKI.models.userBookmarks.query().findOne({ userId: user.id, pageId: args.pageId }))
    }
  },
  BookmarkMutation: {
    async toggle (obj, args, context) {
      try {
        const user = graphHelper.assertAuthenticated(context)
        const page = await loadReadablePage(args.pageId, user)
        const existing = await WIKI.models.userBookmarks.query().findOne({ userId: user.id, pageId: page.id })
        if (existing) {
          await WIKI.models.userBookmarks.query().deleteById(existing.id)
        } else {
          await WIKI.models.userBookmarks.query().insert({ userId: user.id, pageId: page.id })
        }
        return {
          responseResult: graphHelper.generateSuccess(existing ? 'Bookmark removed.' : 'Page bookmarked.'),
          isBookmarked: !existing
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
