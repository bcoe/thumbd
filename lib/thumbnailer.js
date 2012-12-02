var _ = require("underscore"),
	exec = require('child_process').exec,
	tmp = require('tmp'),
	fs = require('fs');

function Thumbnailer(opts) {
	_.extend(this, {
		tmp_dir: (process.env.TMP_DIR || '/tmp')
	}, opts);
}

Thumbnailer.prototype.thumbnail = function(opts, onComplete) {
	var _this = this;

	// parameters for a single execution
	// of the thumbnailer.
	_.extend(this, {
		width: -1,
		height: -1,
		localPath: null,
		background: 'black',
		strategy: 'matted',
		onComplete: onComplete
	}, opts)

	this.createConversionPath(function(err) {

		if (err) {
			_this.onComplete(err);
			return;
		}

		// apply the thumbnail creation strategy.
		_this[_this.strategy]()
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

Thumbnailer.prototype.dimensions = function(localPath, callback) {
	var dimensionsCommand = 'identify -format \'{"width": %w, "height": %h}\' ' + localPath;
	
	exec(dimensionsCommand, function(err, stdout, stderr) {			
		
		if (err) {
			console.log(err);
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