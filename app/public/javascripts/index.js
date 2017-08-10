var App = function (options){

	var nes;

	var Models= {};
	var Collections = {};
	var Views = {};
	var router;

	var nesGameViews = [];

	var polling = false;
	var timestamps = {};


	var audioContext = new AudioContext();

	var init = function (){
		initBackbone();
		initGamepads();
	};

	var getGamepadId = function (gamepad) {
		var id = gamepad.index + '-' + gamepad.id.replace(/  +/g, ' ').replace(/\s/g, '-');
		return id;
	};


	var initGamepads = function () {
		// check if gamepads are already connected:
		var gamepads = navigator.getGamepads();

		// filter out gamepads that are null (can happen when gamepad was disconnected):
		gamepads = _.filter(gamepads, function (gamepad) {
			if(gamepad !== null) return gamepad;
		});


		console.log(gamepads.length + ' gamepads already connected');

		for (var i = 0; i < gamepads.length; i++) {
			onNewGamepad(gamepads[i]);
		};

		// listen for new gamepads:
		window.addEventListener("gamepadconnected", function (event) {
			console.log('gamepad just connected:', event.gamepad.id);
			onNewGamepad(event.gamepad);
		});

		// listen for disconnected gamepads:
		window.addEventListener("gamepaddisconnected", function (event) {
			console.log('gamepad disconnected:', event.gamepad.id);
		});
	};


	var onNewGamepad = function (gamepad) {
		var gamepadId = getGamepadId(gamepad);
		console.log('> onNewGamepad:', gamepadId);

		// transform buttons into collection of Buttons:
		var buttonsCollection = new Collections.Buttons();
		for (var i = 0; i < gamepad.buttons.length; i++) {
			var button = gamepad.buttons[i];
			button.id = i;
			buttonsCollection.add(button);
		};

		// transform axes into collection of Axes:
		var axesCollection = new Collections.Axes();
		for (var i = 0; i < gamepad.axes.length; i++) {
			var axisValue = gamepad.axes[i];
			axesCollection.add({id: i, value: axisValue});
		};


		// build game Model:
		var gamepadModel = new Models.Gamepad({
			id: gamepadId,
			mapping: gamepad.mapping,
			connected: gamepad.connected,
			buttons: buttonsCollection,
			axes: axesCollection
		});

		// add it to the collection fo gamepad Models;
		Collections.gamepads.add(gamepadModel);


		// save timestamp and start polling if not already polling:
		timestamps[gamepadId] = gamepad.timestamp;
		if(!polling) {
			polling = true;
			window.requestAnimationFrame(pollGamepads);
		}


		$('.nogamepads').hide();
	};

	var pollGamepads = function () {
		var gamepads = navigator.getGamepads();
		for (var i = gamepads.length - 1; i >= 0; i--) {
			if(!gamepads[i]) continue; // gamepad could be null

			var gamepad = gamepads[i];
			var gamepadId = getGamepadId(gamepad);

			if(gamepad.timestamp != timestamps[gamepadId]) {
				timestamps[gamepadId] = gamepad.timestamp;
				onGamepadUpdate(gamepad);
			}
		};

		if(polling) {
			window.requestAnimationFrame(pollGamepads);
		}
	};

	var onGamepadUpdate = function (gamepad) {
		var gamepadId = getGamepadId(gamepad);
		// fetch Backbone gamepad model:
		var gamepadModel = Collections.gamepads.get(gamepadId);
		if(!gamepadModel) return;

		// update button models:
		for (var i = 0; i < gamepad.buttons.length; i++) {
			var id = i;
			var buttonModel = gamepadModel.get('buttons').get(id);
			buttonModel.set(gamepad.buttons[i]);
		};

		// update axis models:
		for (var i = 0; i < gamepad.axes.length; i++) {
			var id = i;
			var axisModel = gamepadModel.get('axes').get(id);
			axisModel.set({value: gamepad.axes[i]});
		};

		// update the rest of the gamepad model:
		gamepadModel.set({mapping: gamepad.mapping, connected: gamepad.connected});
	};








	/// BACKBONE STUFF /////

	var initBackbone = function() {
		Collections.gamepads = new Collections.Gamepads();
		window.gamepads = Collections.gamepads;


		Collections.gamepads.on('add', function (model, collection) {
			// console.log('add', model.toJSON());

			// add game view when new gamepad is connected:
			var nesGameView = new Views.NesGame({model: model});
			nesGameView.render();
			$('.content').append( nesGameView.el );
			nesGameViews.push(nesGameView); // store reference for later
		});


		Collections.gamepads.on('change:connected', function (gamepad, connected) {
			console.log('gamepad_connected_changed', connected); //doesnt seem to change in Chrome
		});

	};


	var resetAndPlayAll = function() {
		for (var i = nesGameViews.length - 1; i >= 0; i--) {
			nesGameViews[i].resetAndPlay();
		};
	};

	Views.NesGame = Backbone.View.extend({
		className: 'nesgame',
		template: '#nesgame-template',

		jsnes: null, // reference to jsnes emulator

		nesKeys: { // keys mapped by jnes
			A: 88,
			B: 90,
			select: 17,
			start: 13,
			up: 38,
			down: 40,
			left: 37,
			right: 39
		},

		isPressed: {
			left: false,
			right: false,
			up: false,
			down: false
		},

		initialize: function (options) {
			this.listenTo(this.model.get('axes'), 'change:value', this.axis_changed);
			this.listenTo(this.model.get('buttons'), 'change:value', this.button_changed);
		},

		render: function (){
			var html = $(this.template).tmpl(this.model.toJSON());
			this.$el.html(html);

			// make sure you have NES loaded before touching this.jsnes
			this.jsnes = this.loadNes();

			this.enableGameSound();

			this.fetchBytes('/local-roms/Super Mario Bros.nes', function (bytes) {
				// don't worry, this refers back to this Backbone view
				this.jsnes.loadRom(bytes);
				this.jsnes.start();
			});



			return this;
		},


		loadNes: function () {
			var canvas = this.$('canvas.nescanvas');

			// define custom jsnes UI 'Class':
			var CustomUI = function () {

				// attention: the variable 'this' refers to the instance of CustomUI() created by JSNES.
				//            not to the Backbone View

				this.resetCanvas = function() {
					this.canvasContext.fillStyle = 'black';
					// set alpha to opaque
					this.canvasContext.fillRect(0, 0, 256, 240);

					// Set alpha
					for (var i = 3; i < this.canvasImageData.data.length-3; i += 4) {
						this.canvasImageData.data[i] = 0xFF;
					}
				};

				this.updateStatus = function(s) {
					if(s.match(/^Running\: .+? FPS$/)) return; // exclude fps messages
					// console.log(s);
				};

				this.writeAudio = function(samples) {
					// using the browsers audio API:
					var floatsLeft = new Float32Array(samples.length/2);
					var floatsRight = new Float32Array(samples.length/2);

					for (var i = samples.length - 1; i >= 0; i--) {
						if(i%2 == 0)
							floatsLeft[i/2] = samples[i] / 32768;
						else
							floatsRight[(i-1)/2] = samples[i] / 32768;
					};

					var audioBuffer = audioContext.createBuffer(2, samples.length/2, audioContext.sampleRate)
					var bufferSource = audioContext.createBufferSource();

					audioBuffer.getChannelData(0).set(floatsLeft);
					audioBuffer.getChannelData(1).set(floatsRight);

					bufferSource.buffer = audioBuffer;
					bufferSource.connect(audioContext.destination);
					bufferSource.start(0);
				};

				this.writeFrame = function(buffer, prevBuffer) {
					var imageData = this.canvasImageData.data;
					var pixel, i, j;

					for (i=0; i<256*240; i++) {
						pixel = buffer[i];

						if (pixel != prevBuffer[i]) {
							j = i*4;
							imageData[j] = pixel & 0xFF;
							imageData[j+1] = (pixel >> 8) & 0xFF;
							imageData[j+2] = (pixel >> 16) & 0xFF;
							prevBuffer[i] = pixel;
						}
					}

					this.canvasContext.putImageData(this.canvasImageData, 0, 0);
				};
			};

			// load JSNES
			var jsnes = new JSNES({ui: CustomUI});

			// initialize:
			if (!canvas[0].getContext) return console.log("Your browser doesn't support the <code>&lt;canvas&gt;</code> tag.");

			jsnes.ui.canvasContext = canvas[0].getContext('2d');

			if (!jsnes.ui.canvasContext.getImageData) return console.log("Your browser doesn't support writing pixels directly to the <code>&lt;canvas&gt;</code> tag.");

			jsnes.ui.canvasImageData = jsnes.ui.canvasContext.getImageData(0, 0, 256, 240);
			jsnes.ui.resetCanvas();

			return jsnes;
		},

		resetNesGame: function () {
			this.jsnes.reloadRom();
			this.jsnes.start();
		},

		enableGameSound: function () {
			this.jsnes.opts.emulateSound = true;
		},

		disableGameSound: function () {
			this.jsnes.opts.emulateSound = false;
		},

		freezeGame: function () {
			if (this.jsnes.isRunning) {
				this.jsnes.stop();
			}
		},

		unfreezeGame: function () {
			this.jsnes.start();
		},

		fetchBytes: function (url, callback) {
			var self = this;
			$.ajax({
				url: escape(url),
				xhr: function() {
					var xhr = $.ajaxSettings.xhr();
					if (typeof xhr.overrideMimeType !== 'undefined') {
						// Download as binary
						xhr.overrideMimeType('text/plain; charset=x-user-defined');
					}
					return xhr;
				},
				complete: function(xhr, status) {
					var bytes = xhr.responseText;
					callback.call(self, bytes); // make sure the 'this' variable refers back to this Backbone View
				}
			});
		},

		axis_changed: function (axis, value) {
			// console.log('axis changed', axis.toJSON());

			var id = axis.id;
			var value = Math.round(axis.get('value')); // sometimes it's like -0.003921568393707275, which should be 0


			if(id == 0 && value == -1) {
				this.isPressed.left = true;
				this.sendNesKey(this.nesKeys.left, true);

				// cancel right if that is still pressed:
				if(this.isPressed.right) {
					this.isPressed.right = false;
					this.sendNesKey(this.nesKeys.right, false);
				}
			}

			if(id == 0 && value == 1) {
				this.isPressed.right = true;
				this.sendNesKey(this.nesKeys.right, true);

				// cancel left if that is still pressed:
				if(this.isPressed.left) {
					this.isPressed.left = false;
					this.sendNesKey(this.nesKeys.left, false);
				}
			}

			if(id == 0 && value == 0) {
				// something is release, but we don't know what
				if(this.isPressed.left) {
					this.isPressed.left = false;
					this.sendNesKey(this.nesKeys.left, false);
				}

				if(this.isPressed.right) {
					this.isPressed.right = false;
					this.sendNesKey(this.nesKeys.right, false);
				}
			}

			if(id == 1 && value == -1) {
				this.isPressed.up = true;
				this.sendNesKey(this.nesKeys.up, true);

				// cancel down if that is still pressed:
				if(this.isPressed.down) {
					this.isPressed.down = false;
					this.sendNesKey(this.nesKeys.down, false);
				}
			}

			if(id == 1 && value == 1) {
				this.isPressed.down = true;
				this.sendNesKey(this.nesKeys.down, true);

				// cancel up if that is still pressed:
				if(this.isPressed.up) {
					this.isPressed.up = false;
					this.sendNesKey(this.nesKeys.up, false);
				}
			}

			if(id == 1 && value == 0) {
				// something is release, but we don't know what
				if(this.isPressed.up) {
					this.isPressed.up = false;
					this.sendNesKey(this.nesKeys.up, false);
				}

				if(this.isPressed.down) {
					this.isPressed.down = false;
					this.sendNesKey(this.nesKeys.down, false);
				}
			}
		},




		button_changed: function (button, value) {
			console.log('button changed', button.toJSON());


			var id = button.id;
			var isPressed = button.get('pressed');

			switch(id) {
				case 14:
				this.sendNesKey(this.nesKeys.left, isPressed);
				break;

				case 15:
				this.sendNesKey(this.nesKeys.right, isPressed);
				break;

				case 12:
				this.sendNesKey(this.nesKeys.up, isPressed);
				break;

				case 13:
				this.sendNesKey(this.nesKeys.down, isPressed);
				break;

				case 8:
				case 10:
				this.sendNesKey(this.nesKeys.select, isPressed);
				break;

				case 9:
				case 11:
				// this.sendNesKey(this.nesKeys.start, isPressed);
				return resetAndPlayAll();
				break;

				case 1:
				case 2:
				case 3:
				this.sendNesKey(this.nesKeys.A, isPressed);
				break;

				case 0:
				this.sendNesKey(this.nesKeys.B, isPressed);
				break;

				case 4:
				case 6:
				case 5:
				case 7:
				return resetAndPlayAll();

			}
		},

		sendNesKey: function (neskey, isPressed) {
			// console.log(neskey, isPressed?'pressed':'released');
			// build a key event like it came from the keyboard:
			var keyEvent = {
				preventDefault: function () {},
				keyCode: neskey
			};

			// send it to jsnes:
			if(isPressed) {
				this.jsnes.keyboard.keyDown(keyEvent);
			}else{
				this.jsnes.keyboard.keyUp(keyEvent);
			}
		},


		resetAndPlay: function () {
			this.resetNesGame();

			// send START it to jsnes:
			var self = this;
			setTimeout(function () {
				var keyEvent = {
					preventDefault: function () {},
					keyCode: self.nesKeys.start
				};

				self.jsnes.keyboard.keyDown(keyEvent);
				setTimeout(function () {
					self.jsnes.keyboard.keyUp(keyEvent);
				},300);
			}, 1000);

		}
	});



	Models.Gamepad = Backbone.Model.extend({
	});

	Collections.Gamepads = Backbone.Collection.extend({
		model : Models.Gamepad
	});

	Models.Button = Backbone.Model.extend({
	});

	Collections.Buttons = Backbone.Collection.extend({
		model : Models.Button,
	});

	Models.Axis = Backbone.Model.extend({
	});

	Collections.Axes = Backbone.Collection.extend({
		model : Models.Axis,
	});

	return {
		init: init
	};
};



$(function(){
	var app = new App();
	app.init();
});

