var lastLog = ''

exports.info = exports.warn = exports.error = function () {
  lastLog = Array.prototype.join.call(arguments, ' ')
}

exports.__getLastLog = function () {
  return lastLog
}
