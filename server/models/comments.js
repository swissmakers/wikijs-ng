const Model = require('objection').Model
const validate = require('validate.js')
const _ = require('lodash')

/* global WIKI */

/**
 * Comments model
 */
module.exports = class Comment extends Model {
  static get tableName() { return 'comments' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: [],

      properties: {
        id: {type: 'integer'},
        content: {type: 'string'},
        render: {type: 'string'},
        name: {type: 'string'},
        email: {type: 'string'},
        ip: {type: 'string'},
        isApproved: {type: 'boolean'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'comments.authorId',
          to: 'users.id'
        }
      },
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'comments.pageId',
          to: 'pages.id'
        }
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  /**
   * Post New Comment
   */
  static async postNewComment ({ pageId, replyTo, content, guestName, guestEmail, user, ip }) {
    // -> Input validation
    if (user.id === 2) {
      const validation = validate({
        email: _.toLower(guestEmail),
        name: guestName
      }, {
        email: {
          email: true,
          length: {
            maximum: 255
          }
        },
        name: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 2,
            maximum: 255
          }
        }
      }, { format: 'flat' })

      if (validation && validation.length > 0) {
        throw new WIKI.Error.InputInvalid(validation[0])
      }
    }

    content = _.trim(content)
    if (content.length < 2) {
      throw new WIKI.Error.CommentContentMissing()
    }

    // -> Load Page
    const page = await WIKI.models.pages.getPageFromDb(pageId)
    if (page) {
      if (!WIKI.auth.checkAccess(user, ['write:comments'], {
        path: page.path,
        locale: page.localeCode,
        tags: page.tags
      })) {
        throw new WIKI.Error.CommentPostForbidden()
      }
    } else {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Comments can be turned off per page
    if (_.get(page, 'extra.commentsDisabled', false) === true) {
      throw new WIKI.Error.CommentPostForbidden()
    }

    // -> Replies must target a comment of the same page; threads are kept to one level
    replyTo = _.toSafeInteger(replyTo)
    if (replyTo > 0) {
      const parent = await WIKI.data.commentProvider.getCommentById(replyTo)
      if (!parent || parent.pageId !== page.id) {
        throw new WIKI.Error.InputInvalid('Invalid comment to reply to.')
      }
      replyTo = parent.replyTo > 0 ? parent.replyTo : parent.id
    }

    // -> Process by comment provider
    return WIKI.data.commentProvider.create({
      page,
      replyTo,
      content,
      user: {
        ...user,
        ...(user.id === 2) ? {
          name: guestName,
          email: guestEmail
        } : {},
        ip
      }
    })
  }

  /**
   * Load the page of a comment and check that the user may change the comment:
   * moderators (manage:comments) may change any comment, authors their own.
   */
  static async getPageForCommentChange ({ id, user }) {
    const pageId = await WIKI.data.commentProvider.getPageIdFromCommentId(id)
    if (!pageId) {
      throw new WIKI.Error.CommentNotFound()
    }
    const page = await WIKI.models.pages.getPageFromDb(pageId)
    if (!page) {
      throw new WIKI.Error.PageNotFound()
    }
    const pageCtx = {
      path: page.path,
      locale: page.localeCode,
      tags: page.tags
    }
    if (WIKI.auth.checkAccess(user, ['manage:comments'], pageCtx)) {
      return page
    }
    if (user && user.id !== 2 && WIKI.auth.checkAccess(user, ['write:comments'], pageCtx)) {
      const comment = await WIKI.data.commentProvider.getCommentById(id)
      if (comment && comment.authorId === user.id) {
        return page
      }
    }
    throw new WIKI.Error.CommentManageForbidden()
  }

  /**
   * Update an Existing Comment
   */
  static async updateComment ({ id, content, user, ip }) {
    const page = await WIKI.models.comments.getPageForCommentChange({ id, user })

    // -> Process by comment provider
    return WIKI.data.commentProvider.update({
      id,
      content,
      page,
      user: {
        ...user,
        ip
      }
    })
  }

  /**
   * Delete an Existing Comment
   */
  static async deleteComment ({ id, user, ip }) {
    const page = await WIKI.models.comments.getPageForCommentChange({ id, user })

    // -> Process by comment provider
    await WIKI.data.commentProvider.remove({
      id,
      page,
      user: {
        ...user,
        ip
      }
    })
  }
}
