'use strict';

var fs = require('fs');
var spawn = require('child_process').spawn;
var approvals = require('approvals');

function statFile (filePath){
    try{
        fs.statSync(filePath);
        return true;
    } catch (e) {
        return false;
    }
}

function writeFileIfNoStat (filePath) {
    if(!statFile(filePath)) {
        fs.writeFile(filePath, '', { encoding: 'utf8' });
    }
}

function BeyondCompare () {}

BeyondCompare.prototype = {
    name: 'BeyondCompare4',
    canReportOn: function () { return true },
    report: function (approvedPath, receivedPath) {
        var windowsPath = '/Program Files/Beyond Compare 4/bcompare.exe';
        var bcompareCommand = statFile(windowsPath) ? windowsPath : 'bcomp';
        var opts = [ receivedPath, approvedPath ];

        writeFileIfNoStat(approvedPath);

        spawn(bcompareCommand, opts, { detached: true });
    }
};

var approvalsConfig = {
  reporters:  [ new BeyondCompare() ],
  normalizeLineEndingsTo: '\n', // default
  appendEOL: true,
  EOL:  require('os').EOL,
  errorOnStaleApprovedFiles: true,
  stripBOM: false
};

approvals.configure(approvalsConfig);
approvals.mocha('./test/approvals');
