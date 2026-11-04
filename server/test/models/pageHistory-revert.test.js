const errors = require('../../helpers/error')

describe('models/pageHistory revert', () => {
  let PageHistory
  const bot = 9
  const ann = 5
  const since = new Date('2026-08-01T00:00:00.000Z')
  const v = (id, authorId, versionDate) => ({ id, authorId, authorName: authorId === bot ? 'Review Bot' : 'Ann', versionDate })

  beforeAll(() => {
    global.WIKI = {
      Error: errors,
      models: {
        pages: { updatePage: jest.fn(async () => ({})) }
      }
    }
    PageHistory = require('../../models/pageHistory')
    global.WIKI.models.pageHistory = PageHistory
  })

  afterAll(() => {
    delete global.WIKI
  })

  describe('planRevert', () => {
    it('reverts to the last state before the date', () => {
      const plan = PageHistory.planRevert({
        page: { authorId: bot, authorName: 'Review Bot', updatedAt: '2026-08-03T00:00:00.000Z' },
        versions: [v(1, ann, '2026-03-01T00:00:00.000Z'), v(2, ann, '2026-07-15T00:00:00.000Z'), v(3, bot, '2026-08-02T00:00:00.000Z')],
        authorId: bot,
        since
      })
      expect(plan.status).toBe('revert')
      expect(plan.baseline.versionId).toBe(2)
      expect(plan.changes).toBe(2)
      expect(plan.otherAuthors).toEqual([])
    })

    it('flags pages that others edited after the date', () => {
      const args = {
        page: { authorId: ann, authorName: 'Ann', updatedAt: '2026-08-05T00:00:00.000Z' },
        versions: [v(1, ann, '2026-03-01T00:00:00.000Z'), v(2, bot, '2026-08-02T00:00:00.000Z')],
        authorId: bot,
        since
      }
      const plan = PageHistory.planRevert(args)
      expect(plan.status).toBe('conflict')
      expect(plan.otherAuthors).toEqual(['Ann'])
      expect(PageHistory.planRevert({ ...args, includeOthers: true }).status).toBe('revert')
    })

    it('does not touch pages created after the date or not changed by the user', () => {
      expect(PageHistory.planRevert({
        page: { authorId: bot, authorName: 'Review Bot', updatedAt: '2026-08-03T00:00:00.000Z' },
        versions: [v(1, bot, '2026-08-02T00:00:00.000Z')],
        authorId: bot,
        since
      }).status).toBe('created')
      expect(PageHistory.planRevert({
        page: { authorId: ann, authorName: 'Ann', updatedAt: '2026-08-03T00:00:00.000Z' },
        versions: [v(1, bot, '2026-03-01T00:00:00.000Z')],
        authorId: bot,
        since
      }).status).toBe('untouched')
    })
  })

  describe('restoreVersion', () => {
    it('restores the content but keeps the current location and tags', async () => {
      PageHistory.getVersion = async () => ({
        pageId: 3,
        path: 'old/location',
        locale: 'fr',
        title: 'Old title',
        description: 'Old description',
        content: '# Old\n',
        isPublished: 1,
        publishStartDate: '',
        publishEndDate: '',
        tags: []
      })
      const user = { id: ann }
      await PageHistory.restoreVersion({ pageId: 3, versionId: 2, user })
      const opts = global.WIKI.models.pages.updatePage.mock.calls[0][0]
      expect(opts).toEqual(expect.objectContaining({ id: 3, content: '# Old\n', title: 'Old title', isPublished: true, action: 'restored', user }))
      expect(opts).not.toHaveProperty('path')
      expect(opts).not.toHaveProperty('locale')
      expect(opts).not.toHaveProperty('tags')
    })
  })
})
