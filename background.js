chrome.app.runtime.onLaunched.addListener(function() {
	chrome.app.window.create('record.html', {
		'id': 'record.html',
		'outerBounds': {
			'width': 700,
			'height': 500
		}
	});
});

/*chrome.commands.onCommand.addListener(function(command){
	record = chrome.app.window.get('record.html');
	if (command === "reload"){
		view = record.document.getElementById('wa_webview');
		error.log(view);
		view.reload();
	}
});
*/
let presencePort = null;

chrome.runtime.onConnect.addListener(function(port) {
	console.assert(port.name == 'presenceUpdates');
	console.log('Recording began');

	window.presencePort = port;
	port.onDisconnect.addListener(function() {
		presencePort = null;
	});

	rdb = openDatabase();

	///// Processing presence updates /////

	function time() {
		return parseInt((new Date()).getTime() / 1000);
	}

	let t = time();
	let recordingTime = {
		startTime: t,
		endTime: t
	};

	port.onMessage.addListener(function(presenceMsg) {
		rdb.get(function(db) {
			let transaction = db.transaction(['recordingTimes', 'presenceUpdates'], 'readwrite');
			transaction.objectStore('recordingTimes')
				.put(recordingTime);
			transaction.objectStore('presenceUpdates')
				.add(presenceMsg);

			console.log(presenceMsg);
		});
	});

	let lastRun = time();

	let detectSleepId = setInterval(function() {
		let now = time();

		if (now - lastRun > 15) {
			console.log('Waking from sleep');

			rdb.get(function(db) {
				db.transaction('recordingTimes', 'readwrite')
					.objectStore('recordingTimes')
					.put(recordingTime);
			});

			recordingTime.startTime = now;
			recordingTime.endTime = now;
		}

		recordingTime.endTime = now;
		lastRun = now;
	}, 1000);

	///// Closing the database /////

	port.onDisconnect.addListener(function() {
		clearInterval(detectSleepId);

		rdb.get(function(db) {
			db.transaction('recordingTimes', 'readwrite')
				.objectStore('recordingTimes')
				.put(recordingTime);
			db.close();

			console.log('Recording ended');
		});
	});
});

chrome.runtime.onMessage.addListener(function(message) {
	console.assert(message.type == 'wa_contacts');
	let contacts = message.value;

	console.log('Recieved contact list:', contacts);

	openDatabase().get(function(db) {
		let store = db.transaction('contacts', 'readwrite')
			.objectStore('contacts');

		for (let i = 0; i < contacts.length; i++) {
			store.put(contacts[i]);
		}
	});
});

function openDatabase() {
	let rdb = new SmartDBConnection('OnlineTimes', 1);
	rdb.onupgradedatabase = function upgradeDatabase(db, oldVersion) {
		console.log('Upgrading database from version', oldVersion);
		db.createObjectStore('contacts', {'keyPath': 'id'});
		db.createObjectStore('recordingTimes', {'keyPath': 'startTime'});
		db.createObjectStore('presenceUpdates', {'autoIncrement': true});
	};
	return rdb;
}

function SmartDBConnection(name, version) {
	this.onupgradedatabase = null;

	let db = null;
	let waitingRequests = [];

	this.get = function(callback) {
		if (db) {
			callback(db);
		}
		else {
			waitingRequests.push(callback);
		}
	};

	{
		let request = window.indexedDB.open(name, version);
		let self = this;

		request.onupgradeneeded = function(event) {
			db = event.target.result;
			self.onupgradedatabase(db, event.oldVersion);
		};

		request.onsuccess = function(event) {
			db = event.target.result;
			waitingRequests.forEach(function(request) {
				request(db);
			});
			waitingRequests = null;
		};
	}
}

function getObjectStore(storeName, callback) {
	openDatabase().get(function(db) {
		let entries = [];

		db.transaction(storeName)
			.objectStore(storeName)
			.openCursor()
			.onsuccess = function(event) {
			let cursor = event.target.result;

			if (cursor) {
				entries.push(cursor.value);
				cursor.continue();
			}
			else {
				callback(entries);
			}
		};
	});
}

function getAllEntries(callback) {
	getObjectStore('presenceUpdates', callback);
}

function getRecordingTimes(callback) {
	getObjectStore('recordingTimes', callback);
}

function getContacts(callback) {
	openDatabase().get(function(db) {
		let entries = {};

		db.transaction('contacts')
			.objectStore('contacts')
			.openCursor()
			.onsuccess = function(event) {
			let cursor = event.target.result;
			if (cursor) {
				entries[cursor.key] = cursor.value;
				cursor.continue();
			}
			else {
				callback(entries);
			}
		};
	});
}
