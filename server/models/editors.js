const Model = require('objection').Model
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * Editor model
 */
module.exports = class Editor extends Model {
  static get tableName() { return 'editors' }
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: {type: 'string'},
        isEnabled: {type: 'boolean'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config']
  }

  static async getEditors() {
    return WIKI.models.editors.query()
  }

  static async refreshEditorsFromDisk() {
    return commonHelper.refreshModulesFromDisk({
      dirName: 'editor',
      dataKey: 'editors',
      model: 'editors',
      label: 'editors',
      references: [
        { table: 'pages', column: 'editorKey' },
        { table: 'pageHistory', column: 'editorKey' },
        { table: 'users', column: 'defaultEditor' }
      ]
    })
  }

  static async getDefaultEditor(contentType) {
    // TODO - hardcoded for now
    switch (contentType) {
      case 'markdown':
        return 'markdown'
      case 'html':
        return 'ckeditor'
      case 'asciidoc':
        return 'asciidoc'
      default:
        return 'code'
    }
  }
}
