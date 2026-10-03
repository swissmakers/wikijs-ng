exports.up = async knex => {
  // -> Comment moderation (existing comments stay visible)
  await knex.schema.alterTable('comments', table => {
    table.boolean('isApproved').notNullable().defaultTo(true)
  })
}

exports.down = async knex => {
  await knex.schema.alterTable('comments', table => {
    table.dropColumn('isApproved')
  })
}
