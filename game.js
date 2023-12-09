var board;
var players = [];
var currentMenu;
var turn = 0;
var hoverList = [];

let colorsToPick = [0, 1, 2, 3, 4, 5, 6, 7];

async function init() {
    fixCanvas();
    await loadImages();

    renderC.imageSmoothingEnabled = false;

    currentMenu = new MainMenu();
    update();
};

function exitGame() {
    setTimeout(e => {
        saveGame();
        board.boardPieces.forEach(e => e.hover = false);
        players.forEach(e => e.hover = false);
        board = undefined;
        players = [];
        currentMenu = new MainMenu();
        window.onbeforeunload = undefined;
    }, 100)
}

function startGame(playersToStartGameWith, settings) {
    if (currentMenu instanceof LobbyMenu) window.onbeforeunload = saveGame;
    board = currentMenu instanceof LobbyMenu ? new Board() : new OnlineBoard(currentMenu.hosting, currentMenu.peer);
    board.settings = settings;

    let colorsToPick = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    playersToStartGameWith.forEach(player => { if (player.color !== -1) colorsToPick.splice(colorsToPick.indexOf(player.color), 1) })

    let clientPlayers = []
    playersToStartGameWith.forEach((player, i) => {
        if (player.color != -1) {
            players.push(new Player(player.color, player.name, currentMenu instanceof LobbyMenu));
            clientPlayers.push({ name: player.name, color: player.color })
        } else {
            addRandomPlayer(player.name);
            clientPlayers.push({ name: player.name, color: players[players.length - 1].color })
        }
    })
    if (board.hosting) {
        for (let i = 1; i < clientPlayers.length; i++) {
            sendMessage(Object.values(board.peer.clients)[i - 1].connection, "startGame", { players: clientPlayers, settings: settings, index: i })
        }
        players[0].playing = true
    }
    else currentMenu = undefined
}

function addRandomPlayer(name, i) {
    let random = randomIntFromRange(0, colorsToPick.length - 1);
    players.push(new Player(colorsToPick[random], name, currentMenu instanceof LobbyMenu));
    colorsToPick.splice(random, 1);
}

async function saveGame() {
    if (!board || !players) { return }
    let games = JSON.parse(localStorage.getItem("games"));
    games = (games == null || games == undefined) ? [] : games;

    let game = {
        board: JSON.prune(board),
        saveVersion: latestSaveVersion,
        players: players.map(e => JSON.prune(e)),
        turn: turn,
        currentDay: new Date().today(),
        currentTime: new Date().timeNow(),
        screenshot: canvas.toDataURL(),
        currentMenu: { class: currentMenu?.constructor.name, value: JSON.prune(currentMenu) }
    };

    game.id = (board.id == undefined || board.id == null) ? (games.length === 0 ? 0 : JSON.parse(games[games.length - 1]).id + 1) : board.id;


    let tmpGame = JSON.prune(game);
    let tmp = false;
    games.forEach(function (e, i) {
        if (JSON.parse(e).id == game.id) {
            tmp = true;
            games[i] = tmpGame;
        }
    })
    if (tmp === false) {
        games.push(tmpGame);
    }

    localStorage.setItem("games", JSON.prune(games));

}

function loadGame(gameToload) {
    window.onbeforeunload = saveGame;
    currentMenu = undefined;
    board = new Board()
    Object.entries(JSON.parse(gameToload.board)).forEach(e => {
        if (typeof e[1] != "object") {
            board[e[0]] = e[1];
        };
    });
    board.id = gameToload.id;
    board.settings = JSON.parse(gameToload.board).settings;
    turn = gameToload.turn;

    let playersToLoad = gameToload.players.map(e => JSON.parse(e));

    playersToLoad.forEach((player, index) => {
        players.push(new Player(player.color, player.name));
    });
    board.boardPieces[0].playersOnBoardPiece.splice(0, 8);

    playersToLoad.forEach((player, index) => {
        board.boardPieces[(player.pos == 40 ? 10 : player.pos)].playersOnBoardPiece.push(players[index]);
        Object.entries(player).forEach(e => {
            if (typeof e[1] != "object") {
                players[index][e[0]] = e[1];
            }
        })
        player.ownedPlaces.forEach(place => {
            players[index].ownedPlaces.push(board.boardPieces[place.n])
            board.boardPieces[place.n].owner = players[index];
            board.boardPieces[place.n].level = place.level;
            board.boardPieces[place.n].mortgaged = place.mortgaged;
        })
    });

    let currentMenuClass = eval(gameToload.currentMenu.class);
    if (currentMenuClass) {
        let args = getClassContructorParams(currentMenuClass);
        let argsToInsert = [];
        args.forEach(e => {
            Object.entries(JSON.parse(gameToload.currentMenu.value)).forEach(b => {
                if (e.trim() == b[0]) { argsToInsert.push(b[1]); }
            })
        })
        currentMenu = applyToConstructor(currentMenuClass, argsToInsert);
        Object.entries(JSON.parse(gameToload.currentMenu.value)).forEach(e => {
            if (typeof e[1] != "object") {
                currentMenu[e[0]] = e[1];
            } else if (e[0] == "card") { currentMenu["card"] = e[1]; }
        });
    }

    if (board.playerIsWalkingTo) {
        players[turn].teleportTo(board.playerIsWalkingTo);
    }

}

function update() {
    requestAnimationFrame(update);

    renderC.clearRect(0, 0, renderCanvas.width, renderCanvas.height)
    c.clearRect(0, 0, canvas.width, canvas.height);

    textInputs.forEach(e => { e.htmlElement.style.display = "none" })

    board?.update();
    currentMenu?.draw();

    hoverList.forEach((e, i) => {
        c.font = 20 + "px " + "verdanai";
        c.drawText(e, Math.max(c.measureText(e).width / 2 + 5, mouse.x), mouse.y + 35 * (i + 1) - 10, 20, "center", "black", { color: "white", blur: 5 });
    })
    hoverList = [];

    c.drawText(fps, 5, 80, 20)

    renderC.drawImage(canvas, 0, 0, renderCanvas.width, renderCanvas.height);

    renderCanvas.style.cursor = (players.map(e => e.hover).includes(true) || board?.boardPieces.map(e => e.hover).includes(true) || buttons?.map(e => (e.hover && !e.disabled)).includes(true)) ? "pointer" : "auto"

    buttons.forEach(e => e.hover = false);
}
class MainMenu {
    constructor() {
        this.localButton = new Button({ x: 35, y: 160, w: 195, h: 52 }, images.buttons.local, function () { currentMenu = new LobbyMenu() });
        this.loadButton = new Button({ x: 35, y: 240, w: 195, h: 52 }, images.buttons.load, function () { currentMenu = new LoadGames() });
        this.onlineButton = new Button({ x: 35, y: 320, w: 195, h: 52 }, images.buttons.online, function () { currentMenu = new PublicGames() });
        this.creditsButton = new Button({ x: 35, y: 400, w: 195, h: 52 }, images.buttons.credits);
        this.fullScreenButton = new Button({ x: 0, y: canvas.height - 40, w: 40, h: 40, hoverText: "Fullskärm", selectButton: true }, images.buttons.fullscreen, function () {
            if (this.selected) {
                document.documentElement.requestFullscreen()
            } else {
                document.exitFullscreen()
            }
        });
        this.antiAliasingButton = new Button({ x: 40, y: canvas.height - 40, w: 40, h: 40, hoverText: "Antialiasing", selectButton: true }, images.buttons.antilising, function () {
            renderC.imageSmoothingEnabled = this.selected;
        });

    }
    draw() {
        c.drawImageFromSpriteSheet(images.menus.mainmenu)
        this.loadButton.disabled = (JSON.parse(localStorage.getItem("games")) == undefined || JSON.parse(localStorage.getItem("games")).length == 0);

        this.localButton.update();
        this.loadButton.update();
        this.onlineButton.update();
        this.creditsButton.update();
        this.fullScreenButton.update();
        this.antiAliasingButton.update();
        this.fullScreenButton.selected = document.fullscreenElement != null;
        this.antiAliasingButton.selected = renderC.imageSmoothingEnabled;
    }
}
class LoadGames {
    constructor() {
        let self = this;

        this.backButton = new Button({ x: 10, y: 10, w: 325, h: 60 }, images.buttons.back, function () { currentMenu = new MainMenu() });
        this.startButton = new Button({ x: canvas.width / 4 - 194 / 2, y: canvas.height - 70, w: 194, h: 60 }, images.buttons.start, function () {
            loadGame(self.games[self.gameButtons.indexOf(self.selected)])
        })

        this.deleteButton = new Button({ x: canvas.width / 4 + 194 / 2 + 20, y: canvas.height - 60, w: 40, h: 40, hoverText: "Radera sparfil" }, images.buttons.sellbutton, function () {
            let index = self.gameButtons.indexOf(self.selected);
            self.games.splice(index, 1);

            let tmpGames = self.games.map(e => JSON.prune(e));
            localStorage.setItem("games", JSON.prune(tmpGames.reverse()));
            self.init();
            if (self.games[index]) {
                self.gameButtons[index].selected = true;
                self.gameButtons[index].onClick();
            } else if (self.games[index - 1]) {
                self.gameButtons[index - 1].selected = true;
                self.gameButtons[index - 1].onClick();
            }
            if (JSON.parse(localStorage.getItem("games")).length == 0) {
                currentMenu = new MainMenu();
            }
        })

        this.image = new Image();
        this.selected = undefined;

        this.init()


    }
    init() {
        let self = this;
        this.games = JSON.parse(localStorage.getItem("games")).map(e => JSON.parse(e)).reverse();
        this.gameButtons = [];
        this.games.forEach((game, i) => {
            this.gameButtons.push(new Button({ x: 500, y: 10 + i * 50, w: 450, h: 40, text: game.currentDay + " " + game.currentTime, textSize: 30, selectButton: true }, images.buttons.saveselect, function () {
                self.gameButtons.forEach((e, index) => {
                    if (i != index) {
                        e.selected = false;
                    } else {
                        downscale(game.screenshot, canvas.width / 2, canvas.height / 2, { imageType: "png" }).then(function (dataURL) {
                            self.image.src = dataURL;
                        })
                    }
                })
            }));
        })
    }
    draw() {
        c.drawImageFromSpriteSheet(images.menus.lobbymenu);
        this.backButton.update();
        this.gameButtons.forEach(e => e.update());
        this.selected = this.gameButtons.filter(e => e.selected)[0];
        if (this.selected) {
            c.lineWidth = 2;
            c.strokeStyle = "black"
            c.strokeRect(0, canvas.height / 4 - 2, canvas.width / 2 + 2, canvas.height / 2 + 4)
            c.drawImage(this.image, 0, canvas.height / 4);
            c.drawText("Spelversion: " + latestSaveVersion, 10, 440, 20, "left", latestSaveVersion == this.games[this.gameButtons.indexOf(this.selected)].saveVersion ? "green" : "red")
            c.drawText("Sparfilsversion: " + this.games[this.gameButtons.indexOf(this.selected)].saveVersion, 10, 460, 20, "left", latestSaveVersion == this.games[this.gameButtons.indexOf(this.selected)].saveVersion ? "green" : "red")
        }
        this.startButton.disabled = !this.selected || JSON.parse(this.games[this.gameButtons.indexOf(this.selected)].board).done || !(latestSaveVersion == this.games[this.gameButtons.indexOf(this.selected)].saveVersion)
        this.deleteButton.disabled = !this.selected
        this.startButton.update();
        this.deleteButton.update();
    }
}
class PublicGames {
    constructor() {
        this.backButton = new Button({ x: 10, y: 10, w: 325, h: 60 }, images.buttons.back, function () { currentMenu = new MainMenu() });
        this.joinID = new TextInput({ x: 340, y: 10, w: 200, h: 60, maxLength: 6, textSize: 45, placeHolder: "ID" })
        this.joinButton = new Button({ x: 550, y: 10, w: 195, h: 60 }, images.buttons.joingame, () => { currentMenu = new OnlineLobby(false, this.joinID.value) });
        this.hostButton = new Button({ x: 750, y: 10, w: 195, h: 60 }, images.buttons.hostgame, function () { currentMenu = new OnlineLobby(true) });
    }
    draw() {
        c.drawImageFromSpriteSheet(images.menus.lobbymenu);
        this.joinButton.disabled = this.joinID.value?.length < 6;
        this.backButton.update();
        this.joinID.draw();
        this.joinButton.update();
        this.hostButton.update();
    }
}

/*
Buyhouse
Sellhouse

Prison

Auction
Trade
*/
class OnlineLobby {
    constructor(hosting, id) {
        this.hosting = hosting
        this.players = []
        this.settings = []

        if (this.hosting) {
            this.peer = createHost()
            this.initPlayers(8)
            this.startButton = new Button({ x: 10, y: canvas.height - 70, w: 194, h: 60 }, images.buttons.start, () => {
                let tmpPlayers = []
                for (let i = 0; i <= Object.entries(this.peer.clients).length; i++) {
                    let player = this.players[i]

                    tmpPlayers.push({
                        name: player.textInput.value,
                        color: player.selectedColor
                    })
                }

                let tmpSettings = {}
                this.settings.forEach((setting, i) => tmpSettings[settings[i].variable] = setting instanceof Button ? setting.selected : setting.value)
                startGame(tmpPlayers, tmpSettings)
                currentMenu = undefined
            })

            settings.forEach((setting, index,) => {
                let length = settings.length;
                if (setting.type == "select") {
                    this.settings.push(new Button({ x: 450, y: splitPoints(length, canvas.height, 35, index), w: 500, h: 35, selectButton: true, text: setting.title, textSize: c.getFontSize(setting.title, 470, 32), color: "black", disableDisabledTexture: true }, images.buttons.setting, () => sendPlayers(this.peer)));
                    this.settings[index].selected = setting.start;
                } else if (setting.type == "slider") {
                    this.settings.push(new Slider({ x: 450, y: splitPoints(length, canvas.height, 35, index), w: 500, h: 35, from: setting.from, to: setting.to, unit: setting.unit, steps: setting.steps, beginningText: setting.title }, () => sendPlayers(this.peer)))
                    this.settings[index].percentage = (-setting.from + setting.start) / (-setting.from + setting.to)
                    this.settings[index].value = setting.start
                }
            })
        } else {
            this.peer = connectToHost(id)
            this.initPlayers(1)
        }

        this.selectedColors = []
        this.backButton = new Button({ x: 10, y: 10, w: 325, h: 60 }, images.buttons.back, () => {
            if (this.hosting) Object.values(this.peer.clients).forEach(client => client.connection.close())
            else this.peer.connection.close()
            currentMenu = new PublicGames()
        })
        this.prev = -1
    }
    initPlayers(amount) {
        let self = this;
        let off = this.players.length
        for (let i = off; i < amount + off; i++) {
            this.players.push(
                {
                    textInput: new TextInput({ x: 10, y: 80 + 48 * i, w: 300, h: 45, maxLength: 15, textSize: 40 }),
                    colorButton: new Button({ x: 320, y: 82 + 48 * i, w: 40, h: 40, selectButton: true, disableSelectTexture: true, disableDisabledTexture: true }, images.playercolorbuttons.unselected, function () {
                        self.players.forEach((e, index) => {
                            if (index != i) { e.colorButton.selected = false; } else {
                                self.players.forEach((b) => {
                                    b.textInput.w = 300;
                                })
                                if (index >= 4) {
                                    self.currentMenu = e.colorButton.selected ? new ColorSelector(320 - 30 - 40, -62 + 48 * (i + 1), e, self.selectedColors) : undefined;

                                    if (self.currentMenu) {
                                        self.players[index - 1].textInput.w = 230;
                                        self.players[index - 2].textInput.w = 230;
                                    }
                                } else {
                                    self.currentMenu = e.colorButton.selected ? new ColorSelector(320 - 30 - 40, 82 + 48 * (i + 1), e, self.selectedColors) : undefined;

                                    if (self.currentMenu) {
                                        if (self.players[index + 1]) self.players[index + 1].textInput.w = 230;
                                        if (self.players[index + 2]) self.players[index + 2].textInput.w = 230;
                                    }
                                }
                            }
                        });
                    }),
                    selectedColor: -1
                }
            );
            let player = this.players[i]

            if (i !== 0) {
                player.textInput.htmlElement.disabled = true
                player.colorButton.disabled = true
                player.colorButton.disableDisabledTexture = true
                continue
            }

            player.textInput.htmlElement.style.backgroundColor = "white"
            player.textInput.htmlElement.oninput = () => {
                let text = player.textInput.htmlElement.value
                if (this.hosting) sendPlayers(this.peer, text)
                else sendMessage(currentMenu.peer.connection, "nameChange", text)
            }

            if (this.hosting) player.textInput.htmlElement.setAttribute("placeHolder", this.peer.id)

            player.confirmButton = new Button({
                x: 370,
                y: 82 + 48 * i,
                w: 40,
                h: 40
            }, images.buttons.yes, (wrong) => {
                if (!wrong && this.hosting) {
                    let [valid, name, reason] = validPlayer(player, player.textInput.value, player.selectedColor)
                    if (!valid) {
                        if (reason === "Color is already taken") player.selectedColor = -1
                        player.confirmButton.onClick(true)
                        alert(reason)
                    } else player.textInput.htmlElement.value = name
                }

                let text = player.textInput.htmlElement
                text.disabled = !text.disabled

                if (text.disabled) {
                    player.confirmButton.image = images.buttons.no
                    player.colorButton.disabled = true
                    text.style.backgroundColor = ''
                } else {
                    player.confirmButton.image = images.buttons.yes
                    player.colorButton.disabled = false
                    text.style.backgroundColor = 'white'
                }

                if (this.hosting) sendPlayers(this.peer, undefined, undefined, undefined, text.disabled)
                if (!wrong && !this.hosting) sendMessage(this.peer.connection, text.disabled ? "select" : "deselect", { name: text.value, color: player.selectedColor })
            })
        }
    }

    draw() {
        c.drawImageFromSpriteSheet(images.menus.lobbymenu);
        this.backButton.update();
        this.players.forEach(player => {
            player.textInput.draw();
            player.colorButton.image = images.playercolorbuttons[(player.selectedColor == -1 ? "unselected" : "playercolorbutton" + (player.selectedColor == 0 ? "" : player.selectedColor + 1))]
            if (self.currentMenu?.hover) {
                player.colorButton.draw();
                player.confirmButton?.draw()
            } else {
                player.colorButton.update();
                player.confirmButton?.update()
            }
            if (!(this.currentMenu instanceof ColorSelector)) player.kickButton?.update()
            else player.kickButton?.draw()
        })

        this.currentMenu?.draw()

        this.settings.forEach((setting, index) => {
            if (this.hosting && settings[index].needed) {
                setting.disabled = !this.settings[settings.map(e => e.variable).indexOf(settings[index].needed)].selected;
                setting.selected = !this.settings[settings.map(e => e.variable).indexOf(settings[index].needed)].selected ? false : setting.selected
            }
            setting.update()
        });

        if (!this.hosting) return

        this.startButton.disabled = Object.entries(this.peer.clients).length === 0 ||
            !this.players.every(player => player.textInput.htmlElement.style.backgroundColor === "")
        this.startButton.update();

        c.drawText("Id: " + this.peer.id, 250, canvas.height - 30, 30)
        if (detectCollision(240, canvas.height - 60, 180, 40, mouse.x, mouse.y, 1, 1)) {
            c.drawText("Id: " + this.peer.id, 250, canvas.height - 30, 30, "left", "blue")
            if (mouse.down) {
                mouse.down = false
                //navigator.clipboard.writeText(`${window.location.href}?lobbyId=${this.host.id}`)
                navigator.clipboard.writeText(this.peer.id)

                currentMenu.players[0].textInput.htmlElement.value = "Player 1" // TEMP
                setTimeout(() => { currentMenu.players[0].confirmButton.onClick() }, 100) // TEMP
            }
        }
    }
}
class LobbyMenu {
    constructor() {
        let self = this;

        this.backButton = new Button({ x: 10, y: 10, w: 325, h: 60 }, images.buttons.back, function () { currentMenu = new MainMenu() });
        this.startButton = new Button({ x: 10 + 100, y: canvas.height - 70, w: 194, h: 60 }, images.buttons.start, function () {
            let tmp = [];
            self.players.filter(e => e.textInput.value.length > 1).forEach(e => {
                tmp.push({
                    name: e.textInput.value,
                    color: e.selectedColor
                })
            })
            let tmpSettings = {};
            self.settings.forEach((setting, index) => {
                tmpSettings[settings[index].variable] = setting instanceof Button ? setting.selected : setting.value
            })
            startGame(tmp, tmpSettings);
            currentMenu = undefined;
        });
        this.settings = [];
        settings.forEach((setting, index,) => {
            let length = settings.length;
            if (setting.type == "select") {
                this.settings.push(new Button({ x: 450, y: splitPoints(length, canvas.height, 35, index), w: 500, h: 35, selectButton: true, text: setting.title, textSize: c.getFontSize(setting.title, 470, 32), color: "black", disableDisabledTexture: true }, images.buttons.setting));
                this.settings[index].selected = setting.start;
            } else if (setting.type == "slider") {
                this.settings.push(new Slider({ x: 450, y: splitPoints(length, canvas.height, 35, index), w: 500, h: 35, from: setting.from, to: setting.to, unit: setting.unit, steps: setting.steps, beginningText: setting.title }))
                this.settings[index].percentage = (-setting.from + setting.start) / (-setting.from + setting.to)
                this.settings[index].value = setting.start
            }
        })

        this.currentMenu = undefined;

        this.players = [];
        this.selectedColors = [];
        this.initPlayers();
    }
    initPlayers() {
        let self = this;
        for (let i = 0; i < 8; i++) {
            this.players.push(
                {
                    textInput: new TextInput({ x: 10, y: 80 + 48 * i, w: 300, h: 45, maxLength: 15, textSize: 40, placeHolder: "Spelare " + (i + 1) }),
                    colorButton: new Button({ x: 320, y: 82 + 48 * i, w: 40, h: 40, selectButton: true, disableSelectTexture: true }, images.playercolorbuttons.unselected, function () {
                        self.players.forEach((e, index) => {
                            if (index != i) { e.colorButton.selected = false; } else {
                                self.players.forEach((b) => {
                                    b.textInput.w = 300;
                                })
                                if (index >= 4) {
                                    self.currentMenu = e.colorButton.selected ? new ColorSelector(320 - 30 - 40, -62 + 48 * (i + 1), e, self.selectedColors) : undefined;

                                    if (self.currentMenu) {
                                        self.players[index - 1].textInput.w = 230;
                                        self.players[index - 2].textInput.w = 230;
                                    }
                                } else {
                                    self.currentMenu = e.colorButton.selected ? new ColorSelector(320 - 30 - 40, 82 + 48 * (i + 1), e, self.selectedColors) : undefined;

                                    if (self.currentMenu) {
                                        self.players[index + 1].textInput.w = 230;
                                        self.players[index + 2].textInput.w = 230;
                                    }
                                }
                            }
                        });
                    }),
                    selectedColor: -1,
                    botButton: new Button({ x: 370, y: 82 + 48 * i, w: 40, h: 40, selectButton: true }, images.buttons.bot)
                }
            );
        }
    }
    draw() {
        let self = this;
        c.drawImageFromSpriteSheet(images.menus.lobbymenu);
        this.backButton.update();
        this.selectedColors = this.players.map(e => e.selectedColor).filter(e => e != -1);
        this.players.forEach(player => {
            player.textInput.draw();
            player.colorButton.image = images.playercolorbuttons[(player.selectedColor == -1 ? "unselected" : "playercolorbutton" + (player.selectedColor == 0 ? "" : player.selectedColor + 1))]
            if (self.currentMenu?.hover) {
                player.colorButton.draw();
                player.botButton.draw();

            } else {
                player.colorButton.update();
                player.botButton.update();
            }
        })
        this.currentMenu?.draw();

        let readyPlayers = this.players.filter(e => e.textInput.value.length > 1);
        this.startButton.disabled = (readyPlayers.length < 2 || hasDuplicates(readyPlayers.map(e => e.textInput.value)))
        this.startButton.update();
        this.settings.forEach((setting, index) => {
            if (settings[index].needed) {
                setting.disabled = !this.settings[settings.map(e => e.variable).indexOf(settings[index].needed)].selected;
                setting.selected = !this.settings[settings.map(e => e.variable).indexOf(settings[index].needed)].selected ? false : setting.selected
            }
            setting.update()
        });

    }
}

class ColorSelector {
    constructor(x, y, player, selectedColors) {
        this.x = x;
        this.y = y;
        this.w = 180,
            this.h = 90;
        this.hover = false;
        this.selectedColors = selectedColors;

        this.player = player;
        this.initColors();
    }
    initColors() {
        let self = this;
        this.colorButtons = [];
        for (let i = 0; i < 8; i++) {
            this.colorButtons.push(new Button({ x: this.x + splitPoints(4, 180, 40, i % 4), y: this.y + splitPoints(2, 90, 40, Math.floor(i / 4)), w: 40, h: 40, selectButton: true }, images.playercolorbuttons["playercolorbutton" + (i == 0 ? "" : i + 1)], function () {
                let current
                self.colorButtons.forEach((e, index) => {
                    if (index != i) { e.selected = false } else {
                        if (e.selected) {
                            if (self.player.selectedColor != -1) {
                                self.selectedColors.splice(self.selectedColors.indexOf(self.player.selectedColor))
                            }
                            self.player.selectedColor = i;
                            self.selectedColors.push(i);
                            current = i
                        } else {
                            self.selectedColors.splice(self.selectedColors.indexOf(self.player.selectedColor))
                            self.player.selectedColor = -1;
                            current = -1
                        }
                    };
                    if (currentMenu.hosting) sendPlayers(currentMenu.peer)
                })
                self.colorButtons.forEach((e, index) => {
                    e.disabled = !e.selected && self.selectedColors?.length > 0 && (self.selectedColors?.indexOf(index) != -1)
                })

                if (currentMenu.hosting) sendMessageToAll("selectedColors", currentMenu.selectedColors)
                else sendMessage(currentMenu.peer.connection, "colorChange", current)
                currentMenu.prev = current
            }))
            this.colorButtons[i].disabled = !this.colorButtons[i].selected && this.selectedColors?.length > 0 && (this.selectedColors?.indexOf(i) != -1) && i !== this.player.selectedColor
            this.colorButtons[i].selected = i === this.player.selectedColor;
        }

    }
    draw() {
        this.hover = detectCollision(this.x, this.y, this.w, this.h, mouse.x, mouse.y, 1, 1)
        if (!this.hover && mouse.down) {
            mouse.down = false;
            currentMenu.players.forEach(e => { e.colorButton.selected = false; e.textInput.w = 300 });
            currentMenu.currentMenu = undefined;
        }
        c.fillStyle = "black";
        c.fillRect(this.x, this.y, this.w, this.h)
        this.colorButtons.forEach(e => e.update());
    }
}

class SmallMenu {
    constructor() {
        this.leaveButton = new Button({ x: canvas.width / 2 - 120 + splitPoints(5, 240, 40, 1), y: canvas.height / 2 + 25, w: 40, h: 40, hoverText: "Stäng ruta", invertedHitbox: { x: canvas.width / 2 - 128, y: canvas.height / 2 - 128, w: 256, h: 256 } }, images.buttons.no, function () { currentMenu = undefined });
        this.statButton = new Button({ x: canvas.width / 2 - 120 + splitPoints(5, 240, 40, 2), y: canvas.height / 2 + 25, w: 40, h: 40, hoverText: "Visa Statistik" }, images.buttons.statbutton);
        this.exitButton = new Button({ x: canvas.width / 2 - 120 + splitPoints(5, 240, 40, 3), y: canvas.height / 2 + 25, w: 40, h: 40, hoverText: "Återvänd till Huvudmenyn" }, images.buttons.yes, function () {
            if (currentMenu.constructor.name == "SmallMenu") currentMenu = undefined;
            exitGame();
        });
        this.antiAliasingButton = new Button({ x: canvas.width / 2 - 120 + splitPoints(5, 240, 40, 0), y: canvas.height / 2 + 75, w: 40, h: 40, hoverText: "Antialiasing", selectButton: true }, images.buttons.antilising, function () {
            renderC.imageSmoothingEnabled = this.selected;
        });
        this.fullScreenButton = new Button({ x: canvas.width / 2 - 120 + splitPoints(5, 240, 40, 1), y: canvas.height / 2 + 75, w: 40, h: 40, hoverText: "Fullskärm", selectButton: true }, images.buttons.fullscreen, function () {
            if (this.selected) {
                document.documentElement.requestFullscreen()
            } else {
                document.exitFullscreen()
            }
        });
        this.muteButton = new Button({ x: canvas.width / 2 - 120 + splitPoints(5, 240, 40, 4), y: canvas.height / 2 + 75, w: 40, h: 40, hoverText: "Tysta ljudet" }, images.buttons.music);

        this.volumeSlider = new Slider({ x: canvas.width / 2 - 120 + splitPoints(5, 240, 40, 2), y: canvas.height / 2 + 75, w: 88, h: 40, from: 0, to: 100, textSize: 25, unit: "%" })
    }
    draw() {
        c.drawImageFromSpriteSheet(images.menus.exitmenu, { x: canvas.width / 2 - 128, y: canvas.height / 2 - 128 })
        this.leaveButton.update();
        this.statButton.update();
        this.exitButton.update();
        this.antiAliasingButton.update();
        this.fullScreenButton.update();
        this.muteButton.update();
        this.volumeSlider.update();
        this.fullScreenButton.selected = document.fullscreenElement != null;
        this.antiAliasingButton.selected = renderC.imageSmoothingEnabled;

    }
}

class Board {
    constructor() {
        this.boardPieces = [];
        this.dices = new Dice();
        this.playerHasRolled = false;
        this.playerIsWalkingTo = false;
        this.done = false;
        this.money = 0;
        this.ready = true

        this.rollDiceButton = new Button({ x: canvas.width / 2 - 123, y: canvas.height / 2, w: 246, h: 60 }, images.buttons.rolldice, this.rollDice)
        this.nextPlayerButton = new Button({ x: canvas.width / 2 - 123, y: canvas.height / 2, w: 246, h: 60 }, images.buttons.nextplayer, this.nextPlayer);

        this.menuButton = new Button({ x: canvas.width / 2 - 40, y: canvas.height - 40, w: 80, h: 40 }, images.buttons.menu, function () { currentMenu = new SmallMenu() })

        this.init();
    }
    rollDice() {
        players[turn].rollDice();
        board.playerHasRolled = true;
    }
    nextPlayer() {
        players[turn].rolls = 0;
        turn++;
        turn %= players.length;
        if (players[turn].dead) {
            this.nextPlayer();
            return;
        };
        board.playerHasRolled = false;
        if (players[turn].inPrison && players[turn].playing) {
            currentMenu = new PrisonMenu();
        }
        readyUp();

    }
    getColorGroup(group) {
        return this.boardPieces.filter(e => e?.info?.group == group);
    }
    getTotalHousesAndHotelsInColorGroup(group) {
        let levels = board.boardPieces.filter(e => (e?.info?.group == group)).map(e => e.level)
        let houses = 0;
        let hotels = 0;
        levels.forEach(e => {
            if (e < 5) {
                houses += e;
            } else {
                hotels++;
            }
        })
        return { houses: houses, hotels: hotels }
    }
    getTotalHousesAndHotels() {
        let levels = board.boardPieces.filter(e => e?.info?.group).map(e => e.level)
        let houses = 0;
        let hotels = 0;
        levels.forEach(e => {
            if (e < 5) {
                houses += e;
            } else {
                hotels++;
            }
        })
        return { houses: houses, hotels: hotels }
    }
    init() {
        for (let n = 0; n < 40; n++) {
            if (n % 10 === 0) {
                this.boardPieces.push(new Corner(n))
            } else {
                if (pieces[n].price) {
                    if (pieces[n].type == "utility") {
                        this.boardPieces.push(new Utility(n))
                    } else if (pieces[n].type == "station") {
                        this.boardPieces.push(new Station(n))
                    } else {
                        this.boardPieces.push(new BuyableProperty(n))
                    }
                } else {
                    if (pieces[n].type == "community chest") {
                        this.boardPieces.push(new Community(n))
                    } else if (pieces[n].type == "chance") {
                        this.boardPieces.push(new Chance(n))
                    } else if (pieces[n].type == "income tax") {
                        this.boardPieces.push(new IncomeTax(n))
                    } else if (pieces[n].type == "supertax") {
                        this.boardPieces.push(new SuperTax(n))
                    } else {
                        this.boardPieces.push(new BoardPiece(n))
                    }
                }
            }
        }
        this.boardPieces.push(new Prison());
    }
    update() {
        if (players.filter(e => !e.dead).length == 1) {
            this.done = true;
            exitGame();
        }
        this.drawBack();
        this.boardPieces.forEach(e => e.draw());

        this.boardPieces.forEach(e => { if (e.owner && e.constructor.name == "BuyableProperty") e.drawHouses() })
        this.boardPieces.forEach(e => { if (e.hover) { hoverList.push(e.info.name + (e.owner !== undefined ? "(" + e.owner.name + ")" : "")) } });

        c.drawText("Just nu:" + players[turn].name, canvas.width / 2, 30, c.getFontSize("Just nu:" + players[turn].name, 240, 30), "center", players[turn].info.color)

        if (this.settings.giveAllTaxToParking) {
            c.drawText(this.money + "kr", canvas.width / 2, 60, 20, "center", "gold")
        }

        this.dices.draw();

        this.nextPlayerButton.disabled = players[turn].money < 0;


        if (this.dices.hidden && !currentMenu && (this.playerIsWalkingTo == false)) {
            this.menuButton.update();
            if (players[turn].playing && board.ready) {
                if (!this.playerHasRolled) {
                    this.rollDiceButton.update();
                } else {
                    this.nextPlayerButton.update();
                }
            }
        }

        for (let i = 20; i >= 0; i--) {
            if (i < 10) {
                board.boardPieces[i].playersOnBoardPiece.forEach(e => e.draw());
            } else {
                let length = board.boardPieces[i].playersOnBoardPiece.length - 1;
                for (let i2 = length; i2 >= 0; i2--) {
                    board.boardPieces[i].playersOnBoardPiece[i2].draw();
                }
            }
        }
        for (let i = 21; i < 40; i++) {
            if (i >= 30) {
                board.boardPieces[i].playersOnBoardPiece.forEach(e => e.draw());
            } else {
                let length = board.boardPieces[i].playersOnBoardPiece.length - 1;
                for (let i2 = length; i2 >= 0; i2--) {
                    board.boardPieces[i].playersOnBoardPiece[i2].draw();
                }
            }
        }

    }
    drawBack() {
        for (let x = -2; x < 2; x++) {
            for (let y = -2; y < 2; y++) {
                let coords = to_screen_coordinate(x, y)
                c.drawImageFromSpriteSheet(images.static.realbackground, { x: canvas.width / 2 + 832 * coords.x - 416, y: canvas.height / 2 + 832 * coords.y - 208 })
            }
        }
        c.drawImageFromSpriteSheet(images.static.insideboard, { x: canvas.width / 2 - 286, y: canvas.height / 2 - 143 })
    }
}

class OnlineBoard extends Board {
    constructor(hosting, peer) {
        super()
        this.hosting = hosting
        this.ready = true
        this.readyPlayers = 0
        this.peer = peer
        this.cardId

        this.rollDiceButton = new Button({ x: canvas.width / 2 - 123, y: canvas.height / 2, w: 246, h: 60 }, images.buttons.rolldice, () => {
            let dice1 = randomIntFromRange(2, 2)
            let dice2 = randomIntFromRange(2, 2)
            if (this.hosting) {
                resetReady()
                sendMessageToAll("throwDices", { dice1: dice1, dice2: dice2 })
                this.rollDice(dice1, dice2)
                board.cardId = randomIntFromRange(0, 1000000);
                sendMessageToAll("saveCardId", board.cardId);
            } else sendMessage(this.peer.connection, "requestDiceRoll")
        })
        this.nextPlayerButton = new Button({ x: canvas.width / 2 - 123, y: canvas.height / 2, w: 246, h: 60 }, images.buttons.nextplayer, () => {
            if (this.hosting) {
                resetReady()
                sendMessageToAll("nextPlayer")
                this.nextPlayer()
            } else sendMessage(this.peer.connection, "requestNextPlayer")
        });

    }
    rollDice(rigged1, rigged2) {
        players[turn].rollDice(rigged1, rigged2);
        board.playerHasRolled = true;
    }

    updateOnlineBoard() {

    }


}

class PrisonMenu {
    constructor() {
        this.payButton = new Button({ x: canvas.width / 2 - 138 + splitPoints(3, 276, 82, 0), y: canvas.height / 2 + 50, w: 82, h: 35 }, images.buttons.prisonpay, function (request = true) {
            if (request && board instanceof OnlineBoard) {
                if (board.hosting) {
                    sendMessageToAll("buyPrison")
                } else {
                    sendMessage(board.peer.connection, "requestBuyPrison")
                    return
                }
            }
            players[turn].money -= 50;
            board.money += board.settings.giveAllToParking ? 50 : 0;
            players[turn].getOutOfPrison();
            currentMenu = undefined;
        });
        this.rollDiceButton = new Button({ x: canvas.width / 2 - 138 + splitPoints(3, 276, 82, 1), y: canvas.height / 2 + 50, w: 82, h: 35 }, images.buttons.prisonrolldice, function (request = true, rigged1 = randomIntFromRange(1, 6), rigged2 = randomIntFromRange(1, 6)) {
            if (request && board instanceof OnlineBoard) {
                if (board.hosting) {
                    sendMessageToAll("rollPrison", { rigged1: rigged1, rigged2: rigged2 })
                } else {
                    sendMessage(board.peer.connection, "requestRollPrison")
                    return
                }
            }
            board.dices.roll(function (dice1, dice2) {
                if (dice1 == dice2) {
                    players[turn].getOutOfPrison();
                    players[turn].teleportTo(players[turn].pos + dice1 + dice2);
                } else {
                    board.playerHasRolled = true;
                    board.dices.hidden = true;
                    players[turn].rollsInPrison++;
                    if (players[turn].rollsInPrison == 3) {
                        players[turn].getOutOfPrison();
                        players[turn].rollsInPrison = 0;

                    }
                }
            }, rigged1, rigged2)
            currentMenu = undefined;
        });
        this.cardButton = new Button({ x: canvas.width / 2 - 138 + splitPoints(3, 276, 82, 2), y: canvas.height / 2 + 50, w: 82, h: 35 }, images.buttons.prisongetoutofjail, function () {
            if (request && board instanceof OnlineBoard) {
                if (board.hosting) {
                    sendMessageToAll("prisonCardPay")
                } else {
                    sendMessage(board.peer.connection, "requestPrisonCardPay")
                    return
                }
            }
            players[turn].getOutOfPrison();
            players[turn].prisonCards--;
            currentMenu = undefined;
        });
    }
    draw() {
        c.drawImageFromSpriteSheet(images.menus.prisonmenu, { x: canvas.width / 2 - 150, y: canvas.height / 2 + 5 })

        this.payButton.disabled = (players[turn].money < 50)
        this.cardButton.disabled = (players[turn].prisonCards == 0)

        this.payButton.update();
        this.rollDiceButton.update();
        this.cardButton.update();
    }
}

class Prison {
    constructor() {
        this.drawX = 128 * 4 + 60;
        this.drawY = 64 * 6 - 4;
        this.playersOnBoardPiece = [];
    }
    draw() { }
}

class BoardPiece {
    constructor(n) {
        this.n = n;
        this.info = pieces[n];
        this.playersOnBoardPiece = [];

        this.calculateDrawPos();
    }

    calculateDrawPos() {
        this.drawX = 0;
        this.drawY = 0;
        this.textureStart = 0;
        if (Math.floor(this.n / 10) === 0) {
            this.drawX = 128 * 9 - this.n * 64 + 94;
            this.drawY = 64 * 6 + 29;
            this.textureStart = 0;
        }
        if (Math.floor(this.n / 10) === 1) {
            this.drawX = 128 * 4 + 60;
            this.drawY = 64 * 6 - (this.n - 10) * 64 - 4;
            this.textureStart = 96 * 3;
            if (this.n % 10 == 0) {
                this.drawX -= 32;
                this.drawY += 32;
            }
        }
        if (Math.floor(this.n / 10) === 2) {
            this.drawX = 128 * 4 + (this.n - 20) * 64 + 94;
            this.drawY = 64 * 6 + 29 - 64 * 11;
            this.textureStart = 96;
            if (this.n % 10 == 0) {
                this.drawX -= 64;
            }
        }
        if (Math.floor(this.n / 10) === 3) {
            this.drawX = 128 * 4 + 60 + 64 * 11;
            this.drawY = - 64 * 4 + (this.n - 30) * 64 - 4;
            this.textureStart = 96 * 2;
            if (this.n % 10 == 0) {
                this.drawX -= 32;
                this.drawY -= 32;
            }
        }
    }

    draw() {
        let isometricMouse = { x: to_grid_coordinate(mouse.x, mouse.y).x, y: to_grid_coordinate(mouse.x, mouse.y).y }
        this.hover = (players[turn].playing && this.info.price && !currentMenu && board.dices.hidden && ((Math.floor(this.n / 10) === 0 || Math.floor(this.n / 10) === 2) && isometricMouse.x > this.drawX + 64 && isometricMouse.x < this.drawX + 128 && isometricMouse.y > this.drawY - 64 && isometricMouse.y < this.drawY + 64 ||
            (Math.floor(this.n / 10) === 1 || Math.floor(this.n / 10) === 3) && isometricMouse.x > this.drawX + 32 && isometricMouse.x < this.drawX + 128 + 32 && isometricMouse.y > this.drawY - 32 && isometricMouse.y < this.drawY + 32
        ));
        if (this.hover && mouse.down) {
            mouse.down = false;
            this.openCard();
        }

        let img = !this.mortgaged ? images.plates[this.info.img] : images.plates[this.info.mortgaged];
        c.drawIsometricImage(img, {
            x: this.drawX,
            y: this.drawY,
            w: 96,
            cropW: 96,
            cropX: this.textureStart,
            offsetY: (this.hover ? 1 : 0)
        })
        if (this.owner !== undefined) {
            c.drawIsometricImage(images.players[this.owner.info.ownedImg], {
                x: this.drawX + (Math.floor(this.n / 10) === 2 ? -12 : 0),
                y: this.drawY,
                w: 96,
                cropW: 96,
                cropX: this.textureStart,
                offsetY: (this.hover ? 1 : 0)
            })
        }
    }
}

class Corner extends BoardPiece {
    draw() {
        c.drawIsometricImage(images.corners[this.info.img], {
            x: this.drawX,
            y: this.drawY,
            w: 128,
            cropW: 128,
            cropX: 0,
            offsetY: (this.hover ? 1 : 0)
        })
    }
    step() {
        readyUp();
        if (this.n == 30) {
            currentMenu = new CardDraw("special", 0)
        }
        if (this.n == 20 && board.settings.giveAllTaxToParking) {
            players[turn].money += board.money;
            board.money = 0;
        }
    }
}

class BuyableProperty extends BoardPiece {
    constructor(n) {
        super(n)
        this.owner = undefined;
        this.level = 0;
        this.mortgaged = false;
    }
    calculateHouseDrawPos() {
        if (Math.floor(this.n / 10) === 0) {
            this.houseDrawX = this.drawX + 32;
            this.houseDrawY = this.drawY - 64;
            this.houseModX = 14;
            this.houseModY = 0;
            this.houseType = 0;
        }
        if (Math.floor(this.n / 10) === 1) {
            this.houseDrawX = this.drawX + 104;
            this.houseDrawY = this.drawY - 36;
            this.houseModX = 0;
            this.houseModY = 14;
            this.houseType = 1;
        }
        if (Math.floor(this.n / 10) === 2) {
            this.houseDrawX = this.drawX + 74;
            this.houseDrawY = this.drawY + 30;
            this.houseModX = -14;
            this.houseModY = 0;
            this.houseType = 2;
        }
        if (Math.floor(this.n / 10) === 3) {
            this.houseDrawX = this.drawX + 12;
            this.houseDrawY = this.drawY - 40;
            this.houseModX = 0;
            this.houseModY = 14;
            this.houseType = 3;
        }
    }
    drawHouses() {
        this.calculateHouseDrawPos()
        if (this.level < 5) {
            for (let i = 0; i < this.level; i++) {
                c.drawIsometricImage(images.buildings.house, {
                    x: this.houseDrawX + this.houseModX * i,
                    y: this.houseDrawY + this.houseModY * i,
                    w: 24,
                    h: 24,
                    cropW: 24,
                    cropH: 24,
                    cropX: this.houseType * 24,
                    cropY: 0
                });
            }
        } else {
            c.drawIsometricImage(images.buildings.hotel, {
                x: this.houseDrawX + this.houseModX * 2,
                y: this.houseDrawY + this.houseModY * 2,
                w: 24,
                h: 24,
                cropW: 24,
                cropH: 24,
                cropX: (this.houseType % 2) * 24,
                cropY: 0
            });
        }
    }
    openCard() {
        currentMenu = new PropertyCard(this.n);
    }
    step() {
        if (this.owner == undefined && players[turn].playing) {
            this.openCard();
            readyUp();
        } else if (this.owner != undefined && this.owner != players[turn] && !this.mortgaged) {
            this.payRent();
        } else {
            readyUp();
        }
    }
    buy(request = false) {
        if (request) {
            if (board.hosting) {
                sendMessageToAll("buyProperty", this.n)
            } else {
                sendMessage(board.peer.connection, "requestBuyProperty", this.n)
                return
            }
        }


        players[turn].money -= this.info.price;
        board.money += board.settings.giveAllToParking ? this.info.price : 0;
        this.owner = players[turn];
        players[turn].ownedPlaces.push(this);
        players[turn].hasBought = true;
    }
    sell(request = false) {
        if (request) {
            if (board.hosting) sendMessageToAll("sellProperty", this.n)
            else {
                sendMessage(board.peer.connection, "requestSellProperty", this.n)
                return
            }
        }

        players[turn].money += this.mortgaged ? 0 : this.info.price / 2;
        this.owner = undefined;
        players[turn].ownedPlaces.splice(players[turn].ownedPlaces.indexOf(this), 1);
    }
    upgrade() {
        this.level++;
        players[turn].money -= this.info.housePrice;
        board.money += board.settings.giveAllToParking ? this.info.housePrice : 0;
    }
    mortgage(request = false) {
        if (request) {
            if (board.hosting) sendMessageToAll("mortgage", this.n)
            else {
                sendMessage(board.peer.connection, "requestMortgage", this.n)
                return
            }
        }

        this.mortgaged = !this.mortgaged;
        players[turn].money += (this.mortgaged ? this.info.price / 2 : -(this.info.price / 2) * 1.1)
    }
    downgrade() {
        this.level--;
        players[turn].money += this.info.housePrice / 2;
    }
    payRent() {
        if (!(!this?.owner?.inPrison || board.settings.prisonpay)) return
        let colorGroup = board.getColorGroup(this.info.group);
        currentMenu = new Bankcheck(players.indexOf(this.owner), turn, this.info.rent[this.level] * ((colorGroup.length == colorGroup.filter(e => e.owner == this.owner).length && board.settings.doublePay) ? 2 : 1), "Hyra")
        players[turn].lastPayment = this.owner;
    }
}
class Station extends BuyableProperty {
    step() {
        if (this.owner == undefined && players[turn].playing) {
            this.openCard();
            readyUp();
        } else if (this.owner != players[turn] && players[turn].playing) {
            this.level = (this.owner.ownedPlaces.filter(e => e.constructor.name == "Station").length) - 1;
            this.payRent();
        } else {
            readyUp();
        }
    }
}
class Utility extends BuyableProperty {
    step(steps) {
        if (this.owner == undefined && players[turn].playing) {
            this.openCard();
        } else if (this.owner != players[turn]) {
            if (!(!this.owner?.inPrison || board.settings.prisonpay)) return
            let amount = this.owner.ownedPlaces.filter(e => e.constructor.name == "Utility").length;
            if (steps == undefined) {
                let self = this;
                board.dices.roll(function (dice1, dice2) {
                    self.pay(dice1 + dice2, amount);
                    board.dices.hidden = true;
                })
            } else {
                this.pay(steps, amount)
            }

        }
    }
    pay(steps, amount) {
        let rent = steps * (amount == 1 ? 4 : 10);
        currentMenu = new Bankcheck(players.indexOf(this.owner), turn, rent, "Avgift")
        players[turn].lastPayment = this.owner;
    }
}
class Community extends BoardPiece {
    step() {
        currentMenu = new CardDraw("community");
    }
}
class Chance extends BoardPiece {
    step() {
        currentMenu = new CardDraw("chance");
    }
}
class IncomeTax extends BoardPiece {
    step() {
        currentMenu = new CardDraw("special", 2)
    }
}
class SuperTax extends BoardPiece {
    step() {
        currentMenu = new CardDraw("special", 3)
    }
}

class Auction {
    constructor(cardId) {
        let self = this;
        this.cardId = cardId;
        this.boardPiece = board.boardPieces[this.cardId];
        this.startButton = new Button({ x: canvas.width / 2 - 256 + 28, y: canvas.height / 2 + 80, w: 220, h: 40 }, images.buttons.startauction, function () { self.startAuction() })
        this.auctionMoney = 0;
        this.turn = turn;
        this.minimumPay = this.boardPiece.info.price * (board.settings.lowestAuction / 100);
        this.playerlist = [...players];
        if ((this.playerlist[this.turn].money < this.auctionMoney + 2) || this.playerlist[this.turn].money < this.minimumPay) {
            this.leaveAuction();
        };
    }

    startAuction() {
        let self = this;
        this.started = true;
        this.add2 = new Button({ x: canvas.width / 2 - 256 + 28 + splitPoints(3, 220, 54, 0), y: canvas.height / 2 + 10, w: 54, h: 54 }, images.buttons["auction+2"], function () { self.addMoney(2) });
        this.add10 = new Button({ x: canvas.width / 2 - 256 + 28 + splitPoints(3, 220, 54, 1), y: canvas.height / 2 + 10, w: 54, h: 54 }, images.buttons["auction+10"], function () { self.addMoney(10) });
        this.add100 = new Button({ x: canvas.width / 2 - 256 + 28 + splitPoints(3, 220, 54, 2), y: canvas.height / 2 + 10, w: 54, h: 54 }, images.buttons["auction+100"], function () { self.addMoney(100) });
        this.leaveButton = new Button({ x: canvas.width / 2 - 256 + 28, y: canvas.height / 2 + 80, w: 220, h: 40 }, images.buttons.exitauction, function () { self.leaveAuction() });
    };
    addMoney(amount) {
        this.auctionMoney += amount;
        if (this.auctionMoney >= this.minimumPay) {
            this.playerlist[this.turn].hasLaidOver = true;
        }
        this.nextPlayer();
    };
    leaveAuction() {
        this.playerlist.splice(this.turn, 1);
        if (this.playerlist.length == 1 && this.playerlist[0].hasLaidOver) {
            this.winAuction(this.playerlist[0]);
        } else if (this.playerlist.length == 0) {
            currentMenu = undefined;
        } else {
            this.nextPlayer();
        };
    };
    nextPlayer() {
        this.turn = (this.turn + 1) % this.playerlist.length;
        if (this.playerlist.length == 1 && this.playerlist[this.turn].hasLaidOver) {
            this.winAuction(this.playerlist[0]);
        }
        if ((this.playerlist[this.turn].money < this.auctionMoney + 2) || this.playerlist[this.turn].money < this.minimumPay) {
            this.leaveAuction();
        };
    }
    winAuction(winner) {
        let playerIndex = players.indexOf(winner);

        if (this.auctionMoney >= this.minimumPay) {
            players[playerIndex].money -= this.auctionMoney;
            board.money += board.settings.giveAllToParking ? this.auctionMoney : 0;
            this.boardPiece.owner = players[playerIndex];
            players[playerIndex].ownedPlaces.push(this.boardPiece);
        };
        currentMenu = undefined;
    };

    draw() {
        c.drawImageFromSpriteSheet(images.cards[this.boardPiece.info.card], { x: canvas.width / 2 - 10, y: canvas.height / 2 - 162 })
        c.drawImageFromSpriteSheet(images.menus.auctionmenubackground, { x: canvas.width / 2 - 256 + 10, y: canvas.height / 2 - 162 })
        if (!this.started) {
            this.startButton.update();
        } else {
            this.add100.disabled = (this.playerlist[this.turn].money < this.auctionMoney + 100)
            this.add10.disabled = (this.playerlist[this.turn].money < this.auctionMoney + 10)
            this.add2.update();
            this.add10.update();
            this.add100.update();
            this.leaveButton.update();
        }
        if (this.playerlist.length > 0) {
            if (this.playerlist[this.turn]?.info?.img) {
                c.drawImageFromSpriteSheet(images.players[this.playerlist[this.turn].info.img], { x: canvas.width / 2 - 220, y: canvas.height / 2 - 90 })
            }

            c.drawText(this.playerlist[this.turn].name, canvas.width / 2 - 190, canvas.height / 2 - 50, c.getFontSize(this.playerlist[this.turn].name, 180, 40), "left", this.playerlist[this.turn].info.color)

            c.drawText(this.auctionMoney + "kr", canvas.width / 2 - 118, canvas.height / 2, 30, "center", !this.started ? "black" : (this.auctionMoney < this.minimumPay) ? "red" : "green")
        }
    }


}

class Trade {
    constructor(player1Id, player2Id) {
        this.player1Id = player1Id;
        this.player2Id = player2Id;

        this.player1 = players[this.player1Id];
        this.player2 = players[this.player2Id];

        this.closeButton = new Button({
            x: canvas.width / 2 + 455 - 22, y: canvas.height / 2 - 256 + 4, w: 18, h: 18, invertedHitbox: {
                x: canvas.width / 2 - 455,
                y: canvas.height / 2 - 256,
                w: 910,
                h: 512
            }, disableHover: true
        }, images.buttons.exitCard, this.closeTrade)

        this.player1MoneySlider = new Slider({ x: canvas.width / 2 - 455 + 30, y: 100, w: 400, h: 20, from: 0, to: this.player1.money, steps: 10, unit: "kr" })
        this.player2MoneySlider = new Slider({ x: canvas.width / 2 + 455 - 430, y: 100, w: 400, h: 20, from: 0, to: this.player2.money, steps: 10, unit: "kr" })

        this.player1Accept = new Button({ x: canvas.width / 2 - 455 + 205 - 55, y: 460, w: 150, h: 50, selectButton: true }, images.buttons.accept);
        this.player2Accept = new Button({ x: canvas.width / 2 - 455 + 900 - 455 / 2 - 55, y: 460, w: 150, h: 50, selectButton: true }, images.buttons.accept);
        this.initProperties();
    }
    initProperties() {
        let self = this;
        this.player1Properties = [];

        this.player1.ownedPlaces.forEach((place, i, amount) => {
            if (place.level == 0 || place.info.type == "station") {
                this.player1Properties.push({ place: place, button: new Button({ x: 35 + splitPoints(2, 440, 186, (i % 2)), y: 130 + splitPoints(Math.ceil(amount.length / 2), 330, 21, Math.floor(i / 2)), w: 186, h: 21, textSize: 15, text: place.info.name, color: place.info.color, selectButton: true }, images.buttons.tradingcityname, function () { self.player1Accept.selected = false; self.player2Accept.selected = false; }) })
            }
        })

        this.player2Properties = [];

        this.player2.ownedPlaces.forEach((place, i, amount) => {
            if (place.level == 0 || place.info.type == "station") {
                this.player2Properties.push({ place: place, button: new Button({ x: 450 + 35 + splitPoints(2, 440, 186, (i % 2)), y: 130 + splitPoints(Math.ceil(amount.length / 2), 330, 21, Math.floor(i / 2)), w: 186, h: 21, textSize: 15, text: place.info.name, color: place.info.color, selectButton: true }, images.buttons.tradingcityname, function () { self.player1Accept.selected = false; self.player2Accept.selected = false; }) })
            }
        })
    }
    draw() {
        c.drawImageFromSpriteSheet(images.menus.tradingmenu, { x: canvas.width / 2 - 455, y: canvas.height / 2 - 256 })

        c.drawText(this.player1.name, canvas.width / 2 - 455 / 2, 70, 30, "center")

        c.drawText(this.player2.name, canvas.width / 2 - 455 + 900 - 455 / 2, 70, 30, "center")

        this.closeButton.update();
        this.player1MoneySlider.update();
        this.player2MoneySlider.update();

        this.player1Properties.forEach(e => e.button.update())
        this.player2Properties.forEach(e => e.button.update())

        this.player1Accept.update();
        this.player2Accept.update();

        if (this.player1Accept.selected && this.player2Accept.selected) {
            this.acceptTrade();
        }

    }
    acceptTrade() {
        let self = this;
        this.player1.money += this.player2MoneySlider.value;
        this.player2.money -= this.player2MoneySlider.value;

        this.player1.money -= this.player1MoneySlider.value;
        this.player2.money += this.player1MoneySlider.value;

        this.player1Properties.forEach(property => {
            if (property.button.selected) {
                self.player1.ownedPlaces.splice(self.player1.ownedPlaces.indexOf(property.place), 1);
                self.player2.ownedPlaces.push(property.place);
                property.place.owner = self.player2;
            }
        })
        this.player2Properties.forEach(property => {
            if (property.button.selected) {
                self.player2.ownedPlaces.splice(self.player2.ownedPlaces.indexOf(property.place), 1);
                self.player1.ownedPlaces.push(property.place);
                property.place.owner = self.player1;
            }
        })

        this.closeTrade();
    }
    closeTrade() {
        currentMenu = undefined;
    }
}
class Bankcheck {
    constructor(to, from, amount, reason) {
        this.to = to;
        this.from = from;
        this.amount = amount;
        this.reason = reason;

        this.xPos = canvas.width + 512;

        this.hasPayed = false;

    }
    draw() {

        this.xPos -= 3 + Math.abs(this.xPos - canvas.width / 2 - 256) / 50

        if (Math.abs(this.xPos - canvas.width / 2 - 256) < 5 && !this.hasPayed) {
            this.hasPayed = true;
            this.doCard();
        }
        if (this.xPos < -512) {
            readyUp();
            currentMenu = undefined;
        }

        c.drawImageFromSpriteSheet(images["community card and chance card"].bankcheck, { x: this.xPos - 512, y: canvas.height / 2 - 128, w: 512, h: 256 });

        c.font = "30px handwritten";
        c.fillStyle = "black"
        c.textAlign = "left"
        c.fillText(new Date().getDate() + " " + monthToText(new Date().getMonth()), 585 - canvas.width / 2 - 256 + this.xPos, 195);

        c.font = "50px handwritten";
        c.fillText((typeof this.to == "number") ? players[this.to].name : this.to, 400 - canvas.width / 2 - 256 + this.xPos, 245);

        c.font = "35px handwritten";
        c.textAlign = "center"
        c.fillText(this.amount, 680 - canvas.width / 2 - 256 + this.xPos, 245)

        c.textAlign = "left"
        c.font = "40px handwritten";
        c.fillText(numberToText(this.amount), 250 - canvas.width / 2 - 256 + this.xPos, 285);

        c.textAlign = "left"
        c.font = "40px handwritten";
        c.fillText(this.reason, 300 - canvas.width / 2 - 256 + this.xPos, 330);

        c.textAlign = "left"
        c.font = "40px handwritten";
        console.log(this.from)
        c.fillText((typeof this.from == "number") ? players[this.from].name : this.from, 500 - canvas.width / 2 - 256 + this.xPos, 335);
    }
    doCard() {
        if (typeof this.to == "number") {
            players[this.to].money += this.amount;
        }
        if (typeof this.from == "number") {
            players[this.from].money -= this.amount;
        }
    }
}

class CardDraw {
    constructor(type, cardId) {
        this.yPos = canvas.height;
        this.animationStep = 0;

        this.type = type;
        if (this.type !== "special" && this.type !== "textSpecial") {
            this.cardId = board.cardId == undefined ? randomIntFromRange(0, (this.type == "community") ? 12 : 13) : (board.cardId % ((this.type == "community") ? 12 : 13));

            this.card = ((this.type == "community") ? communitycards[this.cardId] : chanceCards[this.cardId])
        } else if (this.type !== "textSpecial") {
            this.cardId = cardId;
            this.card = specialCards[this.cardId];
        } else {
            this.card = { img: "specialempty" }
            this.text = cardId;
        }

        let self = this;
        this.closeButton = new Button({
            x: canvas.width / 2 + 256 - 22, y: canvas.height / 2 - 128 + 4, w: 18, h: 18, invertedHitbox: { x: canvas.width / 2 - 256, y: canvas.height / 2 - 128, w: 512, h: 256 }, disableHover: true
        }, images.buttons.exitCardTrans, () => currentMenu = undefined)

        this.okayButton = new Button({ x: canvas.width / 2 - 100, y: 330, w: 200, h: 60, invertedHitbox: { x: canvas.width / 2 - 256, y: canvas.height / 2 - 128, w: 512, h: 256 } }, images.buttons.okej, function (request = true) {
            self.animationStep = 3
            board.cardId = undefined
            if (request && board instanceof OnlineBoard) {
                if (board.hosting) sendMessageToAll("closeCard")
                else sendMessage(board.peer.connection, "requestCloseCard")
            }
        })

    }
    draw() {
        c.drawImageFromSpriteSheet(images["community card and chance card"][this.card.img], { x: canvas.width / 2 - 256, y: this.yPos, w: 512, h: 256 })

        if (this.type == "textSpecial") {
            let splitText = this.text.split("^");

            splitText.forEach((text, i) => {
                c.drawText(text, canvas.width / 2 - 256 + 15, this.yPos + 30 + splitPoints(splitText.length, 180, 30, i), 30, "left")
            })

        }

        if (this.animationStep == 2) {
            if (board.ready && players[turn].playing) {
                this.okayButton?.update();
                if (this.type == "textSpecial") {
                    this.closeButton.update();
                    this.okayButton.invertedHitbox = undefined;
                }
            }
        } else if (this.animationStep == 0) {
            this.yPos -= 1 - (canvas.height / 2 - 250 - this.yPos) / 20;
            if (canvas.height / 2 - 180 - this.yPos > 0) {
                this.animationStep = 1;
            }
        } else if (this.animationStep == 1) {
            this.yPos += 1 - (this.yPos - canvas.height / 2 - 128) / 50;
            if (this.yPos > canvas.height / 2 - 128) {
                this.yPos = canvas.height / 2 - 128;
                this.animationStep = 2;
                readyUp();
            }
        } else if (this.animationStep == 3) {
            this.yPos -= 1 - (canvas.height / 2 - 250 - this.yPos) / 20;
            if (canvas.height / 2 - 180 - this.yPos > 0) {
                this.animationStep = 4;
            }
        } else if (this.animationStep == 4) {
            this.yPos += 1 + (this.yPos) / 20;
            if (this.yPos > canvas.height) {
                this.useCard();
            }
        }

    }
    useCard() {
        let close = true;
        if (this.card.teleport !== undefined) {
            players[turn].teleportTo(this.card.teleport);
        } else if (this.card.moneyChange) {
            players[turn].money += this.card.moneyChange;
            if (this.card.moneyChange < 0) {
                board.money += board.settings.giveAllToParking ? this.card.moneyChange : 0;
            }
            players[turn].lastPayment = undefined;
        } else if (this.card.moneyFromPlayers) {
            currentMenu = new Bankcheck(turn, "Motspelare", (this.card.moneyFromPlayers * (players.filter(e => (!e.inPrison || board.settings.prisonpay)).length - 1)), "Present")
            close = false;
            players.filter(e => (!e.inPrison || board.settings.prisonpay)).forEach(e => {
                if (e != players[turn]) {
                    e.money -= this.card.moneyFromPlayers;
                    e.lastPayment = players[turn];
                }
            });
        } else if (this.card.type == "getprisoncard") {
            players[turn].prisonCards++;
        } else if (this.card.type == "gotoprison") {
            players[turn].goToPrison();
        } else if (this.card.steps) {
            players[turn].teleportTo((players[turn].pos + this.card.steps) * Math.sign(this.card.steps))
        } else if (this.card.gotoClosest) {
            let self = this;
            let closest = findClosest(players[turn].pos, board.boardPieces.filter(e => e.constructor.name == self.card.gotoClosest).map(e => e.n))
            players[turn].teleportTo(closest * Math.sign(closest - players[turn].pos), true);
        } else if (this.card.properyPrice) {
            let self = this;
            players[turn].ownedPlaces.forEach(place => {
                if (place.level < 5) {
                    players[turn].money -= self.card.properyPrice.house * place.level;
                    board.money += board.settings.giveAllToParking ? self.card.properyPrice.house * place.level : 0;
                    players[turn].lastPayment = undefined;

                } else {
                    players[turn].money -= self.card.properyPrice.hotel;
                    board.money += board.settings.giveAllToParking ? self.card.properyPrice.hotel : 0;
                    players[turn].lastPayment = undefined;
                }
            })
        } else if (this.type == "special" && (this.cardId == 0 || this.cardId == 1)) {
            players[turn].goToPrison();
        } else if (this.type == "special" && this.cardId == 2) {
            players[turn].money -= (players[turn].money > 2000 ? 200 : Math.round(players[turn].money / 10));
            board.money += board.settings.giveAllTaxToParking ? players[turn].money > 2000 ? 200 : Math.round(players[turn].money / 10) : 0;
            players[turn].lastPayment = undefined;
        } else if (this.type == "special" && this.cardId == 3) {
            players[turn].money -= 100;
            board.money += board.settings.giveAllTaxToParking ? 100 : 0;
            players[turn].lastPayment = undefined;
        }
        if (close) currentMenu = undefined;
    }
}

class PropertyCard {
    constructor(n) {
        this.n = n;
        this.closeButton = new Button({
            x: 590, y: 108, w: 18, h: 18, invertedHitbox: {
                x: canvas.width / 2 - 128,
                y: canvas.height / 2 - 162,
                w: 256,
                h: 324
            }, disableHover: true
        }, images.buttons.exitCard, this.closeCard)

        this.animationFactor = 0;

        let self = this;

        this.hasUpgradeButtons = !(board.boardPieces[this.n] instanceof Station || board.boardPieces[this.n] instanceof Utility);

        this.auctionButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(2, 234, 97, 0), y: canvas.height / 2 + 100, w: 97, h: 40 }, images.buttons.auction, function () { players[turn].hasBought = true; currentMenu = new Auction(self.n) });
        this.buyButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(2, 234, 97, 1), y: canvas.height / 2 + 100, w: 97, h: 40 }, images.buttons.buythislawn, function (n) {
            self.buyThis();
        });

        if (!this.hasUpgradeButtons) {
            this.sellButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(2, 234, 40, 0), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Sälj" }, images.buttons.sellbutton, function () { self.sellThis() })
            this.mortgageButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(2, 234, 40, 1), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Inteckna" }, images.buttons.mortgage, function () { board.boardPieces[self.n].mortgage(board instanceof OnlineBoard) })
        } else {
            this.sellButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(4, 234, 40, 0), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Sälj" }, images.buttons.sellbutton, function () { self.sellThis() })
            this.mortgageButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(4, 234, 40, 1), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Inteckna" }, images.buttons.mortgage, function () { board.boardPieces[self.n].mortgage(board instanceof OnlineBoard) })
            this.downgradeButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(4, 234, 40, 2), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Sälj Hus" }, images.buttons.arrowdown, function () {
                if (self.downgradeInfo?.index) {
                    board.boardPieces[self.downgradeInfo.index].downgrade()
                } else {
                    if (-self.downgradeInfo.price > board.boardPieces[self.n].info.housePrice) {
                        currentMenu = new CardDraw("textSpecial", "Matchen har slut på hus och^du måste nedgradera några^gator mer än en nivå.^Detta kommer att ge dig " + -self.downgradeInfo.price * 0.9 + "kr^Är du säker på att du vill^göra detta?")
                        currentMenu.useCard = function () {
                            self.downgradeInfo.values.forEach(e => {
                                board.boardPieces[e.n].level = e.level
                            })
                            players[turn].money -= self.downgradeInfo.price * 0.9;
                            currentMenu = undefined;
                        }
                    } else {
                        self.downgradeInfo.values.forEach(e => {
                            board.boardPieces[e.n].level = e.level
                        })
                        players[turn].money -= self.downgradeInfo.price * 0.9;
                    }
                }
            })
            this.upgradeButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(4, 234, 40, 3), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Köp Hus" }, images.buttons.arrowup, function () {
                if (self.upgradeInfo?.index) {
                    board.boardPieces[self.upgradeInfo.index].upgrade()
                } else {
                    if (self.upgradeInfo.price > board.boardPieces[self.n].info.housePrice) {
                        currentMenu = new CardDraw("textSpecial", "Matchen har slut på hus och^du måste uppgradera några^gator till hotell.^Detta kommer att kosta " + self.upgradeInfo.price + "kr^Är du säker på att du vill^göra detta?")
                        currentMenu.useCard = function () {
                            self.upgradeInfo.values.forEach(e => {
                                board.boardPieces[e.n].level = e.level
                            })
                            players[turn].money -= self.upgradeInfo.price;
                            board.money += board.settings.giveAllToParking ? self.upgradeInfo.price : 0;
                            currentMenu = undefined;
                        }
                    } else {
                        self.upgradeInfo.values.forEach(e => {
                            board.boardPieces[e.n].level = e.level
                        })
                        players[turn].money -= self.upgradeInfo.price;
                        board.money += board.settings.giveAllToParking ? self.upgradeInfo.price : 0;
                    }

                }
            })
        }

    };
    buyThis() {
        board.boardPieces[this.n].buy(board instanceof OnlineBoard)
        this.closeCard();
    }
    sellThis() {
        board.boardPieces[this.n].sell(board instanceof OnlineBoard)
        this.closeCard();
    }

    calculateUpgrade() {
        let colorGroupName = board.boardPieces[this.n].info.group;
        let colorGroup = board.getColorGroup(colorGroupName);

        if (colorGroup.length == colorGroup.filter(e => e.owner == players[turn]).length || !board.settings.buyHouseGroup) {
            if (players[turn].money < board.boardPieces[this.n].info.housePrice) {
                return false;
            } else {
                let lowest = !board.settings.evenHouses ? board.boardPieces[this.n].level : colorGroup.sort((a, b) => a.level - b.level)[0].level;
                if (lowest == 5) {
                    return false;
                }
                if (lowest == 4 && board.getTotalHousesAndHotels().hotels == board.settings.maxHotels) {
                    return false;
                }
                if (lowest < 4) {
                    let houses = board.getTotalHousesAndHotels().houses;
                    if (houses == board.settings.maxHouses) {
                        if (board.settings.evenHouses) {
                            let housesInColorGroup = board.getTotalHousesAndHotelsInColorGroup(colorGroupName).houses;

                            if (housesInColorGroup < 5) {
                                let price = (colorGroup.length * 5 - housesInColorGroup) * board.boardPieces[this.n].info.housePrice;
                                return price > players[turn].money ? false : { price: price, values: colorGroup.map(e => { return { n: e.n, level: 5 } }) }
                            } else if (housesInColorGroup >= (colorGroup.length - 1) * 4) {
                                let oldLevels = colorGroup.map(e => e.level).reduce((partialSum, a) => partialSum + a)
                                let values = (colorGroup.map(e => { return { n: e.n, level: (e.n == this.n ? 5 : 4) } }))
                                let newLevels = values.map(e => e.level).reduce((partialSum, a) => partialSum + a)
                                let price = (newLevels - oldLevels) * board.boardPieces[this.n].info.housePrice;
                                return price > players[turn].money ? false : { price: price, values: values }
                            } else {
                                let oldLevels = colorGroup.map(e => e.level).reduce((partialSum, a) => partialSum + a)
                                let values = (colorGroup.map(e => { return { n: e.n, level: ((e.n == this.n || e.n == colorGroup[colorGroup.length - 1].n) ? 5 : 4) } }))
                                let newLevels = values.map(e => e.level).reduce((partialSum, a) => partialSum + a)
                                let price = (newLevels - oldLevels) * board.boardPieces[this.n].info.housePrice
                                return price > players[turn].money ? false : { price: price, values: values }
                            }
                        } else {
                            let oldLevels = colorGroup.map(e => e.level).reduce((partialSum, a) => partialSum + a)
                            let values = (colorGroup.map(e => { return { n: e.n, level: ((e.n == this.n) ? 5 : e.level) } }))
                            let newLevels = values.map(e => e.level).reduce((partialSum, a) => partialSum + a)
                            let price = (newLevels - oldLevels) * board.boardPieces[this.n].info.housePrice
                            return price > players[turn].money ? false : { price: price, values: values }
                        }


                    }
                }

                if (board.boardPieces[this.n].level == lowest) {
                    return { index: this.n };
                }
                let propertyWithLowestLevel = colorGroup.filter(e => e.level == lowest);
                return { index: propertyWithLowestLevel.sort((a, b) => b.n - a.n)[0].n };
            }
        } else {
            return false;
        }
    }
    calculateDowngrade() {
        let colorGroupName = board.boardPieces[this.n].info.group;
        let colorGroup = board.getColorGroup(colorGroupName);
        if (colorGroup.length == colorGroup.filter(e => e.owner == players[turn]).length || !board.settings.buyHouseGroup) {
            let highest = !board.settings.evenHouses ? board.boardPieces[this.n].level : colorGroup.sort((a, b) => b.level - a.level)[0].level;
            if (highest == 0) {
                return false;
            };
            let index = undefined;
            if (board.boardPieces[this.n].level == highest) {
                index = this.n;
            };
            let propertyWithHighestLevel = colorGroup.filter(e => e.level == highest);
            index = !index ? propertyWithHighestLevel.sort((a, b) => a.n - b.n)[0].n : index;

            if (board.boardPieces[index].level == 5) {
                if (board.settings.evenHouses) {
                    let houses = board.getTotalHousesAndHotels().houses;
                    if (board.settings.maxHouses - houses < 4) {
                        let housesInColorGroup = board.getTotalHousesAndHotelsInColorGroup(colorGroupName).houses;
                        let values = (colorGroup.map(e => { return { n: e.n, level: 0 } }))
                        values.forEach((e, i) => {
                            e.level = divide(housesInColorGroup + board.settings.maxHouses - board.getTotalHousesAndHotels().houses, colorGroup.length)[i]
                        })
                        let oldLevels = colorGroup.map(e => e.level).reduce((partialSum, a) => partialSum + a)
                        let newLevels = values.map(e => e.level).reduce((partialSum, a) => partialSum + a)
                        let price = (newLevels - oldLevels) * board.boardPieces[this.n].info.housePrice;

                        return { price: price, values: values };
                    }
                } else {
                    let values = (colorGroup.map(e => { return { n: e.n, level: e.n == this.n ? (board.settings.maxHouses - board.getTotalHousesAndHotels().houses > 4 ? 4 : board.settings.maxHouses - board.getTotalHousesAndHotels().houses) : e.level } }))

                    let oldLevels = colorGroup.map(e => e.level).reduce((partialSum, a) => partialSum + a)
                    let newLevels = values.map(e => e.level).reduce((partialSum, a) => partialSum + a)
                    let price = (newLevels - oldLevels) * board.boardPieces[this.n].info.housePrice;

                    return { price: price, values: values };
                }
            }

            return { index: index }
        } else {
            return false;
        }
    }
    draw() {
        c.drawRotatedImageFromSpriteSheet(images.cards[pieces[this.n].card], {
            x: canvas.width / 2 - 128 * this.animationFactor,
            y: canvas.height / 2 - 162 * this.animationFactor,
            w: this.animationFactor * 256,
            h: this.animationFactor * 324
        });
        if (board.boardPieces[this.n].mortgaged) {
            c.drawRotatedImageFromSpriteSheet(images.cards.mortgageoverlay, {
                x: canvas.width / 2 - 128 * this.animationFactor,
                y: canvas.height / 2 - 162 * this.animationFactor,
                w: this.animationFactor * 256,
                h: this.animationFactor * 324
            });
        }


        if (this.animationFactor == 1) {
            if (players[turn].pos === this.n && board.boardPieces[this.n].owner === undefined && !players[turn].hasBought) {

                let self = this;
                this.buyButton.disabled = (players[turn].money < board.boardPieces[this.n].info.price);
                this.auctionButton.disabled = (players.filter(e => e.money >= board.boardPieces[self.n].info.price / 2).length < 2 || !board.settings.auctions);


                if (this.buyButton.disabled && this.auctionButton.disabled || !board.settings.auctions) {
                    this.closeButton.update();
                }

                this.buyButton.update();
                this.auctionButton.update();

            } else if (board.boardPieces[this.n].owner == players[turn]) {
                this.closeButton.update();
                let colorGroup = board.getColorGroup(board.boardPieces[this.n].info.group);

                this.mortgageButton.disabled = !board.settings.canMortgage || board.boardPieces[this.n].info.type != "station" && board.boardPieces[this.n].info.type != "utility" && (colorGroup.filter(e => e.level > 0).length) || (board.boardPieces[this.n].mortgaged ? !(players[turn].money >= (board.boardPieces[this.n].info.price / 2) * 1.1) : false)
                this.sellButton.disabled = board.boardPieces[this.n].info.type != "station" && board.boardPieces[this.n].info.type != "utility" && (colorGroup.filter(e => e.level > 0).length);
                this.sellButton.update();
                this.mortgageButton.update();
                if (this.hasUpgradeButtons) {
                    this.upgradeInfo = this.calculateUpgrade();
                    this.downgradeInfo = this.calculateDowngrade();
                    this.upgradeButton.disabled = (!this.upgradeInfo || (board.settings.houseOnStanding ? !(players[turn].pos == this.n) : false));
                    this.downgradeButton.disabled = !this.downgradeInfo || (board.settings.houseOnStanding ? !(players[turn].pos == this.n) : false);
                    this.downgradeButton.update();
                    this.upgradeButton.update();
                }
            } else {
                this.closeButton.update();
            }
        } else {
            this.animationFactor += 0.001;
            this.animationFactor *= 1.5;
            this.animationFactor = this.animationFactor.clamp(0, 1);
        }

    }
    closeCard() {
        currentMenu = undefined;
    };
}

class Player {
    constructor(color, name, playing = true) {
        this.color = color;
        this.pos = 0;
        this.money = board.settings.startMoney;
        this.ownedPlaces = [];
        this.name = name;
        this.prisonCards = 0;
        this.info = playerInfo[this.color];
        this.inPrison = false;
        this.rolls = 0;
        this.rollsInPrison = 0;
        this.hasBought = false;
        this.dead = false;
        this.laps = 0;
        this.playing = playing;

        this.moneyShowerThing = new Money(this);

        this.calculateDrawPos();
        board.boardPieces[0].playersOnBoardPiece.push(this);
    }
    calculateDrawPos() {
        let index = this.inPrison ? players.filter(e => e.inPrison).indexOf(this) : board.boardPieces[this.pos].playersOnBoardPiece.indexOf(this);

        this.drawX = board.boardPieces[this.pos].drawX;
        this.drawY = board.boardPieces[this.pos].drawY - 64;

        if (this.pos % 10 == 0) {
            this.drawX += 32;
            if (Math.floor(this.pos / 10) === 1) {
                this.drawY += 48
            }
        }
        if (Math.floor(this.pos / 10) === 0) {
            this.drawY += 32 * (index - 1)
        }
        if (Math.floor(this.pos / 10) === 1) {
            this.drawX -= 32 * (index - 1)
        }
        if (Math.floor(this.pos / 10) === 2) {
            this.drawY -= 32 * (index - 1)
        }
        if (Math.floor(this.pos / 10) === 3) {
            this.drawX += 32 * (index - 1)
        }
        if (this.pos == 40) {
            this.drawX += 32 * (index - 1)
            this.drawY -= 32 * (index - 1)
        }
    }

    draw() {
        this.money = Math.round(this.money)
        if (players[turn].laps < board.settings.roundsBeforePurchase) this.hasBought = true
        this.calculateDrawPos();
        let coord = to_screen_coordinate(this.drawX, this.drawY);
        this.hover = (detectCollision(coord.x, coord.y, 24, 48, mouse.x, mouse.y, 1, 1) && !currentMenu && board.dices.hidden && (board.playerIsWalkingTo == false));
        if (this.hover) { hoverList.push(this.name + ((players[turn] !== this) ? "(Föreslå bytesförslag)" : "(Du)")) }
        if (this.hover && mouse.down && (players[turn] !== this)) {
            this.moneyShowerThing.button.onClick();
            mouse.down = false;
        }

        c.drawIsometricImage(images.players[this.info.img], {
            x: this.drawX,
            y: this.drawY,
            offsetY: this.hover ? 1 : 0
        })
        this.moneyShowerThing.update();
        let netWorth = this.money;
        if (this.ownedPlaces.length > 0) {
            netWorth = this.money + this.ownedPlaces.map(e => e.info.price / 2 * (e.mortgaged ? 0 : 1))?.reduce((partialSum, a) => partialSum + a) + this.ownedPlaces.map(e => (e.info?.housePrice == undefined ? 0 : e.info?.housePrice) * e.level)?.reduce((partialSum, a) => partialSum + a);
        }
        if (netWorth < 0 && this.ownedPlaces.length == 0 && !this.dead) {
            this.dead = true;
            if (this.lastPayment) {
                this.lastPayment.money += this.money;
            }
        }

    }

    teleportTo(newPos, noSteps) {
        newPos = newPos == 0 ? 40 : newPos;
        let direction = Math.sign(newPos);
        newPos %= 40;
        let self = this;

        this.animateSteps(Math.abs(newPos), direction, function (steps) {
            if (board.boardPieces[self.pos]?.step) {
                board.boardPieces[self.pos].step((noSteps ? undefined : steps));
            } else {
                readyUp();
            }

        });
    }
    animateSteps(newPos, direction, onStep) {
        if (this.pos == 40) return;
        board.playerIsWalkingTo = newPos;
        let self = this;
        let steps = newPos - self.pos;

        if (steps == 0) {
            onStep(steps);
            board.playerIsWalkingTo = false;
        } else {
            let timer = setInterval(() => {
                if (!currentMenu) {
                    board.boardPieces[self.pos].playersOnBoardPiece.splice(board.boardPieces[self.pos].playersOnBoardPiece.indexOf(self), 1);
                    self.pos += direction;
                    self.pos %= 40;
                    board.boardPieces[self.pos].playersOnBoardPiece.push(self);
                    self.calculateDrawPos();
                    if (self.pos == 0 && !self.inPrison) {
                        self.laps++;
                        currentMenu = new Bankcheck(turn, "Banken", 200, "Inkomst")
                    }
                    if (self.pos == newPos) {
                        clearInterval(timer)
                        board.dices.hidden = true;
                        board.playerIsWalkingTo = false;
                        onStep(steps);
                    };
                }
            }, 250)
        }


    }

    goToPrison() {
        let self = this;
        board.playerHasRolled = true;
        this.inPrison = true;
        this.animateSteps(10, 1, function () {
            self.pos = 40;
            self.calculateDrawPos();
        });
    }
    getOutOfPrison() {
        this.pos = 10;
        this.calculateDrawPos();
        this.inPrison = false;
    }

    rollDice(rigged1, rigged2) {
        let self = this;
        this.hasBought = false;

        board.dices.roll(function (dice1, dice2) {
            if (dice1 == dice2) {
                board.playerHasRolled = false;
                self.rolls++;
                if (self.rolls == 3) {
                    currentMenu = new CardDraw("special", 1)
                    return;
                }
            }
            self.teleportTo(self.pos + dice1 + dice2);
        }, rigged1, rigged2)
    }
}

class Money {
    constructor(player) {
        this.player = player;
        this.index = players.length
        this.calculateDrawPos();
    }
    calculateDrawPos() {
        this.side = this.index % 2;
        this.drawX = (this.side ? canvas.width - 354 : 0)
        this.drawY = (this.index < 2 ? 0 : this.index < 4 ? canvas.height - 54 : this.index < 6 ? 54 : canvas.height - 54 * 2)

        let self = this;

        this.button = new Button({ x: this.drawX, y: this.drawY, w: 354, h: 54, mirrored: !this.side, hoverText: "Föreslå bytesförslag", disableDisabledTexture: true }, images.buttons.playerborder, function () {
            currentMenu = new Trade(players.indexOf(players[turn]), players.indexOf(self.player));
        })
    }
    update() {
        this.button.disabled = (this.player == players[turn] || currentMenu);
        this.button.update();
        c.drawImageFromSpriteSheet(images.players[this.player.info.img], { x: (!this.side ? 3 : canvas.width - 3 - images.players.player.w), y: 3 + this.drawY })

        c.drawText(this.player.name, this.drawX + (this.side ? 15 : 30), this.drawY + 36, c.getFontSize(this.player.name, 165, 30), "left", this.player.info.color)

        c.drawText(this.player.money + "kr", this.drawX + (this.side ? 185 : 200), this.drawY + 36, 30)
    }
}

class Dice {
    constructor() {
        this.dice1 = 1;
        this.dice2 = 1;
        this.dice1Type = 0;
        this.dice2Type = 0;
        this.hidden = true;
    }
    roll(callback, rigged1, rigged2) {
        let self = this;

        this.hidden = false;

        let counter = 1;

        let rollAnimation = function () {
            if (counter < 500) {
                self.randomizeDice(rigged1, rigged2);
                counter *= 1.2;
                setTimeout(rollAnimation, counter);
            } else {
                setTimeout(() => {
                    if (rigged1) board.dices.dice1 = rigged1
                    if (rigged2) board.dices.dice2 = rigged2
                    callback(rigged1 ?? self.dice1, rigged2 ?? self.dice2);
                }, 1000);
            }

        }
        rollAnimation();
    }
    randomizeDice() {
        this.dice1Type = randomIntFromRange(0, 3);
        this.dice2Type = randomIntFromRange(0, 3);
        this.dice1 = randomIntFromRange(1, 6);
        this.dice2 = randomIntFromRange(1, 6);
    }

    draw() {
        if (!this.hidden) {
            c.drawIsometricImage(images.dices.dices, {
                x: 950,
                y: 200,
                cropX: this.dice1Type * 64,
                cropY: (this.dice1 - 1) * 64,
                cropW: 64,
                cropH: 64,
                w: 64,
                h: 64
            })
            c.drawIsometricImage(images.dices.dices, {
                x: 1050,
                y: 120,
                cropX: this.dice2Type * 64,
                cropY: (this.dice2 - 1) * 64,
                cropW: 64,
                cropH: 64,
                w: 64,
                h: 64
            })
        }
    }
}

init();