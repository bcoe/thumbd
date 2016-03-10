/* global describe, it */

var assert = require('assert')
var config = require('../lib').Config
var Grabber = require('../lib').Grabber
var nock = require('nock')

describe('Grabber', function () {
  describe('download', function () {
    config.extend({
      awsSecret: 'foo-secret',
      logLevel: 'silent'
    })

    it('should call save with meta-headers returned by AWS', function (done) {
      var grabber = new Grabber()
      var mockDownload = nock('https://my-bucket.s3.amazonaws.com')
        .defaultReplyHeaders({
          'x-amz-meta-foo': 'bar'
        })
        .get('/foo/awesome.jpg')
        .reply(200, 'abc123')

      grabber.download('my-bucket', 'us-east-1', '/foo/awesome.jpg', function (err, data, headers) {
        mockDownload.done()
        assert.equal(headers['x-amz-meta-foo'], 'bar')
        return done(err)
      })
    })

    it('should call save with x-amz-server-side-encryption returned by AWS', function (done) {
      var grabber = new Grabber()
      var mockDownload = nock('https://my-bucket.s3.amazonaws.com')
        .defaultReplyHeaders({
          'x-amz-server-side-encryption': 'AES256'
        })
        .get('/foo/awesome.jpg')
        .reply(200, 'abc123')

      grabber.download('my-bucket', 'us-east-1', '/foo/awesome.jpg', function (err, data, headers) {
        mockDownload.done()
        assert.equal(headers['x-amz-server-side-encryption'], 'AES256')
        return done(err)
      })
    })
  })

})
