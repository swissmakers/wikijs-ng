/* global WIKI */

exports.up = async knex => {
  // -> MySQL / MariaDB: page titles and paths may contain emoji, independent of the database default charset
  const dbCompat = {
    charset: (WIKI.config.db.type === 'mysql' || WIKI.config.db.type === 'mariadb')
  }

  // -> Page activity log (recent changes, RSS, watch notifications)
  await knex.schema.createTable('pageActivity', table => {
    if (dbCompat.charset) { table.charset('utf8mb4') }
    table.increments('id').primary()
    table.integer('pageId').unsigned().notNullable()
    table.string('localeCode', 10).notNullable()
    table.string('path', 255).notNullable()
    table.string('title', 255).notNullable().defaultTo('')
    table.string('action', 20).notNullable()
    table.string('previousPath', 255).nullable()
    table.string('previousLocaleCode', 10).nullable()
    table.integer('authorId').unsigned().nullable()
    table.string('authorName', 255).notNullable().defaultTo('')
    table.boolean('isPublished').notNullable().defaultTo(true)
    table.boolean('isTemplate').notNullable().defaultTo(false)
    table.boolean('isSync').notNullable().defaultTo(false)
    table.string('notifyClaim', 40).nullable()
    table.string('createdAt').notNullable()
    table.index(['createdAt'])
    table.index(['localeCode', 'path'])
    table.index(['pageId'])
    table.index(['notifyClaim'])
  })

  // -> Pages / folders watched by users
  await knex.schema.createTable('userWatches', table => {
    if (dbCompat.charset) { table.charset('utf8mb4') }
    table.increments('id').primary()
    table.integer('userId').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('kind', 10).notNullable()
    table.integer('pageId').unsigned().notNullable().defaultTo(0)
    table.string('localeCode', 10).notNullable().defaultTo('')
    table.string('path', 255).notNullable().defaultTo('')
    table.string('createdAt').notNullable()
    table.unique(['userId', 'kind', 'pageId', 'localeCode', 'path'])
    table.index(['userId'])
  })

  // -> Bookmarked pages
  await knex.schema.createTable('userBookmarks', table => {
    if (dbCompat.charset) { table.charset('utf8mb4') }
    table.increments('id').primary()
    table.integer('userId').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.integer('pageId').unsigned().notNullable()
    table.string('createdAt').notNullable()
    table.unique(['userId', 'pageId'])
  })

  // -> Seed the activity log with the latest changes (marked as already notified)
  const pages = await knex('pages')
    .leftJoin('users', 'pages.authorId', 'users.id')
    .select('pages.id', 'pages.localeCode', 'pages.path', 'pages.title', 'pages.authorId', 'pages.isPublished', 'pages.isTemplate', 'pages.updatedAt', 'users.name as authorName')
    .orderBy('pages.updatedAt', 'desc')
    .limit(500)
  for (const page of pages) {
    await knex('pageActivity').insert({
      pageId: page.id,
      localeCode: page.localeCode,
      path: page.path,
      title: page.title || '',
      action: 'updated',
      authorId: page.authorId,
      authorName: page.authorName || '',
      isPublished: Boolean(page.isPublished),
      isTemplate: Boolean(page.isTemplate),
      isSync: false,
      notifyClaim: 'seed',
      createdAt: page.updatedAt
    })
  }
}

exports.down = async knex => {
  await knex.schema.dropTableIfExists('userBookmarks')
  await knex.schema.dropTableIfExists('userWatches')
  await knex.schema.dropTableIfExists('pageActivity')
}
