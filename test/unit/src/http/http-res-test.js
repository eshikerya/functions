let http = require('../../../../src').http
let test = require('tape')
let requests = require('./http-req-fixtures')
let responses = require('./http-res-fixtures')

let b64dec = i => new Buffer.from(i, 'base64').toString()
let str = i => JSON.stringify(i)
let match = (copy, item) => `${copy} matches: ${item}`
let request = requests.arc5.getIndex

test('Set up env', t => {
  t.plan(2)
  t.ok(http, 'Loaded HTTP')
  t.ok(responses, 'Loaded response fixtures')
})

test('Architect v6 dependency-free responses', t => {
  // Init env var to keep from stalling on db reads in CI
  process.env.SESSION_TABLE_NAME = 'jwe'
  t.plan(14)
  let run = (response, callback) => {
    let handler = http((req, res) => res(response))
    handler(request, {}, callback)
  }
  run(responses.arc6.isBase64Encoded, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(responses.arc6.isBase64Encoded.body, res.body, match('res.body', res.body))
    t.ok(res.isBase64Encoded, 'isBase64Encoded param passed through')
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
  run(responses.arc6.buffer, (err, res) => {
    t.notOk(err, 'No error')
    t.ok(typeof res.body === 'string', 'Received string (and not buffer) back')
    t.equal(b64dec(res.body), 'hi there\n','Body properly auto-encoded')
    t.ok(res.isBase64Encoded, 'isBase64Encoded param set automatically')
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
  run(responses.arc6.encodedWithBinaryType, (err, res) => {
    t.notOk(err, 'No error')
    t.ok(typeof res.body === 'string', 'Body is (likely) base 64 encoded')
    t.equal(b64dec(res.body), 'hi there\n', 'Body properly auto-encoded')
    t.ok(res.isBase64Encoded, 'isBase64Encoded param set automatically')
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
})

test('Architect v5 dependency-free responses', t => {
  t.plan(9)
  let run = (response, callback) => {
    let handler = http((req, res) => res(response))
    handler(request, {}, callback)
  }
  run(responses.arc5.type, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(responses.arc5.type.type, res.headers['Content-Type'], `type matches res.headers['Content-Type']: ${res.headers['Content-Type']}`)
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
  run(responses.arc5.cookie, (err, res) => {
    t.notOk(err, 'No error')
    t.ok(res.headers['Set-Cookie'].includes('_idx='), `Cookie set: ${res.headers['Set-Cookie'].substr(0,75)}...`)
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
  run(responses.arc5.cors, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(res.headers['Access-Control-Allow-Origin'], '*', `CORS boolean set res.headers['Access-Control-Allow-Origin'] === '*'`)
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
})

test('Architect v5 + Functions', t => {
  t.plan(19)
  let antiCache = 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0'
  let run = (response, callback) => {
    let handler = http((req, res) => res(response))
    handler(request, {}, callback)
  }
  run(responses.arc5.body, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(str(responses.arc5.body.body), str(res.body), match('res.body', res.body))
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
  run(responses.arc5.cacheControl, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(responses.arc5.cacheControl.cacheControl, res.headers['Cache-Control'], match(`res.headers['Cache-Control']`, str(res.headers['Cache-Control'])))
    if (responses.arc5.cacheControl.headers['cache-control'] && !res.headers['cache-control'])
      t.pass(`Headers normalized and de-duped: ${str(res.headers)}`)
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
  run(responses.arc5.noCacheControlHTML, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(res.headers['Cache-Control'], antiCache, 'Default anti-caching headers set for HTML response')
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
  run(responses.arc5.noCacheControlJSON, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(res.headers['Cache-Control'], antiCache, 'Default anti-caching headers set for JSON response')
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
  run(responses.arc5.noCacheControlOther, (err, res) => {
    t.notOk(err, 'No error')
    let def = 'max-age=86400'
    t.equal(res.headers['Cache-Control'], def, 'Default caching headers set for non-HTML/JSON response')
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
  run(responses.arc5.defaultsToJson, (err, res) => {
    t.notOk(err, 'No error')
    t.ok(res.headers['Content-Type'].includes('application/json'), 'Unspecified content type defaults to JSON')
    t.equal(res.statusCode, 200, 'Responded with 200')
  })
})

test('Architect v4 + Functions statically-bound content type responses', t => {
  t.plan(24)
  let r = responses.arc4
  let run = (response, data, contentType) => {
    let handler = http((req, res) => res(response))
    handler(request, {}, (err, res) => {
      t.notOk(err, 'No error')
      // Don't double-encode JSON
      if (res.headers['Content-Type'].includes('json'))
        t.equal(str(data), res.body, match('res.body', res.body))
      else
        t.equal(str(data), str(res.body), match('res.body', res.body))
      t.true(res.headers['Content-Type'].includes(contentType), `Correct Content-Type header sent: ${contentType}`)
      t.equal(res.statusCode, 200, 'Responded with 200')
    })
  }
  run(r.css, r.css.css, 'text/css')
  run(r.html, r.html.html, 'text/html')
  run(r.js, r.js.js, 'text/javascript')
  run(r.json, r.json.json, 'application/json')
  run(r.text, r.text.text, 'text/plain')
  run(r.xml, r.xml.xml, 'application/xml')
})

test('Architect <6 + Functions response params', t => {
  t.plan(11)
  let run = (response, callback) => {
    let handler = http((req, res) => res(response))
    handler(request, {}, callback)
  }
  run(responses.arc.locationHi, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(res.statusCode, 302, match('res.statusCode', res.statusCode))
    t.equal(responses.arc.locationHi.location, res.headers.Location, match('res.headers.Location', res.headers.Location))
  })
  run(responses.arc.status201, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(responses.arc.status201.status, res.statusCode, match('code', res.statusCode))
  })
  run(responses.arc.code201, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(responses.arc.code201.code, res.statusCode, match('status', res.statusCode))
  })
  run(responses.arc.statusCode201, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(responses.arc.statusCode201.statusCode, res.statusCode, match('statusCode', res.statusCode))
  })
  run(responses.arc.session, (err, res) => {
    t.notOk(err, 'No error')
    t.ok(res.headers['Set-Cookie'].includes('_idx='), `Cookie set: ${res.headers['Set-Cookie'].substr(0,75)}...`)
  })
})

test('Test errors', t => {
  t.plan(3)
  let error = Error('something bad happened')
  let handler = http((req, res) => res(error))
  handler(request, {}, (err, res) => {
    t.notOk(err, 'No error')
    t.equal(res.statusCode, 500, 'Error response, 500 returned')
    t.ok(res.body.includes(error.message), `Error response included error message: ${error.message}`)
  })
  // Unset env var for future testing (ostensibly)
  delete process.env.SESSION_TABLE_NAME
})

