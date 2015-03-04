var _ = require('lodash');

exports.Config = {
	config: {
		awsKey: process.env.AWS_KEY,
		awsRegion: process.env.AWS_REGION || "us-east-1",
		awsSecret: process.env.AWS_SECRET,
		convertCommand: (process.env.CONVERT_COMMAND || 'convert'),
		requestTimeout: (process.env.REQUEST_TIMEOUT || 15000),
		s3Acl: (process.env.S3_ACL || 'private'),
		s3Bucket: process.env.BUCKET,
		s3StorageClass: (process.env.S3_STORAGE_CLASS || 'STANDARD'),
		sqsQueue: process.env.SQS_QUEUE,
		tmpDir: (process.env.TMP_DIR || '/tmp'),
		logLevel: (process.env.LOG_LEVEL || 'info'),
		profile: !!process.env.PROFILE,
		metaPrefix:(process.env.META_PREFIX || 'x-amz-meta-'),
		keepMeta:(process.env.META || true)
	},

	/**
	 * Extend the default configuration settings
	 *
	 * @param object opts The new configration settings
	 *
	 * @return Config
	 */
	extend: function (opts) {
		this.config = _.extend(this.config, opts);
		return this;
	},

	/**
	 * Get all config settings
	 *
	 * @return object
	 */
	all: function () {
		return this.config;
	},

	/**
	 * Get a config value
	 *
	 * @param string name The config variable name
	 *
	 * @return mixed or null if not set
	 */
	get: function (name) {
		if (this.config[name] !== undefined) return this.config[name];
		return null;
	},

	/**
	 * Add or update a config setting
	 *
	 * @param string name The config variable name
	 * @param mixed value The value
	 *
	 * @return Config
	 */
	set: function (name, value) {
		this.config[name] = value;
		return this;
	},

	/**
	 * Remove a config variable
	 *
	 * @param string name The config variable name
	 *
	 * @return Config
	 */
	remove: function (name) {
		if (this.config[name] !== undefined) {
			delete this.config[name];
		}
		return this;
	}
};
