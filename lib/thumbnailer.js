var _ = require("underscore"),
	exec = require('child_process').exec,
	tmp = require('tmp'),
	fs = require('fs');

function Thumbnailer(opts) {
	_.extend(this, {
		tmp_dir: (process.env.TMP_DIR || '/tmp')
	}, opts);
}

Thumbnailer.prototype.execute = function(description, localPath, onComplete) {
	var _this = this;

	// parameters for a single execution
	// of the thumbnailer.
	_.extend(this, {
		localPath: localPath,
		width: description.width,
		height: description.height,
		strategy: (description.strategy || 'bounded'),
		background: (description.background || 'black'),
		onComplete: onComplete
	});

	this.createConversionPath(function(err) {

		if (err) {
			_this.onComplete(err);
			return;
		}

		// apply the thumbnail creation strategy.
		if (!_this[_this.strategy]) {
			_this.onComplete('could not find strategy ' + _this.strategy);
		} else {
			_this[_this.strategy]()
		}
	});
};

Thumbnailer.prototype.createConversionPath = function(callback) {
	_this = this;

	tmp.file({dir: this.tmp_dir, postfix: ".jpg"}, function(err, convertedPath, fd) {
		_this.convertedPath = convertedPath;
		callback(err);
	});
};

Thumbnailer.prototype.execCommand = function(command) {
	var _this = this;

	exec(command, function(err, stdout, stderr) {
		
		console.log('running command ', command);

		if (err) {
			console.log(err);
			_this.onComplete(err);
			return;
		}
		
		// make sure the conversion was successful.
		fs.stat(_this.convertedPath, function(err, stat) {
			err = err || stat.size === 0 ? 'zero byte thumbnail created' : null;
			if (err) {
				_this.onComplete(err);
				return;
			}
			_this.onComplete(null, _this.convertedPath);
		});

	});
};

Thumbnailer.prototype.dimensions = function(callback) {
	var dimensionsCommand = 'identify -format \'{"width": %w, "height": %h}\' ' + this.localPath;
	
	exec(dimensionsCommand, function(err, stdout, stderr) {			
		
		if (err) {
			callback(err);
			return;
		}

		callback(null, JSON.parse(stdout));
	});
}

exports.Thumbnailer = Thumbnailer;

Thumbnailer.prototype.matted = function() {
	var thumbnailCommand = 'convert "' + this.localPath + '" -thumbnail ' + (this.width * this.height) + '@ -gravity center -background ' + this.background + ' -extent ' + this.width + 'X' + this.height + ' ' + this.convertedPath;
	
	this.execCommand(thumbnailCommand);
};

Thumbnailer.prototype.bounded = function() {
	var _this = this;

	this.dimensions(function(err, dimensions) {

		if (err) {
			callback(err);
			return;
		}

		// Genereate the appropriate dimension string
		// for ImageMagick, based on original image dimensions:
		//
		// X150 if portrait. 150X if landscape.
		var dimensionsString = 'X' + Math.min(_this.height, dimensions.height);
		if (dimensions.width > dimensions.height) {
			dimensionsString = Math.min(_this.width, dimensions.width) + 'X';
		}

		var thumbnailCommand = 'convert "' + _this.localPath + '" -thumbnail ' + dimensionsString + ' ' + _this.convertedPath;

		_this.execCommand(thumbnailCommand);
	});
};