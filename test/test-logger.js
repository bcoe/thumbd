/* global describe, it */

var assert = require('assert')
var config = require('../lib').Config
var path = require('path')
var customLogger = require('./fixtures/customLogger')

describe('Logger', function () {
  describe('custom logger', function () {
    var defaultLogger = config.get('logger')
    config.set('logger', path.resolve(path.join(__dirname, './fixtures/customLogger')))
    var logger = require(config.get('logger'))

    it('should call the custom logger', function () {
      assert.equal(customLogger.__getLastLog(), '')

      logger.info('test 123')
      assert.equal(customLogger.__getLastLog(), 'test 123')

      logger.warn('test abc')
      assert.equal(customLogger.__getLastLog(), 'test abc')

      logger.error('test', 'abc', '123')
      assert.equal(customLogger.__getLastLog(), 'test abc 123')
    })

    config.set('logger', defaultLogger)
  })
})
