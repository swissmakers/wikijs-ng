const { S3Client, HeadBucketCommand, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3')
const _ = require('lodash')
const pageHelper = require('../../../helpers/page.js')
const storageExport = require('../../../helpers/storage-export')

/* global WIKI */

/**
 * Deduce the file path given the `page` object and the object's key to the page's path.
 */
const getFilePath = (page, pathKey) => {
  const fileName = `${page[pathKey]}.${pageHelper.getFileExtension(page.contentType)}`
  const withLocaleCode = WIKI.config.lang.namespacing && WIKI.config.lang.code !== page.localeCode
  return withLocaleCode ? `${page.localeCode}/${fileName}` : fileName
}

/**
 * Can be used with S3 compatible storage.
 */
module.exports = class S3CompatibleStorage {
  constructor (storageName) {
    this.storageName = storageName
    this.bucketName = ''
  }

  async init () {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Initializing...`)
    const { accessKeyId, secretAccessKey, bucket } = this.config
    const s3Config = {
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      region: !_.isNil(this.config.region) ? this.config.region : 'us-east-1'
    }

    if (!_.isNil(this.config.endpoint)) {
      s3Config.endpoint = this.config.endpoint
    }
    if (!_.isNil(this.config.sslEnabled)) {
      s3Config.tls = this.config.sslEnabled
    }
    if (!_.isNil(this.config.s3ForcePathStyle)) {
      s3Config.forcePathStyle = this.config.s3ForcePathStyle
    }
    if (!_.isNil(this.config.s3BucketEndpoint)) {
      s3Config.bucketEndpoint = this.config.s3BucketEndpoint
    }

    this.s3 = new S3Client(s3Config)
    this.bucketName = bucket

    // determine if a bucket exists and you have permission to access it
    await this.s3.send(new HeadBucketCommand({ Bucket: this.bucketName }))

    WIKI.logger.info(`(STORAGE/${this.storageName}) Initialization completed.`)
  }

  async created (page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Creating file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucketName, Key: filePath, Body: page.injectMetadata() }))
  }

  async updated (page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Updating file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucketName, Key: filePath, Body: page.injectMetadata() }))
  }

  async deleted (page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Deleting file ${page.path}...`)
    const filePath = getFilePath(page, 'path')
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: filePath }))
  }

  async renamed (page) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Renaming file ${page.path} to ${page.destinationPath}...`)
    let sourceFilePath = getFilePath(page, 'path')
    let destinationFilePath = getFilePath(page, 'destinationPath')
    if (WIKI.config.lang.namespacing) {
      if (WIKI.config.lang.code !== page.localeCode) {
        sourceFilePath = `${page.localeCode}/${sourceFilePath}`
      }
      if (WIKI.config.lang.code !== page.destinationLocaleCode) {
        destinationFilePath = `${page.destinationLocaleCode}/${destinationFilePath}`
      }
    }
    await this.s3.send(new CopyObjectCommand({ Bucket: this.bucketName, CopySource: `${this.bucketName}/${sourceFilePath}`, Key: destinationFilePath }))
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: sourceFilePath }))
  }

  /**
   * ASSET UPLOAD
   *
   * @param {Object} asset Asset to upload
   */
  async assetUploaded (asset) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Creating new file ${asset.path}...`)
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucketName, Key: asset.path, Body: asset.data }))
  }

  /**
   * ASSET DELETE
   *
   * @param {Object} asset Asset to delete
   */
  async assetDeleted (asset) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Deleting file ${asset.path}...`)
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: asset.path }))
  }

  /**
   * ASSET RENAME
   *
   * @param {Object} asset Asset to rename
   */
  async assetRenamed (asset) {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Renaming file from ${asset.path} to ${asset.destinationPath}...`)
    await this.s3.send(new CopyObjectCommand({ Bucket: this.bucketName, CopySource: `${this.bucketName}/${asset.path}`, Key: asset.destinationPath }))
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: asset.path }))
  }

  async getLocalLocation () {

  }

  /**
   * HANDLERS
   */
  async exportAll () {
    WIKI.logger.info(`(STORAGE/${this.storageName}) Exporting all content to the cloud provider...`)

    await storageExport.exportAll({
      onPage: async page => {
        const filePath = getFilePath(page, 'path')
        WIKI.logger.info(`(STORAGE/${this.storageName}) Adding page ${filePath}...`)
        await this.s3.send(new PutObjectCommand({ Bucket: this.bucketName, Key: filePath, Body: pageHelper.injectPageMetadata(page) }))
      },
      onAsset: async ({ filename, data }) => {
        WIKI.logger.info(`(STORAGE/${this.storageName}) Adding asset ${filename}...`)
        await this.s3.send(new PutObjectCommand({ Bucket: this.bucketName, Key: filename, Body: data }))
      }
    })

    WIKI.logger.info(`(STORAGE/${this.storageName}) All content has been pushed to the cloud provider.`)
  }
}
