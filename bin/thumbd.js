#!/usr/bin/env node

var thumbd = require('../lib')
var _ = require('lodash')
var fs = require('fs')
var yargs = require('yargs')
    .option('k', {
      alias: 'aws_key',
      description: 'AWS key id',
      required: true,
      default: process.env.AWS_KEY
    })
    .option('s', {
      alias: 'aws_secret',
      required: true,
      description: 'AWS key secret',
      default: process.env.AWS_SECRET
    })
    .option('e', {
      alias: 'aws_region',
      description: 'AWS Region',
      default: process.env.AWS_REGION
    })
    .option('image_region', {
      description: 'region of S3 image, if it differes from the default AWS_REGION'
    })
    .option('q', {
      alias: 'sqs_queue',
      required: true,
      description: 'AWS SQS queue',
      default: process.env.SQS_QUEUE
    })
    .option('b', {
      alias: 'bucket',
      required: true,
      description: 'AWS S3 bucket',
      default: process.env.BUCKET
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
    .option('c', {
      alias: 'custom_logger',
      description: 'path to custom logger'
    })
    .usage('Usage: $0 <command>')
    .command('server', 'start a thumbnailing server')
    .command('thumbnail', 'given S3 path and description, thumbnail an image')
    .command('install', 'install thumbd as OS service wrapper')
    .command('start', 'start the thumbd service')
    .command('stop', 'stop the thumbd service')
    .command('restart', 'restart the thumbd service')
    .command('remove', 'remove the thumbd service')
    .help('h')
    .alias('h', 'help')
var argv = yargs.argv
var mode = argv._.shift()
var config = require('../lib/config').Config
var serverOpts = {
  aws_key: 'awsKey',
  aws_secret: 'awsSecret',
  aws_region: 'awsRegion',
  bucket: 's3Bucket',
  convert_command: 'convertCommand',
  s3_acl: 's3Acl',
  s3_storage_class: 's3StorageClass',
  sqs_queue: 'sqsQueue',
  tmp_dir: 'tmpDir',
  log_level: 'logLevel',
  custom_logger: 'logger',
  profile: 'profile'
}
var thumbnailOpts = {
  aws_key: 'awsKey',
  aws_secret: 'awsSecret',
  aws_region: 'awsRegion',
  descriptions: 'descriptions',
  remote_image: 'remoteImage',
  sqs_queue: 'sqsQueue',
  bucket: 's3Bucket',
  log_level: 'logLevel',
  custom_logger: 'logger'
}
var ndm = require('ndm')('thumbd')
var opts = null

// make console output nicer for missing arguments.
process.on('uncaughtException', function (err) {
  var logger = require(config.get('logger'))
  logger.error(err.message)
})

/**
 * Extract the command line parameters
 *
 * @param object keys A mapping of cli option => config key names
 *
 * @return object
 */
function buildOpts (keys) {
  var opts = {}
  var pairs = _.pairs(keys)
  for (var i in pairs) {
    var argvKey = pairs[i][0]
    var envKey = argvKey.toUpperCase()
    var configKey = pairs[i][1]
    opts[configKey] = argv[argvKey] || config.get(configKey)
    if (opts[configKey] === null) {
      throw Error("The environment variable '" + envKey + "', or command line parameter '--" + argvKey + "' must be set.")
    }
  }
  return opts
}

switch (mode) {
  case 'server':

    opts = buildOpts(serverOpts)
    config.extend(opts)

    var grabber = new thumbd.Grabber()
    var saver = new thumbd.Saver();(new thumbd.Worker({
      saver: saver,
      grabber: grabber
    })).start()
    break

  case 'thumbnail':

    opts = buildOpts(thumbnailOpts)
    var extraOpts = {}

    // allow region/bucket to vary on a job by job basis.
    if (argv.bucket) extraOpts.bucket = argv.bucket
    if (argv.aws_region) extraOpts.region = argv.aws_region
    if (argv.image_region) extraOpts.region = argv.image_region

    config.extend(opts)

    var client = new thumbd.Client()
    var logger = require(config.get('logger'))

    client.thumbnail(
      opts.remoteImage,
      JSON.parse(fs.readFileSync(opts.descriptions).toString()),
      extraOpts,
      function (err, res) {
        if (err) {
          logger.error(err)
        } else {
          logger.info(res)
        }
      }
    )
    break
  case 'install':
    ndm.install()
    break
  case 'remove':
    ndm.remove()
    break
  case 'start':
    ndm.start()
    break
  case 'restart':
    ndm.restart()
    break
  case 'stop':
    ndm.stop()
    break
  case 'list-scripts':
    ndm.listScripts()
    break
  case 'run-script':
    ndm.runScript()
    break
  default:
    yargs.showHelp()
}

// start a profiling server.
if (config.get('profile')) require('look').start(process.env.PORT || 5959)
