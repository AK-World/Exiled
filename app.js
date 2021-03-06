/**
 * Main file
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * This is the main Pokemon Showdown app, and the file you should be
 * running to start Pokemon Showdown if you're using it normally.
 *
 * This file sets up our SockJS server, which handles communication
 * between users and your server, and also sets up globals. You can
 * see details in their corresponding files, but here's an overview:
 *
 * Users - from users.js
 *
 *   Most of the communication with users happens in users.js, we just
 *   forward messages between the sockets.js and users.js.
 *
 * Rooms - from rooms.js
 *
 *   Every chat room and battle is a room, and what they do is done in
 *   rooms.js. There's also a global room which every user is in, and
 *   handles miscellaneous things like welcoming the user.
 *
 * Dex - from sim/dex.js
 *
 *   Handles getting data about Pokemon, items, etc.
 *
 * Ladders - from ladders.js and ladders-remote.js
 *
 *   Handles Elo rating tracking for players.
 *
 * Chat - from chat.js
 *
 *   Handles chat and parses chat commands like /me and /ban
 *
 * Sockets - from sockets.js
 *
 *   Used to abstract out network connections. sockets.js handles
 *   the actual server and connection set-up.
 *
 * @license MIT license
 */

'use strict';

// Check for version and dependencies
try {
	// I've gotten enough reports by people who don't use the launch
	// script that this is worth repeating here
	eval('{ let a = async () => {}; }');
} catch (e) {
	throw new Error("We require Node.js version 8 or later; you're using " + process.version);
}
try {
	require.resolve('sockjs');
} catch (e) {
	throw new Error("Dependencies are unmet; run node pokemon-showdown before launching Pokemon Showdown again.");
}

const FS = require('./fs');
const fs = require('fs');

/*********************************************************
 * Load configuration
 *********************************************************/

try {
	require.resolve('./config/config');
} catch (err) {
	if (err.code !== 'MODULE_NOT_FOUND') throw err; // should never happen
	throw new Error('config.js does not exist; run node pokemon-showdown to set up the default config file before launching Pokemon Showdown again.');
}

global.Config = require('./config/config');

global.Monitor = require('./monitor');

if (Config.watchconfig) {
	let configPath = require.resolve('./config/config');
	FS(configPath).onModify(() => {
		try {
			delete require.cache[configPath];
			global.Config = require('./config/config');
			if (global.Users) Users.cacheGroupData();
			Monitor.notice('Reloaded config/config.js');
		} catch (e) {
			Monitor.adminlog(`Error reloading config/config.js: ${e.stack}`);
		}
	});
}

/*********************************************************
 * Set up most of our globals
 *********************************************************/

global.Server = {};

global.Dex = require('./sim/dex');
global.toId = Dex.getId;

global.LoginServer = require('./loginserver');

global.Ladders = require(Config.remoteladder ? './ladders-remote' : './ladders');

global.Users = require('./users');

global.Punishments = require('./punishments');

global.Console = require('./console.js');

global.Chat = require('./chat');

global.Rooms = require('./rooms');

global.Tells = require('./tells');

global.Ontime = {};

global.forever = {};/*
global.Db = require('machdb')('mongodb://MusaddiqT:Musaddiq777@ds259105.mlab.com:59105/machadb');*/

global.Db = require('origindb')('mongodb://ClarkJ:Musaddiq777@impulsedb-shard-00-00-coe3y.mongodb.net:27017,impulsedb-shard-00-01-coe3y.mongodb.net:27017,impulsedb-shard-00-02-coe3y.mongodb.net:27017/test?ssl=true&replicaSet=impulsedb-shard-0&authSource=admin', {adapter: 'mongo'});
/*global.Db = require('origindb')('config/db');*/

delete process.send; // in case we're a child process
global.Verifier = require('./verifier');
Verifier.PM.spawn();

global.Tournaments = require('./tournaments');

global.Dnsbl = require('./dnsbl');
Dnsbl.loadDatacenters();

if (Config.crashguard) {
	// graceful crash - allow current battles to finish before restarting
	process.on('uncaughtException', err => {
		let crashType = require('./crashlogger')(err, 'The main process');
		if (crashType === 'lockdown') {
			Rooms.global.startLockdown(err);
		} else {
			Rooms.global.reportCrash(err);
		}
	});
	process.on('unhandledRejection', err => {
		throw err;
	});
	process.on('exit', code => {
		let exitCodes = {
			1: 'Uncaught Fatal Exception',
			2: 'Misuse of shell builtins',
			3: 'Internal JavaScript Parse Error',
			4: 'Internal JavaScript Evaluation Failure',
			5: 'Fatal Error',
			6: 'Non-function Internal Exception Handler',
			7: 'Internal Exception Handler Run-Time Failure',
			8: 'Unused Error Code. Formerly used by nodejs. Sometimes indicate a uncaught exception',
			9: 'Invalid Argument',
			10: 'Internal JavaScript Run-Time Failure',
			11: 'A sysadmin forced an emergency exit',
			12: 'Invalid Debug Argument',
			130: 'Control-C via Terminal or Command Prompt',
		};
		if (code !== 0) {
			let exitInfo = 'Unused Error Code';
			if (exitCodes[code]) {
				exitInfo = exitCodes[code];
			} else if (code > 128) {
				exitInfo = 'Signal Exit';
			}
			console.log('');
			console.error('WARNING: Process exiting with code ' + code);
			console.error('Exit code details: ' + exitInfo + '.');
			console.error('Refer to https://github.com/nodejs/node-v0.x-archive/blob/master/doc/api/process.markdown#exit-codes for more details. The process will now exit.');
		}
	});
}

/*********************************************************
 * Start networking processes to be connected to
 *********************************************************/

global.Sockets = require('./sockets');

exports.listen = function (port, bindAddress, workerCount) {
	Sockets.listen(port, bindAddress, workerCount);
};

if (require.main === module) {
	// Launch the server directly when app.js is the main module. Otherwise,
	// in the case of app.js being imported as a module (e.g. unit tests),
	// postpone launching until app.listen() is called.
	let port;
	if (process.argv[2]) port = parseInt(process.argv[2]);
	Sockets.listen(port);
}

/*********************************************************
 * Set up our last global
 *********************************************************/

global.TeamValidatorAsync = require('./team-validator-async');
TeamValidatorAsync.PM.spawn();

fs.readFile('./logs/uptime.txt', function (err, uptime) {
	if (!err) global.uptimeRecord = parseInt(uptime, 10); // eslint-disable-line radix
	global.uptimeRecordInterval = setInterval(function () {
		if (global.uptimeRecord && process.uptime() <= global.uptimeRecord) return;
		global.uptimeRecord = process.uptime();
		fs.writeFile('./logs/uptime.txt', global.uptimeRecord.toFixed(0), false, () => {});
	}, 1 * 60 * 60 * 1000);
});

/*********************************************************
 * Start up the githubhook server
 ********************************************************/
require('./github');

/*********************************************************
 * Start up the REPL server
 *********************************************************/

require('./repl').start('app', cmd => eval(cmd));
