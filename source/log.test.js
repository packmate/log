// ---------------------------------------------

const fake = {
  fetch: stub.async(),
  message: 'message',
  name: 'name',
  request: {},

  options: {
    application: 'string',
    fetch: this.fetch,
    key: 'string',
    mode: 'string',
    source: 'string'
  }
}

// ---------------------------------------------

function confirmCorrectBaseRequest(fetch, { key, source }) {
  const { args } = fetch.getCall(0)

  expect(args[1].method).to.eq('POST')
  expect(args[1].headers['Content-Type']).to.include('application/json; charset=UTF-8')
  expect(args[0]).to.eq(`https://api.logflare.app/logs?api_key=${ key }&source=${ source }`)
}

function getFetchBody(fetch) {
  return JSON.parse(fetch.getCall(0).args[1].body)
}

// ---------------------------------------------

describe('configureLogger()', () => {
  const configureLogger = require('./log')

  context('without all required options', () => {
    it('throws an error', () => {
      const requiredProperties = [ 'application', 'key', 'mode', 'source' ]

      requiredProperties.forEach(property => {
        const invalidOptions = { ...fake.options }
        delete invalidOptions[property]

        expect(() => configureLogger(invalidOptions)).to.throw('required properties')
      })
    })
  })

  context('with all required options', () => {
    it('returns a createLogger() function', () => {
      expect(configureLogger(fake.options)).to.be.a('function')
    })
  })
})

// ---------------------------------------------

describe('createLogger()', () => {
  const configureLogger = require('./log')

  context('without a name', () => {
    it('throws an error', () => {
      const createLogger = configureLogger(fake.options)
      expect(() => createLogger()).to.throw('name')
    })
  })

  context('with a name', () => {
    it('returns a log() function', () => {
      const createLogger = configureLogger(fake.options)
      const log = createLogger(fake.name)

      expect(log).to.be.a('function')
    })
  })
})

// ---------------------------------------------

describe('log()', () => {
  const configureLogger = require('./log')

  beforeEach(() => {
    sinon.stub(console, 'log')
  })

  afterEach(() => {
    console.log.restore()
  })

  context('without a message', () => {
    it('throws an error', () => {
      const createLogger = configureLogger(fake.options)
      const log = createLogger(fake.name)

      expect(() => log()).to.throw('message')
    })
  })

  context('with a message', () => {
    it('sends the correct base request to Logflare', () => {
      const fetch = spy.async()

      const createLogger = configureLogger({ ...fake.options, fetch })
      const log = createLogger(fake.name)
      log(fake.message)

      confirmCorrectBaseRequest(fetch, fake.options)
    })

    it('logs the name and message to the console', () => {
      const message = 'Test message.'
      const name = 'test-title'

      const createLogger = configureLogger(fake.options)
      const log = createLogger(name)
      log(message)

      expect(console.log).to.have.been.calledOnceWith('[test-title] Test message.')
    })

    it('logs the name and message remotely with correct metadata', () => {
      const application = 'test-app'
      const message = 'Test message.'
      const mode = 'testing'
      const name = 'name'

      const fetch = spy.async()

      const createLogger = configureLogger({ ...fake.options, application, mode, fetch })
      const log = createLogger(name)
      log(message)

      expect(fetch).to.have.been.calledOnce
      const { metadata, log_entry } = getFetchBody(fetch)

      expect(log_entry).to.eq('[name] Test message.')
      expect(metadata.level).to.eq('info')
      expect(metadata.application).to.eq('test-app')
      expect(metadata.mode).to.eq('testing')
    })

    context('without data', () => {
      it('does not include the data in the console', () => {
        const createLogger = configureLogger(fake.options)
        const log = createLogger(fake.name)
        log(fake.message)

        expect(console.log.getCall(0).args.length).to.eq(1)
      })

      it('does not include the data in the remote request', () => {
        const fetch = spy.async()

        const createLogger = configureLogger({ ...fake.options, fetch })
        const log = createLogger(fake.name)
        log(fake.message)

        expect(fetch).to.have.been.calledOnce
        const { metadata } = getFetchBody(fetch)
        expect(metadata.data).not.to.exist
      })
    })

    context('with data', () => {
      it('includes the data in the console', () => {
        const data = { test: 'data' }

        const createLogger = configureLogger(fake.options)
        const log = createLogger(fake.name)
        log(fake.message, data)

        expect(console.log.getCall(0).args[1])
          .to.deep.eq({ test: 'data' })
      })

      it('includes the data in the remote request', () => {
        const fetch = spy.async()
        const data = { test: 'data' }

        const createLogger = configureLogger({ ...fake.options, fetch })
        const log = createLogger(fake.name)
        log(fake.message, data)

        expect(fetch).to.have.been.calledOnce
        const { metadata } = getFetchBody(fetch)
        expect(metadata.data).to.deep.eq({ test: 'data' })
      })
    })

    context('with notes', () => {
      it('includes the truthy notes in the console', () => {
        const message = 'Test message.'
        const name = 'test-title'
        const notes = { 'note 1': true, 'note 2': false, 'note 3': 1, 'note 4': 'ok' }

        const createLogger = configureLogger(fake.options)
        const log = createLogger(name)
        log(message, {}, notes)

        expect(console.log)
          .to.have.been.calledOnceWith('[test-title] Test message. (note 1, note 3, note 4)')
      })

      it('includes the true notes in the remote request', () => {
        const message = 'Test message.'
        const name = 'test-title'
        const notes = { 'note 1': true, 'note 2': false, 'note 3': true }

        const fetch = spy.async()

        const createLogger = configureLogger({ ...fake.options, fetch })
        const log = createLogger(name)
        log(message, {}, notes)

        expect(fetch).to.have.been.calledOnce
        const { log_entry } = getFetchBody(fetch)

        expect(log_entry).to.eq(`[test-title] Test message. (note 1, note 3)`)
      })

      context('with all false notes', () => {
        it('does not change the message in the console', () => {
          const message = 'Test message.'
          const name = 'test-title'
          const notes = { 'note 1': false, 'note 2': false, 'note 3': false }

          const createLogger = configureLogger(fake.options)
          const log = createLogger(name)
          log(message, {}, notes)

          expect(console.log)
            .to.have.been.calledOnceWith('[test-title] Test message.')
        })

        it('does not change the message in the remote request', () => {
          const message = 'Test message.'
          const name = 'test-title'
          const notes = { 'note 1': false, 'note 2': false, 'note 3': false }

          const fetch = spy.async()

          const createLogger = configureLogger({ ...fake.options, fetch })
          const log = createLogger(name)
          log(message, {}, notes)

          expect(fetch).to.have.been.calledOnce
          const { log_entry } = getFetchBody(fetch)

          expect(log_entry).to.eq(`[test-title] Test message.`)
        })
      })

      context('without data', () => {
        it('does not include the data in the console', () => {
          const notes = { 'note 1': true }

          const createLogger = configureLogger(fake.options)
          const log = createLogger(fake.name)
          log(fake.message, null, notes)

          expect(console.log.getCall(0).args.length).to.eq(1)
        })

        it('does not include the data in the remote request', () => {
          const notes = { 'note 1': true }

          const fetch = spy()

          const createLogger = configureLogger({ ...fake.options, fetch })
          const log = createLogger(fake.name)
          log(fake.message, null, notes)

          expect(fetch).to.have.been.calledOnce
          const { metadata } = getFetchBody(fetch)
          expect(metadata.data).not.to.exist
        })
      })
    })
  })
})

// ---------------------------------------------

describe('log.error()', () => {
  const configureLogger = require('./log')

  beforeEach(() => {
    sinon.stub(console, 'error')
  })

  afterEach(() => {
    console.error.restore()
  })

  context('without an error object or message', () => {
    it('throws an error', () => {
      const createLogger = configureLogger(fake.options)
      const log = createLogger(fake.name)

      expect(() => log.error()).to.throw('error or message')
    })
  })

  context('with a message', () => {
    it('logs the error message to the console', () => {
      const message = 'Test message.'
      const name = 'name'

      const createLogger = configureLogger(fake.options)
      const log = createLogger(name)
      log.error(message)

      expect(console.error).to.have.been.calledOnceWith(`[${ name }] ${ message }`)
    })

    it('logs the error message remotely with correct metadata', () => {
      const application = 'test-app'
      const message = 'Test message.'
      const mode = 'testing'
      const name = 'name'

      const fetch = spy.async()

      const createLogger = configureLogger({ ...fake.options, application, mode, fetch })
      const log = createLogger(name)
      log.error(message)

      expect(fetch).to.have.been.calledOnce
      const { metadata, log_entry } = getFetchBody(fetch)

      expect(log_entry).to.eq(`[${ name }] ${ message }`)
      expect(metadata.level).to.eq('error')
      expect(metadata.application).to.eq('test-app')
      expect(metadata.mode).to.eq('testing')
    })

    context('without data', () => {
      it('does not include the data in the console', () => {
        const createLogger = configureLogger(fake.options)
        const log = createLogger(fake.name)
        log.error(fake.message)

        expect(console.error.getCall(0).args.length).to.eq(1)
      })

      it('does not include the data in the remote request', () => {
        const fetch = spy.async()

        const createLogger = configureLogger({ ...fake.options, fetch })
        const log = createLogger(fake.name)
        log.error(fake.message)

        expect(fetch).to.have.been.calledOnce
        const { metadata } = getFetchBody(fetch)
        expect(metadata.data).not.to.exist
      })
    })

    context('with data', () => {
      it('includes the data in the console', () => {
        const data = { test: 'data' }

        const createLogger = configureLogger(fake.options)
        const log = createLogger(fake.name)
        log.error(fake.message, data)

        expect(console.error.getCall(0).args[1])
          .to.deep.eq({ test: 'data' })
      })

      it('includes the data in the remote request', () => {
        const fetch = spy.async()
        const data = { test: 'data' }

        const createLogger = configureLogger({ ...fake.options, fetch })
        const log = createLogger(fake.name)
        log.error(fake.message, data)

        const { metadata } = getFetchBody(fetch)
        expect(metadata.data).to.deep.eq({ test: 'data' })
      })
    })
  })

  context('with an error object', () => {
    it('logs the error message and data to the console', () => {
      const name = 'test'
      const message = 'Error message.'
      const error = new Error(message)

      const createLogger = configureLogger(fake.options)
      const log = createLogger(name)
      log.error(error)

      expect(console.error).to.have.been.calledOnce

      const { args } = console.error.getCall(0)
      expect(args[0]).to.eq('[test] Error message.')
      expect(args[1]).to.deep.eq({ stack: error.stack, error })
    })

    it('logs the error message and data remotely with the correct metadata', () => {
      const application = 'test-app'
      const message = 'Error message.'
      const mode = 'testing'
      const name = 'test'

      const error = new Error(message)

      const fetch = spy.async()

      const createLogger = configureLogger({ ...fake.options, application, mode, fetch })
      const log = createLogger(name)
      log.error(error)

      expect(fetch).to.have.been.calledOnce
      const { log_entry, metadata } = getFetchBody(fetch)

      expect(log_entry).to.eq('[test] Error message.')
      expect(metadata.level).to.eq('error')
      expect(metadata.application).to.eq('test-app')
      expect(metadata.mode).to.eq('testing')

      expect(metadata.data.stack).to.eq(error.stack)
      expect(metadata.data.error).to.be.an('object')
    })
  })
})

// ---------------------------------------------

describe('log.request()', () => {
  const configureLogger = require('./log')

  beforeEach(() => {
    sinon.stub(console, 'log')
  })

  afterEach(() => {
    console.log.restore()
  })

  context('without a request', () => {
    it('throws an error', () => {
      const createLogger = configureLogger(fake.options)
      const log = createLogger(fake.name)

      expect(() => log.request()).to.throw('without a request')
    })
  })

  context('with a request', () => {
    it('logs the request method and URL to the console', () => {
      const name = 'test'
      const request = { ...fake.request, method: 'GET', url: '/' }

      const createLogger = configureLogger(fake.options)
      const log = createLogger(name)
      log.request(request)

      expect(console.log).to.have.been.calledOnce

      const { args } = console.log.getCall(0)
      expect(args[0]).to.eq(`[test] GET /`)
    })

    it('logs the request method and URL remotely', () => {
      const name = 'test'
      const request = { ...fake.request, method: 'POST', url: '/post' }

      const fetch = spy.async()

      const createLogger = configureLogger({ ...fake.options, fetch })
      const log = createLogger('test')
      log.request(request)

      expect(fetch).to.have.been.calledOnce
      const { log_entry, metadata } = getFetchBody(fetch)

      expect(log_entry).to.eq(`[test] POST /post`)
      expect(metadata.level).to.eq('info')
    })

    context('without a request body', () => {
      it('does not include the request body in the console', () => {
        const request = { ...fake.request, body: null }

        const createLogger = configureLogger(fake.options)
        const log = createLogger(fake.name)
        log.request(request)

        expect(console.log).to.have.been.calledOnce
        expect(console.log.getCall(0).args.length).to.eq(1)
      })

      it('does not include the request body in the remote request', () => {
        const request = { ...fake.request, body: null }

        const fetch = spy.async()

        const createLogger = configureLogger({ ...fake.options, fetch })
        const log = createLogger(fake.name)
        log.request(request)

        expect(fetch).to.have.been.calledOnce
        const { metadata } = getFetchBody(fetch)
        expect(metadata).not.to.have.property('data')
      })
    })

    context('with a request body', () => {
      it('includes the request body in the console', () => {
        const request = { ...fake.request, body: 'body' }

        const createLogger = configureLogger(fake.options)
        const log = createLogger(fake.name)
        log.request(request)

        expect(console.log).to.have.been.calledOnce
        expect(console.log.getCall(0).args[1]).to.eq('body')
      })

      it('includes the request body in the remote request', () => {
        const request = { ...fake.request, body: 'body' }

        const fetch = spy.async()

        const createLogger = configureLogger({ ...fake.options, fetch })
        const log = createLogger(fake.name)
        log.request(request)

        expect(fetch).to.have.been.calledOnce
        const { metadata } = getFetchBody(fetch)
        expect(metadata.data).to.eq('body')
      })
    })
  })
})

// ---------------------------------------------

describe('log.append()', () => {
  beforeEach(() => {
    sinon.stub(console, 'log')
  })

  afterEach(() => {
    console.log.restore()
  })

  const configureLogger = require('./log')

  context('without a name', () => {
    it('throws an error', () => {
      const createLogger = configureLogger(fake.options)
      const logOne = createLogger(fake.name)

      expect(logOne.append).to.throw('name')
    })
  })

  context('with a name', () => {
    it('returns a new log() function', () => {
      const createLogger = configureLogger(fake.options)
      const logOne = createLogger(fake.name)
      const logTwo = logOne.append(fake.name)

      expect(logTwo).to.be.a('function')
      expect(logTwo.error).to.be.a('function')
      expect(logTwo.request).to.be.a('function')
      expect(logTwo.append).to.be.a('function')
    })

    describe('the new logger', () => {
      it('includes both names when logging', () => {
        const createLogger = configureLogger(fake.options)
        const logOne = createLogger('one')
        const logTwo = logOne.append('two')

        logOne('Message.')
        expect(console.log.firstCall.args[0]).to.eq('[one] Message.')

        logTwo('Message.')
        expect(console.log.secondCall.args[0]).to.eq('[one] [two] Message.')
      })
    })
  })
})
