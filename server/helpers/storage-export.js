const _ = require('lodash')
const { pipeline } = require('node:stream/promises')
const { Transform } = require('node:stream')

/* global WIKI */

/**
 * Create an object-mode transform running an async handler per item
 *
 * @param {Function} handler Async function called for each streamed row
 */
const eachRow = handler => new Transform({
  objectMode: true,
  transform: async (row, enc, cb) => {
    try {
      await handler(row)
      cb()
    } catch (err) {
      cb(err)
    }
  }
})

module.exports = {
  /**
   * Stream all public pages (with tags) and all assets from the DB,
   * used by the storage modules to export / dump the whole wiki.
   *
   * @param {Object} opts Options
   * @param {Function} opts.onPage Async handler receiving each page (ready for pageHelper.injectPageMetadata)
   * @param {Function} opts.onAsset Async handler receiving { filename, data } for each asset
   */
  async exportAll ({ onPage, onAsset }) {
    // -> Pages
    await pipeline(
      WIKI.models.knex.column('id', 'path', 'localeCode', 'title', 'description', 'contentType', 'content', 'isPublished', 'updatedAt', 'createdAt', 'editorKey').select().from('pages').where({
        isPrivate: false
      }).stream(),
      eachRow(async page => {
        const pageObject = await WIKI.models.pages.query().findById(page.id)
        page.tags = await pageObject.$relatedQuery('tags')
        await onPage(page)
      })
    )

    // -> Assets
    const assetFolders = await WIKI.models.assetFolders.getAllPaths()

    await pipeline(
      WIKI.models.knex.column('filename', 'folderId', 'data').select().from('assets').join('assetData', 'assets.id', '=', 'assetData.id').stream(),
      eachRow(async asset => {
        const filename = (asset.folderId && asset.folderId > 0) ? `${_.get(assetFolders, asset.folderId)}/${asset.filename}` : asset.filename
        await onAsset({ filename, data: asset.data })
      })
    )
  }
}
