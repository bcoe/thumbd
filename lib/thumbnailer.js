var exec = require('child_process').exec,
	sprintf = require('sprintf-js').sprintf,
	_ = require('underscore'),
	fs = require('fs'),
	config = require('./config').Config;

/**
 * Initialize the Thumbnailer
 */
function Thumbnailer(opts) {
	// for the benefit of testing
	// perform dependency injection.
	_.extend(this, {
		tmp: require('tmp')
	}, opts);
}

/**
 * Execute the image conversion command
 *
 * @param object description The job description
 * @param localPath The local path to the image
 * @param function onComplete The callback function
 */
Thumbnailer.prototype.execute = function(description, localPaths, onComplete) {
	var _this = this;
	// parameters for a single execution
	// of the thumbnailer.
	_.extend(this, {
		localPaths: localPaths,
		width: description.width,
		height: description.height,
		format: (description.format || 'jpg'),
		strategy: (description.strategy || 'bounded'),
		background: (description.background || 'black'),
		quality: (description.quality || null),
		exec: (description.exec || null),
		command: (description.command || config.get('convertCommand')),
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
			_this[_this.strategy]();
		}
	});
};

/**
 * Create a temp file for the converted image
 *
 * @param function callback The callback function
 */
Thumbnailer.prototype.createConversionPath = function(callback) {
	var _this = this;

	this.tmp.file({dir: config.get('tmpDir'), postfix: "." + this.format}, function(err, convertedPath, fd) {
		fs.closeSync(fd); // close immediately, we do not use this file handle.
		_this.convertedPath = convertedPath;
		callback(err);
	});
};

/**
 * Execute the conversion command
 *
 * @param string command The command
 */
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
			if (err || stat.size === 0) {
				err =  'zero byte thumbnail created';
				_this.onComplete(err);
				return;
			}
			_this.onComplete(null, _this.convertedPath);
		});

	});
};

/**
 * Convert the image using the manual strategy
 */
Thumbnailer.prototype.manual = function() {
	var thumbnailCommand = sprintf(this.exec, { 
		command: this.command,
		sources: this.localPaths, 
		output: this.convertedPath
	});

	this.execCommand(thumbnailCommand);
};

/**
 * Convert the image using the matted strategy
 */
Thumbnailer.prototype.matted = function() {
	var qualityString = (this.quality ? '-quality ' + this.quality : ''),
		thumbnailCommand = config.get('convertCommand') + ' "' + this.localPaths[0] + '[0]" -thumbnail ' + (this.width * this.height) + '@ -gravity center -background ' + this.background + ' -extent ' + this.width + 'X' + this.height + ' ' + qualityString + ' ' + this.convertedPath;

	this.execCommand(thumbnailCommand);
};

/**
 * Convert the image using the bounded strategy
 */
Thumbnailer.prototype.bounded = function() {
	var dimensionsString = this.width + 'X' + this.height,
		qualityString = (this.quality ? '-quality ' + this.quality + ' ' : ''),
		thumbnailCommand = config.get('convertCommand') + ' "' + this.localPaths[0] + '[0]" -thumbnail ' + dimensionsString + ' ' + qualityString + this.convertedPath;

	this.execCommand(thumbnailCommand);
};

/**
 * Convert the image using the fill strategy
 */
Thumbnailer.prototype.fill = function() {
	var dimensionsString = this.width + 'X' + this.height,
		qualityString = (this.quality ? '-quality ' + this.quality : ''),
		thumbnailCommand = config.get('convertCommand') + ' "' + this.localPaths[0] + '[0]" -resize ' + dimensionsString + '^ -gravity center -extent ' + dimensionsString + ' ' + qualityString + ' ' + this.convertedPath;

	this.execCommand(thumbnailCommand);
};

exports.Thumbnailer = Thumbnailer;
