const _ = require('lodash')
const sanitize = require('sanitize-filename')
const graphHelper = require('../../helpers/graph')
const assetHelper = require('../../helpers/asset')

/* global WIKI */

/**
 * Get the ids of a folder and all its descendants (deepest last)
 */
async function getFolderSubtreeIds (folderId) {
  const allFolders = await WIKI.models.assetFolders.query().select('id', 'parentId')
  const ids = [folderId]
  let queue = [folderId]
  while (queue.length > 0) {
    const currentId = queue.shift()
    for (const fld of allFolders) {
      if (fld.parentId === currentId) {
        ids.push(fld.id)
        queue.push(fld.id)
      }
    }
  }
  return ids
}

/**
 * Recompute hashes + flush cache + emit storage rename events for all assets
 * within the given folders, based on a pre-change path snapshot.
 *
 * @param {Object} oldFolderPaths Map of folderId -> path before the change
 * @param {Array} folderIds Folder ids to process
 * @param {Object} user Current user
 */
async function relocateFolderAssets (oldFolderPaths, folderIds, user) {
  const newFolderPaths = await WIKI.models.assetFolders.getAllPaths()
  const affectedAssets = await WIKI.models.assets.query().whereIn('folderId', folderIds)
  for (const asset of affectedAssets) {
    const sourcePath = `${_.get(oldFolderPaths, asset.folderId)}/${asset.filename}`
    const destinationPath = `${_.get(newFolderPaths, asset.folderId)}/${asset.filename}`
    if (sourcePath === destinationPath) {
      continue
    }
    await WIKI.models.assets.query().patch({
      hash: assetHelper.generateHash(destinationPath)
    }).findById(asset.id)
    await asset.deleteAssetCache()
    await WIKI.models.storage.assetEvent({
      event: 'renamed',
      asset: {
        ...asset,
        path: sourcePath,
        destinationPath,
        moveAuthorId: user.id,
        moveAuthorName: user.name,
        moveAuthorEmail: user.email
      }
    })
  }
}

module.exports = {
  Query: {
    async assets() { return {} }
  },
  Mutation: {
    async assets() { return {} }
  },
  AssetQuery: {
    async list(obj, args, context) {
      let cond = {
        folderId: args.folderId === 0 ? null : args.folderId
      }
      if (args.kind !== 'ALL') {
        cond.kind = args.kind.toLowerCase()
      }
      const folderHierarchy = await WIKI.models.assetFolders.getHierarchy(args.folderId)
      const folderPath = folderHierarchy.map(h => h.slug).join('/')
      const orderByColumn = ({
        FILENAME: 'filename',
        CREATED_AT: 'createdAt',
        UPDATED_AT: 'updatedAt',
        FILESIZE: 'fileSize'
      })[args.orderBy] || 'filename'
      const orderByDirection = args.orderByDirection === 'DESC' ? 'desc' : 'asc'
      const results = await WIKI.models.assets.query().where(cond).orderBy(orderByColumn, orderByDirection)
      return _.filter(results, r => {
        const path = folderPath ? `${folderPath}/${r.filename}` : r.filename
        return WIKI.auth.checkAccess(context.req.user, ['read:assets'], { path })
      }).map(a => ({
        ...a,
        kind: a.kind.toUpperCase()
      }))
    },
    async folders(obj, args, context) {
      const results = await WIKI.models.assetFolders.query().where({
        parentId: args.parentFolderId === 0 ? null : args.parentFolderId
      })
      const parentHierarchy = await WIKI.models.assetFolders.getHierarchy(args.parentFolderId)
      const parentPath = parentHierarchy.map(h => h.slug).join('/')
      return _.filter(results, r => {
        const path = parentPath ? `${parentPath}/${r.slug}` : r.slug
        return WIKI.auth.checkAccess(context.req.user, ['read:assets'], { path })
      })
    },
    async folderTree(obj, args, context) {
      const folders = await WIKI.models.assetFolders.query()
      const folderPaths = await WIKI.models.assetFolders.getAllPaths()
      return _.filter(folders, f => {
        return WIKI.auth.checkAccess(context.req.user, ['read:assets'], { path: _.get(folderPaths, f.id) })
      }).map(f => ({
        id: f.id,
        slug: f.slug,
        name: f.name,
        parentId: f.parentId || 0,
        path: _.get(folderPaths, f.id)
      }))
    }
  },
  AssetMutation: {
    /**
     * Create New Asset Folder
     */
    async createFolder(obj, args, context) {
      try {
        const folderSlug = sanitize(args.slug).toLowerCase()
        const parentFolderId = args.parentFolderId === 0 ? null : args.parentFolderId
        const result = await WIKI.models.assetFolders.query().where({
          parentId: parentFolderId,
          slug: folderSlug
        }).first()
        if (!result) {
          await WIKI.models.assetFolders.query().insert({
            slug: folderSlug,
            name: args.name || folderSlug,
            parentId: parentFolderId
          })
          return {
            responseResult: graphHelper.generateSuccess('Asset Folder has been created successfully.')
          }
        } else {
          throw new WIKI.Error.AssetFolderExists()
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Rename an Asset Folder
     */
    async renameFolder(obj, args, context) {
      try {
        const folder = await WIKI.models.assetFolders.query().findById(args.id)
        if (!folder) {
          throw new WIKI.Error.AssetFolderInvalid()
        }
        const folderSlug = sanitize(args.slug).toLowerCase()
        if (folderSlug.length < 1) {
          throw new WIKI.Error.AssetFolderInvalid()
        }

        // Check for collision
        if (folderSlug !== folder.slug) {
          const collision = await WIKI.models.assetFolders.query().where({
            parentId: folder.parentId,
            slug: folderSlug
          }).whereNot('id', folder.id).first()
          if (collision) {
            throw new WIKI.Error.AssetFolderExists()
          }
        }

        // Check permissions on old + new paths
        const oldFolderPaths = await WIKI.models.assetFolders.getAllPaths()
        const sourcePath = _.get(oldFolderPaths, folder.id)
        const targetPath = folder.parentId
          ? `${_.get(oldFolderPaths, folder.parentId)}/${folderSlug}`
          : folderSlug
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: sourcePath })) {
          throw new WIKI.Error.AssetRenameForbidden()
        }
        if (!WIKI.auth.checkAccess(context.req.user, ['write:assets'], { path: targetPath })) {
          throw new WIKI.Error.AssetRenameTargetForbidden()
        }

        const subtreeIds = await getFolderSubtreeIds(folder.id)

        await WIKI.models.assetFolders.query().patch({
          slug: folderSlug,
          name: args.name || folderSlug
        }).findById(folder.id)

        await relocateFolderAssets(oldFolderPaths, subtreeIds, context.req.user)

        return {
          responseResult: graphHelper.generateSuccess('Asset Folder has been renamed successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Move an Asset Folder
     */
    async moveFolder(obj, args, context) {
      try {
        const folder = await WIKI.models.assetFolders.query().findById(args.id)
        if (!folder) {
          throw new WIKI.Error.AssetFolderInvalid()
        }
        const targetParentId = args.parentFolderId === 0 ? null : args.parentFolderId
        if ((folder.parentId || null) === targetParentId) {
          throw new WIKI.Error.AssetFolderMoveInvalid()
        }

        const subtreeIds = await getFolderSubtreeIds(folder.id)
        if (targetParentId) {
          // -> Cannot move into itself or its own subtree
          if (_.includes(subtreeIds, targetParentId)) {
            throw new WIKI.Error.AssetFolderMoveInvalid()
          }
          const targetParent = await WIKI.models.assetFolders.query().findById(targetParentId)
          if (!targetParent) {
            throw new WIKI.Error.AssetFolderInvalid()
          }
        }

        // Check for collision
        const collision = await WIKI.models.assetFolders.query().where({
          parentId: targetParentId,
          slug: folder.slug
        }).first()
        if (collision) {
          throw new WIKI.Error.AssetFolderExists()
        }

        // Check permissions on old + new paths
        const oldFolderPaths = await WIKI.models.assetFolders.getAllPaths()
        const sourcePath = _.get(oldFolderPaths, folder.id)
        const targetPath = targetParentId
          ? `${_.get(oldFolderPaths, targetParentId)}/${folder.slug}`
          : folder.slug
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: sourcePath })) {
          throw new WIKI.Error.AssetRenameForbidden()
        }
        if (!WIKI.auth.checkAccess(context.req.user, ['write:assets'], { path: targetPath })) {
          throw new WIKI.Error.AssetRenameTargetForbidden()
        }

        await WIKI.models.assetFolders.query().patch({
          parentId: targetParentId
        }).findById(folder.id)

        await relocateFolderAssets(oldFolderPaths, subtreeIds, context.req.user)

        return {
          responseResult: graphHelper.generateSuccess('Asset Folder has been moved successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Delete an Asset Folder
     */
    async deleteFolder(obj, args, context) {
      try {
        const folder = await WIKI.models.assetFolders.query().findById(args.id)
        if (!folder) {
          throw new WIKI.Error.AssetFolderInvalid()
        }
        const folderPaths = await WIKI.models.assetFolders.getAllPaths()
        const folderPath = _.get(folderPaths, folder.id)
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: folderPath })) {
          throw new WIKI.Error.AssetDeleteForbidden()
        }

        const subtreeIds = await getFolderSubtreeIds(folder.id)
        const containedAssets = await WIKI.models.assets.query().whereIn('folderId', subtreeIds)

        if (!args.deleteContents && (containedAssets.length > 0 || subtreeIds.length > 1)) {
          throw new WIKI.Error.AssetFolderNotEmpty()
        }

        // Check permissions on every contained asset
        const deleteEvents = []
        for (const asset of containedAssets) {
          const assetPath = `${_.get(folderPaths, asset.folderId)}/${asset.filename}`
          if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: assetPath })) {
            throw new WIKI.Error.AssetDeleteForbidden()
          }
          deleteEvents.push({
            asset,
            path: assetPath
          })
        }

        // Delete rows in a single transaction (children first)
        await WIKI.models.knex.transaction(async trx => {
          const assetIds = containedAssets.map(a => a.id)
          if (assetIds.length > 0) {
            await trx('assetData').whereIn('id', assetIds).del()
            await trx('assets').whereIn('id', assetIds).del()
          }
          for (const folderId of _.reverse([...subtreeIds])) {
            await trx('assetFolders').where('id', folderId).del()
          }
        })

        // External side effects after commit
        for (const evt of deleteEvents) {
          await evt.asset.deleteAssetCache()
          await WIKI.models.storage.assetEvent({
            event: 'deleted',
            asset: {
              ...evt.asset,
              path: evt.path,
              authorId: context.req.user.id,
              authorName: context.req.user.name,
              authorEmail: context.req.user.email
            }
          })
        }

        return {
          responseResult: graphHelper.generateSuccess('Asset Folder has been deleted successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Rename an Asset
     */
    async renameAsset(obj, args, context) {
      try {
        const filename = sanitize(args.filename).toLowerCase()

        const asset = await WIKI.models.assets.query().findById(args.id)
        if (asset) {
          // Check for extension mismatch
          if (!_.endsWith(filename, asset.ext)) {
            throw new WIKI.Error.AssetRenameInvalidExt()
          }

          // Check for non-dot files changing to dotfile
          if (asset.ext.length > 0 && filename.length - asset.ext.length < 1) {
            throw new WIKI.Error.AssetRenameInvalid()
          }

          // Check for collision
          const assetCollision = await WIKI.models.assets.query().where({
            filename,
            folderId: asset.folderId
          }).first()
          if (assetCollision) {
            throw new WIKI.Error.AssetRenameCollision()
          }

          // Get asset folder path
          let hierarchy = []
          if (asset.folderId) {
            hierarchy = await WIKI.models.assetFolders.getHierarchy(asset.folderId)
          }

          // Check source asset permissions
          const assetSourcePath = (asset.folderId) ? hierarchy.map(h => h.slug).join('/') + `/${asset.filename}` : asset.filename
          if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: assetSourcePath })) {
            throw new WIKI.Error.AssetRenameForbidden()
          }

          // Check target asset permissions
          const assetTargetPath = (asset.folderId) ? hierarchy.map(h => h.slug).join('/') + `/${filename}` : filename
          if (!WIKI.auth.checkAccess(context.req.user, ['write:assets'], { path: assetTargetPath })) {
            throw new WIKI.Error.AssetRenameTargetForbidden()
          }

          // Update filename + hash
          const fileHash = assetHelper.generateHash(assetTargetPath)
          await WIKI.models.assets.query().patch({
            filename: filename,
            hash: fileHash
          }).findById(args.id)

          // Delete old asset cache
          await asset.deleteAssetCache()

          // Rename in Storage
          await WIKI.models.storage.assetEvent({
            event: 'renamed',
            asset: {
              ...asset,
              path: assetSourcePath,
              destinationPath: assetTargetPath,
              moveAuthorId: context.req.user.id,
              moveAuthorName: context.req.user.name,
              moveAuthorEmail: context.req.user.email
            }
          })

          return {
            responseResult: graphHelper.generateSuccess('Asset has been renamed successfully.')
          }
        } else {
          throw new WIKI.Error.AssetInvalid()
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Move an Asset to another folder
     */
    async moveAsset(obj, args, context) {
      try {
        const asset = await WIKI.models.assets.query().findById(args.id)
        if (!asset) {
          throw new WIKI.Error.AssetInvalid()
        }
        const targetFolderId = args.folderId === 0 ? null : args.folderId
        if ((asset.folderId || null) === targetFolderId) {
          throw new WIKI.Error.AssetFolderMoveInvalid()
        }
        if (targetFolderId) {
          const targetFolder = await WIKI.models.assetFolders.query().findById(targetFolderId)
          if (!targetFolder) {
            throw new WIKI.Error.AssetFolderInvalid()
          }
        }

        // Check for collision
        const assetCollision = await WIKI.models.assets.query().where({
          filename: asset.filename,
          folderId: targetFolderId
        }).first()
        if (assetCollision) {
          throw new WIKI.Error.AssetRenameCollision()
        }

        // Compute source + target paths
        const assetSourcePath = await asset.getAssetPath()
        let targetHierarchy = []
        if (targetFolderId) {
          targetHierarchy = await WIKI.models.assetFolders.getHierarchy(targetFolderId)
        }
        const assetTargetPath = targetFolderId ? targetHierarchy.map(h => h.slug).join('/') + `/${asset.filename}` : asset.filename

        // Check permissions
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: assetSourcePath })) {
          throw new WIKI.Error.AssetRenameForbidden()
        }
        if (!WIKI.auth.checkAccess(context.req.user, ['write:assets'], { path: assetTargetPath })) {
          throw new WIKI.Error.AssetRenameTargetForbidden()
        }

        // Update folder + hash
        await WIKI.models.assets.query().patch({
          folderId: targetFolderId,
          hash: assetHelper.generateHash(assetTargetPath)
        }).findById(args.id)

        // Delete old asset cache
        await asset.deleteAssetCache()

        // Move in Storage (reuses the rename event, which handles full paths)
        await WIKI.models.storage.assetEvent({
          event: 'renamed',
          asset: {
            ...asset,
            path: assetSourcePath,
            destinationPath: assetTargetPath,
            moveAuthorId: context.req.user.id,
            moveAuthorName: context.req.user.name,
            moveAuthorEmail: context.req.user.email
          }
        })

        return {
          responseResult: graphHelper.generateSuccess('Asset has been moved successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Delete an Asset
     */
    async deleteAsset(obj, args, context) {
      try {
        const asset = await WIKI.models.assets.query().findById(args.id)
        if (asset) {
          // Check permissions
          const assetPath = await asset.getAssetPath()
          if (!WIKI.auth.checkAccess(context.req.user, ['manage:assets'], { path: assetPath })) {
            throw new WIKI.Error.AssetDeleteForbidden()
          }

          await WIKI.models.knex('assetData').where('id', args.id).del()
          await WIKI.models.assets.query().deleteById(args.id)
          await asset.deleteAssetCache()

          // Delete from Storage
          await WIKI.models.storage.assetEvent({
            event: 'deleted',
            asset: {
              ...asset,
              path: assetPath,
              authorId: context.req.user.id,
              authorName: context.req.user.name,
              authorEmail: context.req.user.email
            }
          })

          return {
            responseResult: graphHelper.generateSuccess('Asset has been deleted successfully.')
          }
        } else {
          throw new WIKI.Error.AssetInvalid()
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    /**
     * Flush Temporary Uploads
     */
    async flushTempUploads(obj, args, context) {
      try {
        await WIKI.models.assets.flushTempUploads()
        return {
          responseResult: graphHelper.generateSuccess('Temporary Uploads have been flushed successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
