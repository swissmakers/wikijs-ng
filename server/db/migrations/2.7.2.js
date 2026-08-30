exports.up = async knex => {
  await knex.schema.alterTable('pages', table => {
    table.boolean('isTemplate').notNullable().defaultTo(false)
  })
}

exports.down = async knex => {
  await knex.schema.alterTable('pages', table => {
    table.dropColumn('isTemplate')
  })
}
