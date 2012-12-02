var _ = require("underscore"),
	exec = require('child_process').exec,
	tmp = require('tmp'),
	fs = require('fs');

function Thumbnailer(opts) {
	_.extend(this, {
		background: 'black',
		tmp_dir: (process.env.TMP_DIR || '/tmp'),
		strategy: 'matted'
	}, opts);
}

Thumbnailer.prototype.thumbnail = function(localPath, w, h, callback) {
	var extension = localPath.split('.').pop(),
		_this = this;

	tmp.file({dir: this.tmp_dir, postfix: ".jpg"}, function(err, convertedPath, fd) {

		if (err) {
			callback(err);
			return;
		}

		_this[_this.strategy](localPath, convertedPath, w, h, callback)
	});
};

Thumbnailer.prototype.matted = function(localPath, convertedPath, w, h, callback) {
	var thumbnailCommand = 'convert "' + localPath + '" -thumbnail ' + (w * h) + '@ -gravity center -background ' + this.background + ' -extent ' + w + 'X' + h + ' ' + convertedPath,
		_this = this;
	
	_this.execCommand(thumbnailCommand, convertedPath, callback);
};

Thumbnailer.prototype.execCommand = function(command, convertedPath, callback) {
	exec(command, function(err, stdout, stderr) {
		
		console.log('running command ', command);

		if (err) {
			console.log(err);
			callback(err);
			return;
		}
		
		// make sure the conversion was successful.
		fs.stat(convertedPath, function(err, stat) {
			err = err || stat.size === 0 ? 'zero byte thumbnail created' : null;
			if (err) {
				callback(err);
				return;
			}
			callback(null, convertedPath);
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