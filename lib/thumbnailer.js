var _ = require("underscore"),
	exec = require('child_process').exec,
	tmp = require('tmp'),
	fs = require('fs');

function Thumbnailer(opts) {
	_.extend(this, {
		convert_command: 'convert',
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
		format: (description.format || 'jpg'),
		strategy: (description.strategy || 'bounded'),
		background: (description.background || 'black'),
		quality: (description.quality || null),
		onComplete: onComplete,
		thumbnailTimeout: 20000
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
	var _this = this;

	tmp.file({dir: this.tmp_dir, postfix: "." + this.format}, function(err, convertedPath, fd) {
		fs.closeSync(fd); // close immediately, we do not use this file handle.
		_this.convertedPath = convertedPath;
		callback(err);
	});
};

Thumbnailer.prototype.execCommand = function(command) {
	var _this = this;

	exec(command, {timeout: this.thumbnailTimeout}, function(err, stdout, stderr) {

		console.log('running command ', command);

		if (err) {
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

exports.Thumbnailer = Thumbnailer;

Thumbnailer.prototype.matted = function() {
	var qualityString = (this.quality ? '-quality ' + this.quality : ''),
		thumbnailCommand = this.convert_command + ' "' + this.localPath + '[0]" -thumbnail ' + (this.width * this.height) + '@ -gravity center -background ' + this.background + ' -extent ' + this.width + 'X' + this.height + ' ' + qualityString + ' ' + this.convertedPath;

	this.execCommand(thumbnailCommand);
};

Thumbnailer.prototype.bounded = function() {
	var dimensionsString = this.width + 'X' + this.height,
		qualityString = (this.quality ? '-quality ' + this.quality : ''),
		thumbnailCommand = this.convert_command + ' "' + this.localPath + '[0]" -thumbnail ' + dimensionsString + ' ' + qualityString + ' ' + this.convertedPath;

	this.execCommand(thumbnailCommand);
};

Thumbnailer.prototype.fill = function() {
	var dimensionsString = this.width + 'X' + this.height,
		qualityString = (this.quality ? '-quality ' + this.quality : ''),
		thumbnailCommand = this.convert_command + ' "' + this.localPath + '[0]" -resize ' + dimensionsString + '^ -gravity center -extent ' + dimensionsString + ' ' + qualityString + ' ' + this.convertedPath;

	this.execCommand(thumbnailCommand);
}
