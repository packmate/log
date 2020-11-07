module.exports = (options = {}) => {
  const fetch = options.fetch || require('node-fetch')
  const { application, key, mode, source } = options

  if(!application || !key || !mode || !source) {
    throw new Error('[configureLogger] Called without all required properties.')
  }

  function configureLogger(name) {
    if (!name) {
      throw new Error('[createLogger] Called without a name.')
    }

    // Allow composition of logger display name with '+', i.e.:
    // "one+two" => "[one] [two]".
    const displayName = name
      .split('+')
      .map(text => `[${ text }]`)
      .join(' ')

    // ---------------------------------------------

    function createMessage(message, notes) {
      let suffix = ''

      if (notes) {
        const truthyNotes = Object.keys(notes).filter(key => !!notes[key])

        if (truthyNotes.length) {
          suffix = ` (${ truthyNotes.join(', ') })`
        }
      }

      return `${ displayName } ${ message }${ suffix }`
    }

    function logRemotely(message, { data, level }) {
      return fetch(`https://api.logflare.app/logs?api_key=${ key }&source=${ source }`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json; charset=UTF-8'
        },

        body: JSON.stringify({
          log_entry: message,

          metadata: {
            application,
            data,
            level,
            mode
          }
        })
      })
    }

    // ---------------------------------------------

    function log(message, data, notes) {
      if (!message) {
        throw new Error('[log] Called without a message.')
      }

      const fullMessage = createMessage(message, notes)

      if (data) {
        console.log(fullMessage, data)
        return logRemotely(fullMessage, { data, level: 'info' })
      }

      console.log(fullMessage)
      return logRemotely(fullMessage, { level: 'info' })
    }

    // ---------------------------------------------

    log.error = (errorOrMessage, data) => {
      if (!errorOrMessage) {
        throw new Error('[log.error] Called without an error or message.')
      }

      if (typeof errorOrMessage === 'string') {
        const message = createMessage(errorOrMessage)

        if (data) {
          console.error(message, data)
          return logRemotely(message, { data, level: 'error' })
        }

        console.error(message)
        return logRemotely(message, { level: 'error' })
      }

      if (typeof errorOrMessage === 'object') {
        const error = errorOrMessage
        const message = createMessage(error.message)
        const metadata = { stack: error.stack, error }

        console.error(message, metadata)
        return logRemotely(message, { data: metadata, level: 'error' })
      }
    }

    // ---------------------------------------------

    log.request = (request) => {
      if (!request) {
        throw new Error('[log.request] Called without a request.')
      }

      const { body, method, url } = request
      const message = createMessage(`${ method } ${ url }`)

      if (request.body) {
        console.log(message, request.body)
        return logRemotely(message, { data: body, level: 'info' })
      }

      console.log(message)
      return logRemotely(message, { level: 'info' })
    }

    // ---------------------------------------------

    log.append = (newName) => {
      if (!newName) {
        throw new Error('[log.append] Called without a name.')
      }

      return configureLogger(`${ name }+${ newName }`)
    }

    // ---------------------------------------------

    return log
  }

  return configureLogger
}
