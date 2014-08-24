var exec = require('child_process').exec,
	sprintf = require('sprintf-js').sprintf,
	_ = require('lodash/dist/lodash.underscore'),
	fs = require('fs'),
	config = require('./config').Config;

/**
 * Initialize the Thumbnailer
 */
function Thumbnailer(opts) {
	// for the benefit of testing
	// perform dependency injection.
	_.extend(this, {
		tmp: require('tmp'),
		logger: require('./logger')
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

	// Convert single path to array
	if (!_.isArray(localPaths)) {
		localPaths = [localPaths];
	}

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
		command: (description.command || config.get('convertCommand')),
		onComplete: onComplete,
		thumbnailTimeout: 20000
	});

	this.createConversionPath(function(err) {

		if (err) {
			_this.onComplete(err);
			return;
		}

		var strategy = _this._guessStrategy();
		if (strategy) _this[strategy]();
	});
};

/**
 * Choose an appropriate image manipulation
 * strategy, based on 'strategy' key in job.
 * If the strategy contains, %(command)s, assume
 * manual strategy:
 *
 * "%(command)s -border 0 -tile 3x1 -geometry 160x106 "%(localPaths[0])s" "%(localPaths[1])s" "%(localPaths[2])s" -quality 90 %(convertedPath)s"
 *
 * @return string strategy to execute.
 * @throw strategy not found.
 */
Thumbnailer.prototype._guessStrategy = function() {
	if (this.strategy.match(/%\(.*\)s/)) {
		return 'manual'
	} else if (!this[this.strategy]) {
		this.onComplete(Error('could not find strategy ' + this.strategy));
	} else {
		return this.strategy;
	}
}

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

		_this.logger.info('running command ', command);

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
 * Convert the image using the manual strategy.
 * looks for a strategy of the form:
 *
 * "%(command)s -border 0 -tile 3x1 -geometry 160x106 '%(localPath[0])s' '%(localPath[1])s' '%(localPath[2])s' -quality 90 %(convertedPath)s
 *
 * The custom strategy has access to all variables set on
 * the thumbnailer instance:
 *   * command: the conversion command to run.
 *   * localPaths: the local temp images to apply operation to.
 *   * convertedPath: path to store final thumbnail to on S3.
 */
Thumbnailer.prototype.manual = function() {
	try {
		var thumbnailCommand = sprintf(this.strategy, this);
	} catch (err) {
		this.onComplete(err);
	}

	this.execCommand(thumbnailCommand);
};

/**
 * Convert the image using the matted strategy
 */
Thumbnailer.prototype.matted = function() {
	var dimensionsString = this.width + 'X' + this.height,
	  qualityString = (this.quality ? '-quality ' + this.quality : ''),
		thumbnailCommand = config.get('convertCommand') + ' "' + this.localPaths[0] + '[0]" -resize ' + dimensionsString + ' -size ' + dimensionsString + ' xc:' + this.background + ' +swap -gravity center' + qualityString + ' -composite ' + this.convertedPath;

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

/**
 * Convert the image using the strict strategy
 */
Thumbnailer.prototype.strict = function() {
	var dimensionsString = this.width + 'X' + this.height,
		qualityString = (this.quality ? '-quality ' + this.quality : ''),
		thumbnailCommand = config.get('convertCommand') + ' "' + this.localPaths[0] + '[0]" -resize ' + dimensionsString + '! ' + qualityString + ' ' + this.convertedPath;

	this.execCommand(thumbnailCommand);
};

exports.Thumbnailer = Thumbnailer;
