const passportJWT = require('passport-jwt')

module.exports = {
  extractJWT: passportJWT.ExtractJwt.fromExtractors([
    passportJWT.ExtractJwt.fromAuthHeaderAsBearerToken(),
    (req) => {
      let token = null
      if (req && req.cookies) {
        token = req.cookies.jwt
      }
      // Force uploads to use Auth headers
      if (req.path.toLowerCase() === '/u') {
        return null
      }
      return token
    }
  ])
}
