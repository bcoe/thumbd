#!/usr/bin/env node

var thumbd = require('../lib'),
	_ = require('underscore'),
	fs = require('fs'),
	opt = require('optimist')
		.option('k', {
			alias: 'aws_key',
			description: 'AWS key id',
			required: true
		})
		.option('s', {
			alias: 'aws_secret',
			required: true,
			description: 'AWS key secret'
		})
		.option('e', {
			alias: 'aws_region',
			description: 'AWS Region'
		})
		.option('q', {
			alias: 'sqs_queue',
			required: true,
			description: 'AWS SQS queue'
		})
		.option('b', {
			alias: 'bucket',
			required: true,
			description: 'AWS S3 bucket'
		})
		.option('t', {
			alias: 'tmp_dir',
			description: 'temporary directory for image conversion'
		})
		.option('v', {
			alias: 'convert_command',
			description: 'convert command to use'
		})
		.option('a', {
			alias: 's3_acl',
			description: 'default S3 ACL'
		})
		.option('o', {
			alias: 's3_storage_class',
			description: 'S3 storage class'
		})
		.option('r', {
			alias: 'remote_image',
			description: 'path to image on S3 (used by thumbnail command)'
		})
		.option('d', {
			alias: 'descriptions',
			description: 'path to JSON manifest describing thumbnail conversions (used by thumbnail command)'
		})
		.option('p', {
			alias: 'profile',
			type: 'boolean',
			description: 'start thumbd with profiler running'
		})
		.option('l', {
			alias: 'log_level',
			description: 'set log level (info|warn|error|silent)'
		})
		.usage(
			"Usage: thumbd <command>\n\n" +
			"where <command> is one of:\n\n" +
			"\tthumbd server\t\tstart a thumbnailing server\n" +
			"\tthumbd thumbnail\tgiven S3 path and description, thumbnail an image\n" +
			"\tthumbd install\t\tinstall thumbd as OS service\n" +
			"\tthumbd start\t\tstart the thumbd service\n" +
			"\tthumbd stop\t\tstart the thumbd service\n" +
			"\tthumbd restart\t\tstart the thumbd service\n" +
			"\tthumbd remove\t\tremove the thumbd service"
		),
	argv = opt.argv,
	mode = argv._.shift(),
	config = require('../lib/config').Config,
	serverOpts = {
		aws_key: 'awsKey',
		aws_secret: 'awsSecret',
		aws_region: 'awsRegion',
		bucket: 's3Bucket',
		convert_command: 'convertCommand',
		s3_acl: 's3Acl',
		s3_storage_class: 's3StorageClass',
		sqs_queue: 'sqsQueue',
		tmp_dir: 'tmpDir',
		log_level: 'logLevel'
	},
	thumbnailOpts = {
		aws_key: 'awsKey',
		aws_secret: 'awsSecret',
		aws_region: 'awsRegion',
		descriptions: 'descriptions',
		remote_image: 'remoteImage',
		sqs_queue: 'sqsQueue',
		bucket: 's3Bucket',
		log_level: 'logLevel'
	},
	ndm = require('ndm')('thumbd');

// make console output nicer for missing arguments.
process.on('uncaughtException', function(err) {
	var logger = require('../lib/logger');
	logger.error(err.message);
});

/**
 * Extract the command line parameters
 *
 * @param object keys A mapping of cli option => config key names
 *
 * @return object
 */
function buildOpts(keys) {
	var opts = {};
	var pairs = _.pairs(keys);
	for (var i in pairs) {
		var argvKey = pairs[i][0];
		var envKey = argvKey.toUpperCase();
		var configKey = pairs[i][1];
		opts[configKey] = argv[argvKey] || config.get(configKey);
		if (!opts[configKey]) {
			throw Error("The environment variable '" + envKey + "', or command line parameter '--" + argvKey + "' must be set.");
		}
	}
	return opts;
}

switch (mode) {
	case 'server':

		var opts = buildOpts(serverOpts);
		config.extend(opts);

		var grabber = new thumbd.Grabber();
		var saver = new thumbd.Saver();
		var thumbnailer = new thumbd.Thumbnailer();

		(new thumbd.Worker({
			thumbnailer: thumbnailer,
			saver: saver,
			grabber: grabber
		})).start();
		break;

	case 'thumbnail':

		var opts = buildOpts(thumbnailOpts),
			client = new thumbd.Client(),
			extraOpts = {};

		// allow region/bucket to vary on a job by job basis.
		if (argv.bucket) extraOpts.bucket = argv.bucket;
		if (argv.region) extraOpts.region = argv.region;

		config.extend(opts);

		var logger = require('../lib/logger');

		client.thumbnail(
			opts.remoteImage,
			JSON.parse(fs.readFileSync(opts.descriptions).toString()),
			extraOpts,
			function(err, res) {
				if (err) {
					logger.error(err);
				} else {
					logger.info(res);
				}
			}
		);
		break;
  case 'install':
    ndm.install();
    break;
  case 'remove':
    ndm.remove();
    break;
  case 'start':
    ndm.start();
    break;
  case 'restart':
    ndm.restart();
    break;
  case 'stop':
    ndm.stop();
    break;
  case 'list-scripts':
    ndm.listScripts();
    break;
  case 'run-script':
    ndm.runScript();
    break;
	default:
		console.log(opt.help());
}

// start a profiling server.
if (config.get('profile')) require('look').start(process.env.PORT || 5959);
