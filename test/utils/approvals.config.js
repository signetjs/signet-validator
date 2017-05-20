'use strict';

var fs = require('fs');
var spawn = require('child_process').spawn;
var approvals = require('approvals');

var approvalsConfig = {
  reporters:  ['kdiff3'],
  normalizeLineEndingsTo: '\n', // default
  appendEOL: true,
  EOL:  require('os').EOL,
  errorOnStaleApprovedFiles: true,
  stripBOM: false
};

approvals.configure(approvalsConfig);
approvals.mocha('./test/approvals');
