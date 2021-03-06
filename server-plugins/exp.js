'use strict';

/**
 * EXP SYSTEM FOR POKEMON SHOWDOWN
 * By Volco, modified by Insist
 */

const DEFAULT_AMOUNT = 0;
let DOUBLE_XP = false;

function isExp(exp) {
	let numExp = Number(exp);
	if (isNaN(exp)) return "Must be a number.";
	if (String(exp).includes('.')) return "Cannot contain a decimal.";
	if (numExp < 1) return "Cannot be less than one EXP.";
	return numExp;
}
Server.isExp = isExp;

let EXP = Server.EXP = {
	readExp: function (userid, callback) {
		userid = toId(userid);

		let amount = Db('exp').get(userid, DEFAULT_AMOUNT);
		if (typeof callback !== 'function') {
			return amount;
		} else {
			return callback(amount);
		}
	},

	writeExp: function (userid, amount, callback) {
		// In case someone forgot to turn `userid` into an actual ID...
		userid = toId(userid);

		// In case someone forgot to make sure `amount` was a Number...
		amount = Number(amount);
		if (isNaN(amount)) {
			throw new Error("EXP.writeExp: Expected amount parameter to be a Number, instead received " + typeof amount);
		}
		let curTotal = Db('exp').get(userid, DEFAULT_AMOUNT);
		Db('exp').set(userid, curTotal + amount);
		let newTotal = Db('exp').get(userid);
		if (callback && typeof callback === 'function') {
			// If a callback is specified, return `newTotal` through the callback.
			return callback(newTotal);
		}
	},
};

function addExp(user, room, amount) {
	if (!user || !room) return;
	user = Users(toId(user));
	if (Db('expoff').get(user.userid)) return false;
	if (DOUBLE_XP) amount = amount * 2;
	EXP.readExp(user.userid, totalExp => {
		let oldLevel = Server.level(user.userid);
		EXP.writeExp(user.userid, amount, newTotal => {
			let level = Server.level(user.userid);
			if (oldLevel < level) {
				let reward = '';
				switch (level) {
				case 5:
					Economy.logTransaction(user.userid + ' received a custom symbol for reaching level ' + level + '.');
					user.canCustomSymbol = true;
					reward = 'a Custom Symbol. To claim your custom symbol, use the command /customsymbol [symbol]';
					break;
				case 10:
					Economy.logTransaction(user.userid + ' received a custom avatar for reaching level ' + level + '.');
					Monitor.log(user.name + ' has reached Level ' + level + ' and earned a Custom Avatar.');
					reward = 'a Custom Avatar. To claim your avatar, please PM a Global Voice or higher to set your avatar.';
					break;
				case 15:
					Economy.logTransaction(user.userid + ' received a custom title for reaching level ' + level + '.');
					Monitor.log(user.name + ' has reached Level ' + level + ' and earned a Profile Title.');
					reward = 'a Profile Title. To claim your profile title, please PM a Global Driver or higher to set your Profile Title.';
					break;
				case 20:
					Economy.logTransaction(user.userid + ' received a custom icon for reaching level ' + level + '.');
					Monitor.log(user.name + ' has reached Level ' + level + ' and earned a Custom Icon.');
					reward = 'a Custom Userlist Icon. To claim your icon, please PM a Global Driver or higher to set your Custom Icon.';
					break;
				case 25:
					Economy.logTransaction(user.userid + ' received a emote for reaching level ' + level + '.');
					Monitor.log(user.name + ' has reached Level ' + level + ' and earned a Custom Emoticon.');
					reward = 'an Emote. To claim your emote, use the command please PM a Global Driver or higher to set your Custom Emoticon.';
					break;
				case 30:
					Economy.logTransaction(user.userid + ' received a custom color for reaching level ' + level + '.');
					Monitor.log(user.name + ' has reached Level ' + level + ' and earned a Custom Color.');
					reward = 'a Custom Color. To claim your custom color, use the command please PM a Global Driver or higher to set your Custom Color.';
					break;
				case 35:
					Economy.writeMoney(user.userid, 50);
					reward = '50 ' + moneyPlural + '.';
					break;
				case 40:
					Economy.logTransaction(user.userid + ' received a chatroom for reaching level ' + level + '.');
					Server.messageSeniorStaff(user.userid + ' has earned a chatroom for reaching level ' + level + '!');
					reward = 'a Chatroom. To claim your chatroom, Contact a Leader (&) or Administrator (~).';
					break;
				default:
					Economy.writeMoney(user.userid, Math.ceil(level * 0.5));
					reward = Math.ceil(level * 0.5) + ' ' + (Math.ceil(level * 0.5) === 1 ? moneyName : moneyPlural) + '.';
				}
				user.sendTo(room, '|html|<center><font size=4><strong><i>Level Up!</i></strong></font><br />' +
				'You have reached level ' + level + ', and have earned ' + reward + '</strong></center>');
			}
		});
	});
}
Server.addExp = addExp;

function level(userid) {
	userid = toId(userid);
	let curExp = Db('exp').get(userid, 0);
	let benchmarks = [0, 40, 90, 165, 250, 400, 600, 810, 1250, 1740, 2450, 3300, 4400, 5550, 6740, 8120, 9630, 11370, 13290, 15520, 18050, 23000, 28000, 33720, 39900, 46440, 52690, 58000, 63600, 69250, 75070, 81170, 87470, 93970, 100810, 107890, 115270, 122960, 131080, 140000];
	for (let i = 0; i < benchmarks.length; i++) {
		if (curExp >= benchmarks[i]) {
			continue;
		} else {
			return i;
		}
	}
	return benchmarks.length;
}
Server.level = level;

function nextLevel(user) {
	let curExp = Db('exp').get(user, 0);
	let benchmarks = [0, 40, 90, 165, 250, 400, 600, 810, 1250, 1740, 2450, 3300, 4400, 5550, 6740, 8120, 9630, 11370, 13290, 15520, 18050, 23000, 28000, 33720, 39900, 46440, 52690, 58000, 63600, 69250, 75070, 81170, 87470, 93970, 100810, 107890, 115270, 122960, 131080, 140000];
	for (let i = 0; i < benchmarks.length; i++) {
		if (curExp >= benchmarks[i]) {
			continue;
		} else {
			return benchmarks[i] - curExp + " exp";
		}
	}
	return "[Cannot level up]";
}
Server.nextLevel = nextLevel;

exports.commands = {
	'!exp': true,
	level: 'exp',
	xp: 'exp',
	exp: function (target, room, user) {
		if (!this.runBroadcast()) return;
		if (!target) target = user.name;

		const targetId = toId(target);

		EXP.readExp(targetId, exp => {
			this.sendReplyBox(Server.nameColor(targetId, true) + ' has ' + exp + ' exp and is level ' + Server.level(targetId) + ' and needs ' + Server.nextLevel(targetId) + ' to reach the next level.');
		});
	},

	givexp: 'giveexp',
	giveexp: function (target, room, user) {
		if (!this.can('hotpatch')) return false;
		if (!target || target.indexOf(',') < 0) return this.parse('/help giveexp');

		let parts = target.split(',');
		let username = parts[0];
		let uid = toId(username);
		let amount = isExp(parts[1]);

		if (amount > 1000) return this.sendReply("You cannot give more than 1,000 exp at a time.");
		if (username.length >= 19) return this.sendReply("Usernames are required to be less than 19 characters long.");
		if (typeof amount === 'string') return this.errorReply(amount);
		if (!Users.get(username)) return this.errorReply("The target user could not be found");


		Server.addExp(uid, this.room, amount);
		this.sendReply(uid + " has received " + amount + ((amount === 1) ? " exp." : " exp."));
	},
	giveexphelp: ["/giveexp [user], [amount] - Gives a user a certain amount of exp."],

	resetexp: 'resetxp',
	confirmresetexp: 'resetxp',
	resetxp: function (target, room, user, conection, cmd) {
		if (!target) return this.errorReply('USAGE: /resetxp (USER)');
		let parts = target.split(',');
		let targetUser = parts[0].toLowerCase().trim();
		if (!this.can('hotpatch')) return false;
		if (cmd !== 'confirmresetexp') {
			return this.popupReply('|html|<center><button name="send" value="/confirmresetexp ' + targetUser + '"style="background-color:red;height:300px;width:150px"><strong><font color="white" size=3>Confirm XP reset of ' + Server.nameColor(targetUser, true) + '; this is only to be used in emergencies, cannot be undone!</font></strong></button>');
		}
		Db('exp').set(toId(target), 0);
		if (Users.get(target)) Users.get(target).popup('Your XP was reset by an Administrator. This cannot be undone and nobody below the rank of Administrator can assist you or answer questions about this.');
		user.popup("|html|You have reset the XP of " + Server.nameColor(targetUser, true) + ".");
		Monitor.adminlog('[EXP Monitor] ' + user.name + ' has reset the XP of ' + target);
		room.update();
	},

	doublexp: 'doubleexp',
	doubleexp: function (target, room, user) {
		if (!this.can('hotpatch')) return;
		DOUBLE_XP = !DOUBLE_XP;
		Rooms.rooms.forEach((curRoom, id) => {
			if (id !== 'global') curRoom.addRaw('<div class="broadcast-' + (DOUBLE_XP ? 'green' : 'red') + '"><strong>Double XP is turned ' + (DOUBLE_XP ? 'on! You will now ' : 'off! You will no longer ') + 'receive double XP.</strong></div>').update();
		});
		return this.sendReply('Double XP was turned ' + (DOUBLE_XP ? 'ON' : 'OFF') + '.');
	},

	expon: function (target, room, user) {
		Db('expoff').delete(user.userid);
		this.sendReply("You are no longer exempt from exp.");
	},

	expoff: function (target, room, user) {
		Db('expoff').set(user.userid, true);
		this.sendReply("You are now exempt from exp.");
	},

	'!xpladder': true,
	expladder: 'xpladder',
	xpladder: function (target, room, user) {
		if (!target) target = 100;
		target = Number(target);
		if (isNaN(target)) target = 100;
		if (!this.runBroadcast()) return;
		let keys = Db('exp').keys().map(name => {
			return {name: name, exp: Db('exp').get(name)};
		});
		if (!keys.length) return this.sendReplyBox("EXP Ladder is empty.");
		keys.sort(function (a, b) { return b.exp - a.exp; });
		this.sendReplyBox(rankLadder('Exp Ladder', "EXP", keys.slice(0, target), 'exp') + '</div>');
	},

	exphelp: [
		"/exp [user] - Displays the user's exp; defaults to your username.",
		"/expladder - Displays the user's rankings, according to their amount of exp.",
		"/giveexp [user], [amount] - Gives a specified amount of exp to the user.",
		"/takeexp [user], [amount] - Takes a specified amount of exp from the user.",
		"/expoff - Turns off gaining exp for yourself.",
		"/expon - Turns on gaining exp for yourself.",
		"/doubleexp [ON/OFF] - Makes every text message worth double exp.",
		"/resetexp [user] - Resets a user's exp to 0.",
	],
};
