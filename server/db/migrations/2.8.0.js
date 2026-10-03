/* global WIKI */

const OLD_PLANTUML = 'https://plantuml.requarks.io'
const NEW_PLANTUML = 'https://www.plantuml.com/plantuml'
const OLD_LOGOS = ['/_assets/svg/logo-wikijs-full.svg', '/_assets/svg/logo-wikijs.svg']
const NEW_LOGO = '/_assets/svg/logo-swissmakers.svg'

// JSON columns come back as strings on some dialects (sqlite, mssql)
const parseJson = value => {
  if (typeof value !== 'string') {
    return value
  }
  try {
    return JSON.parse(value)
  } catch (err) {
    return null
  }
}

exports.up = async knex => {
  // -> Logging modules were never loaded; the table is gone with them
  await knex.schema.dropTableIfExists('loggers')

  // -> The upstream locale service is no longer used
  await knex('settings').where('key', 'graphEndpoint').del()

  // -> Move the PlantUML renderer off the upstream server, unless it was customized
  const plantuml = await knex('renderers').where('key', 'markdownPlantuml').first()
  if (plantuml) {
    const config = parseJson(plantuml.config) || {}
    if (!config.server || config.server === OLD_PLANTUML) {
      config.server = NEW_PLANTUML
      await knex('renderers').where('key', 'markdownPlantuml').update({ config: JSON.stringify(config) })
    }
  }

  // -> Replace the upstream default logo with the bundled one, unless it was customized
  const logo = await knex('settings').where('key', 'logoUrl').first()
  if (logo) {
    const value = parseJson(logo.value) || {}
    if (OLD_LOGOS.includes(value.v)) {
      await knex('settings').where('key', 'logoUrl').update({ value: JSON.stringify({ v: NEW_LOGO }) })
    }
  }
}

exports.down = async knex => {
  const dbCompat = {
    charset: (WIKI.config.db.type === 'mysql' || WIKI.config.db.type === 'mariadb')
  }
  await knex.schema.createTable('loggers', table => {
    if (dbCompat.charset) { table.charset('utf8mb4') }
    table.string('key').notNullable().primary()
    table.boolean('isEnabled').notNullable().defaultTo(false)
    table.string('level').notNullable().defaultTo('warn')
    table.json('config')
  })
}
