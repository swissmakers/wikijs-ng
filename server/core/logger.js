const winston = require('winston')

/* global WIKI */

module.exports = {
  init (uid) {
    const loggerFormats = [
      winston.format.label({ label: uid }),
      winston.format.timestamp()
    ]

    if (WIKI.config.logFormat === 'json') {
      loggerFormats.push(winston.format.json())
    } else {
      loggerFormats.push(winston.format.colorize())
      loggerFormats.push(winston.format.printf(info => `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`))
    }

    const logger = winston.createLogger({
      level: WIKI.config.logLevel,
      format: winston.format.combine(...loggerFormats)
    })

    // Init Console (default)

    logger.add(new winston.transports.Console({
      level: WIKI.config.logLevel,
      prettyPrint: true,
      colorize: true,
      silent: false,
      timestamp: true
    }))

    return logger
  }
}
