var assert = require('assert'),
  sinon = require('sinon'),
  Thumbnailer = require('../lib/thumbnailer').Thumbnailer;

describe("Thumbnailer", function() {

  describe("createConversionPath", function() {

    it("tmp.file() executed with appropriate parameters", function() {
      // we mock tmp.file() which is called
      // during the thumbnailer's execute phase.
      var tmp = {file: function() {}},
        mock = sinon.mock(tmp)
          .expects('file')
          .once()
          .withArgs({dir: '/tmp', postfix: '.png'}),
        thumbnailer = new Thumbnailer({tmp: tmp});

      // execute the thumbnailer with
      // our mock tmp.
      thumbnailer.execute({
        format: 'png'
      });

      // assert the expectations outlined
      // while creating the mock.
      mock.verify();
    });

  });

  describe('execCommand', function() {

    beforeEach(function() {
      // create a thumbnailer with some of the
      // internals stubbed out.
      this.thumbnailer = new Thumbnailer();
      this.thumbnailer.convertedPath = '/tmp/222.jpg';

      // Simply execute callback when createConversionPath
      // is called.
      sinon.stub(this.thumbnailer, 'createConversionPath')
        .callsArg(0);
    });

    afterEach(function() {
      // Restore sinon's mocks.
      this.thumbnailer.execCommand.restore();
    });

    describe('strict', function() {

      it('generates appropriate convert command', function() {
        var convertCommand = 'convert "/tmp/333.png[0]"  -resize 96X96!  /tmp/222.jpg';

        // We don't actually want to execute the
        // convert command.
        var mock = sinon.mock(this.thumbnailer)
          .expects('execCommand')
          .once()
          .withArgs(convertCommand);

        this.thumbnailer.execute({
          width: 96,
          height: 96,
          format: 'png',
          strategy: 'strict'
        }, '/tmp/333.png');

        mock.verify();
      });

    });

    describe('matted', function() {

      it('generates appropriate convert command for matted strategy', function() {
        var convertCommand = 'convert "/tmp/444.png[0]"  -resize 96X96 -size 96X96 xc:black +swap -gravity center -composite /tmp/222.jpg';

        // We don't actually want to execute the
        // convert command.
        var mock = sinon.mock(this.thumbnailer)
          .expects('execCommand')
          .once()
          .withArgs(convertCommand);

        this.thumbnailer.execute({
          width: 96,
          height: 96,
          format: 'png',
          strategy: 'matted'
        }, '/tmp/444.png');

        mock.verify();
      });

    });

    describe('bounded', function() {

      it('generates appropriate convert command generated if no quality set', function() {
        var convertCommand = 'convert "/tmp/111.png[0]"  -thumbnail 96X96 /tmp/222.jpg';

        // We don't actually want to execute the
        // convert command.
        var mock = sinon.mock(this.thumbnailer)
          .expects('execCommand')
          .once()
          .withArgs(convertCommand);

        this.thumbnailer.execute({
          width: 96,
          height: 96,
          format: 'png',
          strategy: 'bounded'
        }, '/tmp/111.png');

        mock.verify();
      });

      it('generates appropriate convert command generated if quality set', function() {
        var convertCommand = 'convert "/tmp/111.png[0]"  -thumbnail 96X96 -quality 75 /tmp/222.jpg';

        // We don't actually want to execute the
        // convert command.
        var mock = sinon.mock(this.thumbnailer)
          .expects('execCommand')
          .once()
          .withArgs(convertCommand);

        this.thumbnailer.execute({
          quality: 75,
          width: 96,
          height: 96,
          format: 'png',
          strategy: 'bounded'
        }, '/tmp/111.png');

        mock.verify();
      });

    });

    describe('manual', function() {
      it('generates a custom convert command, and executes it with appropriate parameters', function() {
        var convertCommand = "convert '/tmp/111.png' '/tmp/333.png' /tmp/222.jpg";

        // We don't actually want to execute the
        // convert command.
        var mock = sinon.mock(this.thumbnailer)
          .expects('execCommand')
          .once()
          .withArgs(convertCommand);

        this.thumbnailer.execute({
          strategy: "%(command)s '%(localPaths[0])s' '%(localPaths[1])s' %(convertedPath)s"
        }, ['/tmp/111.png', '/tmp/333.png']);

        mock.verify();
      });
    });

  });

  describe('_guessStrategy', function() {
    it('it returns strategy name, if strategy exists', function() {
      var thumbnailer = new Thumbnailer({
        strategy: 'bounded'
      });

      assert.equal(thumbnailer._guessStrategy(), 'bounded');
    });

    it('executes onComplete with error, if strategy not found', function(done) {
      var thumbnailer = new Thumbnailer({
        strategy: 'unknown',
        onComplete: function(err) {
          assert.equal(err.message, 'could not find strategy unknown');
          done();
        }
      });

      thumbnailer._guessStrategy();
    });

    it("returns 'manual' as strategy, if %(.*)s is present", function() {
      var thumbnailer = new Thumbnailer({
        strategy: '%(command)s foo -bar'
      });

      assert.equal(thumbnailer._guessStrategy(), 'manual');
    });
  });

});
