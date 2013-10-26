var assert = require('assert'),
  sinon = require('sinon'),
  Thumbnailer = require('../lib/thumbnailer').Thumbnailer;

describe("#Thumbnailer", function() {

  describe("#createConversionPath", function() {

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

  describe('#execCommand', function() {
    
    beforeEach(function() {
      // create a thumbnailer with some of the
      // internals stubbed out.
      this.thumbnailer = new Thumbnailer();
      this.thumbnailer.convertedPath = '/tmp/222.jpg'

      // Simply execute callback when createConversionPath
      // is called.
      sinon.stub(this.thumbnailer, 'createConversionPath')
        .callsArg(0);
    });

    afterEach(function() {
      // Restore sinon's mocks.
      this.thumbnailer.execCommand.restore();
    });

    describe('#bounded', function() {

      it('appropriate convert command generated if no quality set', function() {
        var convertCommand = 'convert "/tmp/111.png[0]" -thumbnail 96X96 /tmp/222.jpg';

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

      it('appropriate convert command generated if quality set', function() {
        var convertCommand = 'convert "/tmp/111.png[0]" -thumbnail 96X96 -quality 75 /tmp/222.jpg';

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

  });

});