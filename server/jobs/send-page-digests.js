const _ = require('lodash')
const crypto = require('crypto')
const notifications = require('../helpers/notifications')

/* global WIKI */

const ACTIVITY_RETENTION_DAYS = 180

module.exports = async () => {
  if (WIKI.config.features.featureNotifications === false) {
    return
  }

  try {
    // -> Claim pending events (each event is processed by exactly one instance)
    const claim = crypto.randomUUID()
    const claimed = await WIKI.models.knex('pageActivity').whereNull('notifyClaim').update({ notifyClaim: claim })
    if (claimed > 0) {
      const events = (await WIKI.models.pageActivity.query().where('notifyClaim', claim).orderBy('id')).filter(e => !e.isSync)
      if (events.length > 0 && !WIKI.mail.transport) {
        WIKI.logger.warn('Page change notifications are not sent: mail is not configured.')
      } else if (events.length > 0) {
        await sendDigests(events)
      }
    }

    // -> Cleanup: watches of deleted pages, old activity
    const deletedPageIds = _.map(await WIKI.models.knex('userWatches')
      .select('userWatches.pageId')
      .leftJoin('pages', 'userWatches.pageId', 'pages.id')
      .where('userWatches.kind', 'page')
      .whereNull('pages.id'), 'pageId')
    if (deletedPageIds.length > 0) {
      await WIKI.models.userWatches.query().delete().where('kind', 'page').whereIn('pageId', _.uniq(deletedPageIds))
    }
    const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    await WIKI.models.pageActivity.query().delete().where('createdAt', '<', cutoff)
  } catch (err) {
    WIKI.logger.warn(`Failed to send page change notifications: ${err.message}`)
  }
}

async function sendDigests (events) {
  const watches = await WIKI.models.userWatches.query()
  if (watches.length < 1) {
    return
  }
  const users = await WIKI.models.users.query()
    .whereIn('id', _.uniq(_.map(watches, 'userId')))
    .where('isActive', true)
    .withGraphFetched('groups')
    .modifyGraph('groups', builder => {
      builder.select('groups.id', 'permissions')
    })
  const pagesTags = _.keyBy(await WIKI.models.pages.query()
    .select('id')
    .whereIn('id', _.uniq(_.map(events, 'pageId')))
    .withGraphFetched('tags'), 'id')
  const pageUrl = (locale, path) => WIKI.config.lang.namespacing ? `/${locale}/${path}` : `/${path}`

  let sent = 0
  for (const user of users) {
    const userWatches = _.filter(watches, ['userId', user.id])
    const userEvents = events.filter(e =>
      e.authorId !== user.id &&
      userWatches.some(w => notifications.matchesWatch(w, e)) &&
      notifications.canSeeEvent(user, e, _.get(pagesTags, [e.pageId, 'tags'], []))
    )
    if (userEvents.length < 1) {
      continue
    }
    const lng = user.localeCode || WIKI.config.lang.code
    const t = (key, opts = {}) => WIKI.lang.engine.t(key, { lng, ...opts })
    const digest = notifications.buildDigest(userEvents)
    const { html, text } = notifications.renderDigest(digest, { host: WIKI.config.host, t, pageUrl })
    const title = t('common:notifications.digestTitle', { count: digest.length, defaultValue: '{{count}} watched page(s) changed' })
    try {
      await WIKI.mail.send({
        template: 'pageChanges',
        to: user.email,
        subject: title,
        data: {
          preheadertext: title,
          title,
          content: html,
          buttonLink: `${WIKI.config.host}/p/watches`,
          buttonText: t('common:notifications.manageWatches', { defaultValue: 'Manage watched pages' })
        },
        text: `${title}\n\n${text}\n\n${WIKI.config.host}/p/watches`
      })
      sent++
    } catch (err) {
      WIKI.logger.warn(`Failed to send page change notification to ${user.email}: ${err.message}`)
    }
  }
  if (sent > 0) {
    WIKI.logger.info(`Sent ${sent} page change notification(s).`)
  }
}
