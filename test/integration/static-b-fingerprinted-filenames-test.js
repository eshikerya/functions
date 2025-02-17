let exec = require('child_process').execSync
let exists = require('path-exists').sync
let fs = require('fs')
let join = require('path').join
let mkdir = require('mkdirp').sync
let test = require('tape')

let arc
let mock = join(__dirname, '..', 'mock')
let tmp = join(mock, 'tmp')
let shared = join(tmp, 'node_modules', '@architect', 'shared')

let origRegion = process.env.AWS_REGION
let origCwd = process.cwd()
let static

test('Set up mocked arc', t=> {
  t.plan(2)
  mkdir(shared)
  fs.copyFileSync(join(mock, 'mock-arc-fingerprint'), join(shared, '.arc'))
  fs.copyFileSync(join(mock, 'mock-arc-fingerprint'), join(tmp, '.arc'))
  t.ok(exists(join(shared, '.arc')), 'Mock .arc (shared) file ready')
  t.ok(exists(join(tmp, '.arc')), 'Mock .arc (root) file ready')
  process.chdir(tmp)
  // eslint-disable-next-line
  arc = require('../..') // module globally inspects arc file so need to require after chdir
})

test('Fingerprinting only enabled if static manifest is found', t=> {
  t.plan(1)
  process.env.AWS_REGION = 'us-west-1'
  process.env.NODE_ENV = 'production'
  arc.static('index.html', {reload:true})
  t.equals(arc.static('index.html'), `https://a-production-bucket.s3.us-west-1.amazonaws.com/index.html`)
})

test('Set up mocked static manifest', t=> {
  t.plan(2)
  fs.copyFileSync(join(mock, 'mock-static'), join(shared, 'static.json'))
  t.ok(exists(join(shared, 'static.json')), 'Mock static.json file ready')
  // eslint-disable-next-line
  static = require(join(shared, 'static.json'))
  t.ok(static['index.html'], 'Static manifest loaded')
})

test('Staging and production fingerprinted URL tests', t=> {
  t.plan(4)
  t.equals(arc.static('index.html'), `https://a-production-bucket.s3.us-west-1.amazonaws.com/${static['index.html']}`, 'Production fingerprinted URL matches')

  process.env.NODE_ENV = 'staging'
  t.equals(arc.static('index.html'), `https://a-staging-bucket.s3.us-west-1.amazonaws.com/${static['index.html']}`, 'Staging fingerprinted URL matches')

  process.env.ARC_STATIC_BUCKET = 'a-totally-different-bucket'
  t.equals(arc.static('index.html'), `https://a-totally-different-bucket.s3.us-west-1.amazonaws.com/${static['index.html']}`, 'Fingerprinted ARC_STATIC_BUCKET env var populates and matches')

  process.env.ARC_STATIC_FOLDER = 'a-folder'
  t.equals(arc.static('index.html'), `https://a-totally-different-bucket.s3.us-west-1.amazonaws.com/a-folder/${static['index.html']}`, 'Fingerprinted ARC_STATIC_FOLDER env var populates and matches')
})

test('Clean up env', t=> {
  t.plan(1)
  delete process.env.ARC_STATIC_BUCKET
  delete process.env.ARC_STATIC_FOLDER
  process.env.AWS_REGION = origRegion
  process.env.NODE_ENV = 'testing'
  process.chdir(origCwd)
  exec(`rm -rf ${tmp}`)
  t.ok(!exists(tmp), 'Mocks cleaned up')
})
