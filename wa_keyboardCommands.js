"use strict";

const keyEscape = 27;
const keyQ = 'Q'.charCodeAt(0);

const bindings = {
	/*[keyEscape]: () => chrome.app.window.current().close(),
	[keyQ]: () => chrome.app.window.current().close()
	*/
};

document.addEventListener('DOMContentLoaded', function() {
	let elements = document.querySelectorAll('[shortcut-key]');

	for (let elem of elements) {
		let key = elem.getAttribute('shortcut-key').toUpperCase().charCodeAt(0);
		bindings[key] = {
			'func': function() {
				elem.dispatchEvent(new Event('click'));
			},
			'ctrlKey': elem.getAttribute('ctrlKey') === 'true'
		};
	}
});

$(document).keydown(function(e){
	console.error(e);
	var bind = bindings[e.keyCode];
	if (bind && bind.ctrlKey === e.ctrlKey)
		bind.func();
	//console.error(elem);
});

/*
window.addEventListener('keydown', function(e) {
	if (bindings[e.keyCode])
		bindings[e.keyCode]();
});
*/
