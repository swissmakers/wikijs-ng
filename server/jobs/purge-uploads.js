/* global WIKI */

const fs = require('fs-extra')
const path = require('path')

const MAX_AGE = 15 * 60 * 1000 // 15 minutes

module.exports = async () => {
  WIKI.logger.info('Purging orphaned upload files...')

  try {
    const uplTempPath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads')
    await fs.ensureDir(uplTempPath)
    const cutoff = Date.now() - MAX_AGE

    for (const filename of await fs.readdir(uplTempPath)) {
      const filePath = path.join(uplTempPath, filename)
      const stat = await fs.stat(filePath)
      if (stat.isFile() && stat.ctimeMs < cutoff) {
        await fs.unlink(filePath)
      }
    }

    WIKI.logger.info('Purging orphaned upload files: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Purging orphaned upload files: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
