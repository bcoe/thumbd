/* global describe, it */

var config = require('../lib').Config
var fs = require('fs')
var Grabber = require('../lib').Grabber
var nock = require('nock')
var Saver = require('../lib').Saver
var Worker = require('../lib').Worker

describe('Worker', function () {
  config.extend({
    awsSecret: 'foo-secret',
    logLevel: 'silent',
    bucket: 'foo-bucket'
  })

  describe('_runJob', function (done) {
    it('should download an image from S3, thumbnail it, and upload it', function (done) {
      var mockDownload = nock('https://foo-bucket.s3.amazonaws.com')
        .defaultReplyHeaders({
          'x-amz-meta-foo': 'bar'
        })
        .get('/awesome.jpg')
        .reply(200, fs.readFileSync('./test/fixtures/test.jpg'))
      var mockUpload = nock('https://foo-bucket.s3.amazonaws.com', {
        reqheaders: {
          'x-amz-meta-foo': 'bar'
        }
      })
        .put('/awesome_small.jpg')
        .reply(200)
      var worker = new Worker({
        // remove the job from SQS, this is the
        // final thing called during a successful run.
        _deleteJob: function (handle, cb) {
          mockDownload.done()
          mockUpload.done()
          return done()
        },
        grabber: new Grabber(),
        saver: new Saver()
      })

      worker._runJob('foo-handle', {
        original: 'awesome.jpg',
        descriptions: [{
          suffix: 'small',
          width: 32,
          height: 32
        }]
      }, function () {})
    })
  })
})
