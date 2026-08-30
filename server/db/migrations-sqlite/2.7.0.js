exports.up = async knex => {
  await knex.schema
    .alterTable('assetFolders', table => {
      table.unique(['parentId', 'slug'])
    })
    .alterTable('assets', table => {
      table.index(['folderId', 'filename'])
    })
}

exports.down = async knex => {
  await knex.schema
    .alterTable('assetFolders', table => {
      table.dropUnique(['parentId', 'slug'])
    })
    .alterTable('assets', table => {
      table.dropIndex(['folderId', 'filename'])
    })
}
