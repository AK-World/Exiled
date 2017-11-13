'use strict';

const fs = require('fs');

let symbolColors = {};

function load() {
	fs.readFile('config/symbolcolors.json', 'utf8', function (err, file) {
		if (err) return;
		customColors = JSON.parse(file);
	});
}
setInterval(function () {
	load();
}, 500);

function updateColor() {
	fs.writeFileSync('config/symbolcolors.json', JSON.stringify(symbolColors));

	let newCss = '/* Symbol Colors START */\n';

	for (let name in symbolColors) {
		newCss += generateCSS(name, symbolColors[name]);
	}
	newCss += '/* Symbol Colors END */\n';

	let file = fs.readFileSync('config/custom.css', 'utf8').split('\n');
	if (~file.indexOf('/* Symbol Colors START */')) file.splice(file.indexOf('/* Symbol Colors START */'), (file.indexOf('/* Symbol Colors END */') - file.indexOf('/* Symbol Colors START */')) + 1);
	fs.writeFileSync('config/custom.css', file.join('\n') + newCss);
	Server.reloadCSS();
}

function generateCSS(name, color) {
	let css = '';
	let rooms = [];
	name = toId(name);
	Rooms.rooms.forEach((curRoom, id) => {
		if (id === 'global' || curRoom.type !== 'chat' || curRoom.isPersonal) return;
		if (!isNaN(Number(id.charAt(0)))) return;
		rooms.push('#' + id + '-userlist-user-' + name + ' em.group');
	});
	css = rooms.join(', ');
	css += '{\ncolor: ' + color + ' !important;\n}\n';
	css += '.chat.chatmessage-' + name + ' em.group {\n';
	css += 'color: ' + color + ' !important;\n}\n';
	return css;
}

exports.commands = {
    symbolcolor: {
		set: function (target, room, user) {
			if (!this.can('lock')) return false;
			target = target.split(',');
			for (let u = 0; u < target.length; u++) target[u] = target[u].trim();
			if (!target[1]) return this.parse('/help symbolcolor');
			if (toId(target[0]).length > 19) return this.errorReply("Usernames are not this long...");

			this.sendReply("|raw|You have given <strong><font color=" + target[1] + ">" + Chat.escapeHTML(target[0]) + "</font></strong> a symbol color.");
			this.privateModCommand("(" + target[0] + " has recieved symbol color: '" + target[1] + "' from " + user.name + ".)");
      symbolColors[toId(target[0])] = target[1];
			updateColor();
		},
		delete: function (target, room, user) {
			if (!this.can('lock')) return false;
			if (!target) return this.parse('/help symbolcolor');
			if (!symbolColors[toId(target)]) return this.errorReply('/symbolcolor - ' + target + ' does not have a symbol color.');
			delete symbolColors[toId(target)];
			updateColor();
			this.sendReply("You removed " + target + "'s symbol color.");
			this.privateModCommand("(" + target + "'s symbol color was removed by " + user.name + ".)");
			if (Users(target) && Users(target).connected) Users(target).popup(user.name + " removed your symbol color.");
			return;
		},
		reload: function (target, room, user) {
			if (!this.can('hotpatch')) return false;
			updateColor();
			this.privateModCommand("(" + user.name + " has reloaded symbol colours.)");
		},
		'': function (target, room, user) {
			return this.parse("/help symbolcolor");
		},
	},
	symbolcolorhelp: [
		"Commands Include:",
		"/symbolcolor set [user], [hex] - Gives [user] a symbol color of [hex]",
		"/symbolcolor delete [user], delete - Deletes a user's symbol color",
		"/symbolcolor reload - Reloads symbol colours.",
	],
  };
