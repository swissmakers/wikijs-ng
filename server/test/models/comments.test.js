const errors = require('../../helpers/error')

describe('models/comments/postNewComment', () => {
  let Comments
  let created
  const comments = {
    10: { id: 10, pageId: 1, replyTo: 0 },
    11: { id: 11, pageId: 1, replyTo: 10 },
    20: { id: 20, pageId: 2, replyTo: 0 }
  }
  const pages = {
    1: { id: 1, path: 'docs', localeCode: 'en', tags: [], extra: {} },
    3: { id: 3, path: 'quiet', localeCode: 'en', tags: [], extra: { commentsDisabled: true } }
  }
  const user = { id: 5, name: 'Ann', email: 'ann@example.com' }

  beforeAll(() => {
    global.WIKI = {
      Error: errors,
      auth: { checkAccess: (usr, perms, page) => page.path !== 'forbidden' },
      models: { pages: { getPageFromDb: async id => pages[id] || null } },
      data: {
        commentProvider: {
          getCommentById: async id => comments[id] || null,
          create: async opts => { created = opts; return 99 }
        }
      }
    }
    Comments = require('../../models/comments')
  })

  afterAll(() => {
    delete global.WIKI
  })

  const post = opts => Comments.postNewComment({ pageId: 1, content: 'Hello there', user, ip: '127.0.0.1', ...opts })

  it('attaches replies to the root comment of the thread', async () => {
    await post({ replyTo: 10 })
    expect(created.replyTo).toBe(10)
    await post({ replyTo: 11 })
    expect(created.replyTo).toBe(10)
    await post({})
    expect(created.replyTo).toBe(0)
  })

  it('rejects replies to comments of other pages or unknown comments', async () => {
    await expect(post({ replyTo: 20 })).rejects.toBeInstanceOf(errors.InputInvalid)
    await expect(post({ replyTo: 404 })).rejects.toBeInstanceOf(errors.InputInvalid)
  })

  it('rejects posts on pages with comments turned off', async () => {
    await expect(post({ pageId: 3 })).rejects.toBeInstanceOf(errors.CommentPostForbidden)
  })

  it('validates content and guest identity', async () => {
    await expect(post({ content: ' x ' })).rejects.toBeInstanceOf(errors.CommentContentMissing)
    await expect(post({ user: { id: 2 }, guestName: 'G', guestEmail: 'guest@example.com' })).rejects.toBeInstanceOf(errors.InputInvalid)
    await post({ user: { id: 2 }, guestName: 'Guest', guestEmail: 'guest@example.com' })
    expect(created.user).toMatchObject({ id: 2, name: 'Guest', email: 'guest@example.com', ip: '127.0.0.1' })
  })
})
