var assert = require('assert'),
  config = require('../lib').Config,
  Client = require('../lib').Client,
  nock = require('nock');

describe('Client', function() {

  config.extend({
    awsSecret: 'foo-secret',
    awsKey: 'foo-key',
    logLevel: 'silent'
  });

  describe('upload', function() {
    it("should call saver with default bucket and region", function(done) {
      var Saver = function() {},
        client = new Client({
          Saver: Saver
        });

      Saver.prototype.save = function(bucket, region, source, destination, callback) {
        assert.equal(bucket, 'foo-bucket');
        assert.equal(region, 'us-east-1');
        done();
      };

      config.set('s3Bucket', 'foo-bucket');
      client.upload('/foo.jpg', '/bar/snuh.jpg', {}, function() {});
    });

    it("should allow bucket and region to be overridden", function(done) {
      var Saver = function() {},
        client = new Client({
          Saver: Saver
        });

      Saver.prototype.save = function(bucket, region, source, destination, callback) {
        assert.equal(bucket, 'bar-bucket');
        assert.equal(region, 'us-west-1');
        done();
      };

      config.set('s3Bucket', 'foo-bucket');
      client.upload('/foo.jpg', '/bar/snuh.jpg', {
        awsRegion: 'us-west-1',
        s3Bucket: 'bar-bucket'
      }, function() {});
    });

    it("should allow meta-info headers to be set when uploading", function(done) {
      var client = new Client({}),
        mockUpload = nock('https://bar-bucket.s3-us-west-1.amazonaws.com', {
          reqheaders: {
            'x-amz-meta-foo': 'bar'
          }
        })
        .put('/bar/snuh.jpg')
        .reply(200);

      client.upload('./test/fixtures/test.jpg', '/bar/snuh.jpg', {
        awsRegion: 'us-west-1',
        s3Bucket: 'bar-bucket',
        headers: {
          'x-amz-meta-foo': 'bar'
        }
      }, function(err) {
        mockUpload.done();
        return done();
      });
    });

  });

  describe('thumbnail', function() {
    it("should create prefix based on originalImagePath", function(done) {
      var client = new Client({
        sqs: {
          sendMessage: function(sqsObject) {
            var obj = JSON.parse(
              sqsObject.MessageBody
            );
            assert.equal(obj.prefix, '/foo/bar');
            done();
          },
          endpoint: {} // adhere to SQS contract.
        },
      });

      client.thumbnail('/foo/bar.jpg', []);
    });

    it("should allow prefix to be overridden by opts", function(done) {
      var client = new Client({
        sqs: {
          sendMessage: function(sqsObject) {
            var obj = JSON.parse(
              sqsObject.MessageBody
            );
            assert.equal(obj.prefix, '/banana');
            done();
          },
          endpoint: {} // adhere to SQS contract.
        },
      });

      client.thumbnail('/foo/bar.jpg', [], {prefix: '/banana'});
    });

    it("should allow arbitrary additional parameters to be set in opts", function(done) {
      var client = new Client({
        sqs: {
          sendMessage: function(sqsObject) {
            var obj = JSON.parse(
              sqsObject.MessageBody
            );
            assert.equal(obj.foo, 'bar');
            done();
          },
          endpoint: {} // adhere to SQS contract.
        },
      });

      client.thumbnail('/foo/bar.jpg', [], {foo: 'bar'});
    });

    it('should execute callback when it is the third parameter', function(done) {
      var client = new Client({
        sqs: {
          sendMessage: function(sqsObject, cb) {
            cb(null, 'success');
          },
          endpoint: {} // adhere to SQS contract.
        },
      });

      client.thumbnail('/foo/bar.jpg', [], function(err, message) {
        assert.equal(message, 'success');
        done();
      });
    });

    it('should execute callback when it is the fourth parameter', function(done) {
      var client = new Client({
        sqs: {
          sendMessage: function(sqsObject, cb) {
            cb(null, 'success');
          },
          endpoint: {} // adhere to SQS contract.
        },
      });

      client.thumbnail('/foo/bar.jpg', [], {}, function(err, message) {
        assert.equal(message, 'success');
        done();
      });
    });

  });

});
