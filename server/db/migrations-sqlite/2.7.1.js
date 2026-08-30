exports.up = async knex => {
  await knex.schema.createTable('pageDrafts', table => {
    table.increments('id').primary()
    table.integer('pageId').unsigned().nullable()
    table.string('path').notNullable()
    table.string('localeCode', 10).notNullable()
    table.string('title').nullable()
    table.string('description').nullable()
    table.text('content', 'longtext').nullable()
    table.string('editorKey').notNullable()
    table.integer('authorId').unsigned().references('id').inTable('users')
    table.string('createdAt').notNullable()
    table.string('updatedAt').notNullable()
    table.unique(['authorId', 'path', 'localeCode'])
  })
}

exports.down = async knex => {
  await knex.schema.dropTableIfExists('pageDrafts')
}
