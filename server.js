
// This file enables continuous deployment - it is not needed  by the Kurve app

var http = require('http');
var restify = require('restify');

var port = process.env.PORT || 8000;
var server = restify.createServer();

server.use(restify.gzipResponse());
server.use(restify.queryParser());

server.get('/', function (req,res,next) {
    res.redirect('./public/index.html', next);
});

server.get(/\/public\/?.*/, restify.serveStatic({
    directory: __dirname,
    default: 'index.html'
}));

server.listen(port, function() {
    console.log('%s listening at %s', server.name, server.url);
});
