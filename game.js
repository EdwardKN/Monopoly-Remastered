var board;
var players = [];
var currentMenu;
var turn = 0;
var hoverList = [];
var logger;


const boardOffsetX = 0;
const boardOffsetY = 64;

async function init() {
    fixCanvas();
    await loadData();
    await downScaleImagesForSaves("monopolyGames");
    await downScaleImagesForSaves("monopolyOnlineGames");
    renderC.imageSmoothingEnabled = false;

    currentMenu = new MainMenu();
    update();
};

async function checkLocalStorageSize() {
    if (localStorage && !localStorage.getItem('size')) {
        var i = 0;
        try {
            // Test up to 10 MB
            for (i = 250; i <= 10000; i += 250) {
                localStorage.setItem('test', new Array((i * 1024) + 1).join('a'));
            }
        } catch (e) {
            localStorage.removeItem('test');
            localStorage.setItem('size', i - 250);
        }
    }
}

async function downScaleImagesForSaves(key) {
    if (localStorage.getItem(key) == [] || !localStorage.getItem(key) || localStorage.getItem(key).length == 0 || localStorage.getItem(key) == "[]") { return; }
    let local = JSON.parse(localStorage.getItem(key));

    await new Promise((resolve) => local.forEach((game, index, array) => {
        let parsedGame = JSON.parse(game)

        if (!parsedGame?.compressedImage) {
            parsedGame.compressedImage = true;
            downscale(parsedGame.screenshot, canvas.width / 2, canvas.height / 2, { imageType: "png" }).then((e) => {
                parsedGame.screenshot = e;
                local[index] = JSON.prune(parsedGame);
                if (index === array.length - 1) resolve();
            })
        } else {
            if (index === array.length - 1) setTimeout(resolve, 1000);
        }
    }))
    localStorage.setItem(key, JSON.prune(local));
}

function exitGame(online = false, client = false) {
    setTimeout(e => {
        if (!client) saveGame(online);
        board.boardPieces.forEach(e => e.hover = false);
        players.forEach(e => e.hover = false);
        logger = undefined
        board = undefined;
        players = [];
        currentMenu = online ? new PublicGames() : new MainMenu();
        window.onbeforeunload = undefined;
        downScaleImagesForSaves(online ? "monopolyOnlineGames" : "monopolyGames")
    }, 30)
}

function startGame(playersToStartGameWith, settings) {
    if (currentMenu instanceof LobbyMenu) window.onbeforeunload = function () { saveGame() }
    board = currentMenu instanceof LobbyMenu ? new Board() : new OnlineBoard(currentMenu.hosting, currentMenu.peer);
    board.settings = settings;

    let colorsToPick = [0, 1, 2, 3, 4, 5, 6, 7]
    playersToStartGameWith.forEach(player => { if (player.color !== -1) colorsToPick.splice(colorsToPick.indexOf(player.color), 1) })

    let clientPlayers = []
    playersToStartGameWith.forEach((player, i) => {
        if (player.color != -1) players.push(new Player(player.color, player.name, currentMenu instanceof LobbyMenu));
        else {
            let random = randomIntFromRange(0, colorsToPick.length - 1);
            players.push(new Player(colorsToPick[random], player.name, currentMenu instanceof LobbyMenu));
            colorsToPick.splice(random, 1)
        }
        clientPlayers.push({ name: player.name, color: players[players.length - 1].color })
    })
    logger = new Logger();

    if (board.hosting) {
        let rigged = shuffle(players, true)
        turn = randomIntFromRange(0, players.length - 1)

        let activePlayers = []
        let indexes = {}
        for (let i = 0; i < currentMenu.playersPlaying; i++) {
            let client = currentMenu.players[i].client
            if (client === currentMenu.peer.id) players[i].playing = !currentMenu.spectatorButton.selected
            else {
                activePlayers.push(client)
                indexes[client] = i
            }
        }

        for (let id of Object.keys(currentMenu.peer.clients)) {
            if (activePlayers.includes(id)) {
                sendMessage(currentMenu.peer.clients[id].connection, "startGame", {
                    players: clientPlayers,
                    settings: settings,
                    riggedShuffle: rigged,
                    turn: turn,
                    index: indexes[id]
                })
            } else sendMessage(currentMenu.peer.clients[id].connection, "startGame", {
                players: clientPlayers,
                settings: settings,
                riggedShuffle: rigged,
                turn: turn,
            })
        }

        players = riggedShuffle(players, rigged)
        logger.log([{ color: players[turn].info.color, text: players[turn].name + "s" }, { color: "black", text: " tur" }])
    }
    currentMenu = undefined
}


// game.id = generateId(13) Can replace if necessary
function saveGame(online = false) {
    if (!board || !players) return
    let key = online ? "monopolyOnlineGames" : "monopolyGames"
    let games = JSON.parse(localStorage.getItem(key) ?? "[]")

    delete board.peer
    let tmpBoard = JSON.parse(JSON.prune(board, 4));
    tmpBoard.boardPieces = undefined;
    let game = {
        board: JSON.prune(tmpBoard, 6),
        boardPieces: JSON.prune(board.boardPieces, 2),
        saveVersion: latestSaveVersion,
        players: players.map(e => JSON.prune(e, 6)),
        turn: turn,
        currentTime: new Date().getTime(),
        screenshot: canvas.toDataURL(),
        currentMenu: { class: currentMenu?.constructor.name, value: JSON.prune(currentMenu) },
        logger: JSON.prune(logger.info),
        compressedImage: false
    }

    if (board.id !== undefined) game.id = board.id
    else if (games.length > 0) game.id = JSON.parse(games[games.length - 1]).id + 1
    else game.id = 0

    let tmpGame = JSON.prune(game)
    let pushed = false
    games.forEach((oldGame, i) => {
        if (JSON.parse(oldGame).id == game.id) {
            pushed = true
            games[i] = tmpGame
        }
    })
    if (!pushed) games.push(tmpGame);

    const SAVEGAMEMARGIN = 500000;

    if (localStorageSpace() > localStorageMaxSpace() - SAVEGAMEMARGIN) {
        games.splice(games.indexOf(games.toSorted((a, b) => JSON.parse(a).currentTime - JSON.parse(b).currentTime)[0]), 1);
    };


    localStorage.setItem(key, JSON.prune(games))
}

function loadGame(gameToLoad, index) {
    let boardToLoad = JSON.parse(gameToLoad.board)
    let boardPiecesToLoad = JSON.parse(gameToLoad.boardPieces);
    let local = currentMenu instanceof LoadGames
    if (local) window.onbeforeunload = saveGame

    // Board (settings)
    board = local ? new Board() : new OnlineBoard(currentMenu.hosting, currentMenu.peer) // ONLINE VS LOCAL
    currentMenu = undefined
    board.id = gameToLoad.id
    turn = gameToLoad.turn
    board.settings = boardToLoad.settings
    for (let [key, value] of Object.entries(boardToLoad)) if (typeof value != "object" && key !== "hosting") board[key] = value

    // Players
    let playersToLoad = gameToLoad.players.map(e => JSON.parse(e))
    for (let i = 0; i < playersToLoad.length; i++) {
        let playerData = playersToLoad[i]
        let player = new Player(playerData.color, playerData.name, local || index === i) // ONLINE VS LOCAL

        players.push(player)
        board.boardPieces[0].playersOnBoardPiece.splice(-1)
        board.boardPieces[(playerData.pos === 40 ? 10 : playerData.pos)].playersOnBoardPiece.push(player)

        for (let [key, value] of Object.entries(playerData)) if (typeof value != "object" && key !== "playing") player[key] = value
        for (let ownedBoardPiece of playerData.ownedPlaces) {
            let bP = board.boardPieces[ownedBoardPiece.n]

            player.ownedPlaces.push(bP)
            bP.owner = player
            bP.level = ownedBoardPiece.level
            bP.mortgaged = ownedBoardPiece.mortgaged
        }
    }
    if (board.playerIsWalkingTo) players[turn].teleportTo(board.playerIsWalkingTo)
    board.boardPieces.forEach((e, i) => {
        board.boardPieces[i].earned = boardPiecesToLoad[i].earned;
    })

    logger = new Logger();
    logger.info = JSON.parse(gameToLoad.logger);

    // currentMenu
    let currentMenuClass = eval(gameToLoad.currentMenu.class)
    if (!currentMenuClass) return

    let currentMenuValue = JSON.parse(gameToLoad.currentMenu.value)
    let requiredArgs = getClassContructorParams(currentMenuClass)
    let argsToInsert = []
    for (let arg of requiredArgs) {
        let value = currentMenuValue[arg.trim()]
        if (value) argsToInsert.push(value)
    }
    currentMenu = applyToConstructor(currentMenuClass, argsToInsert)

    for (let [key, value] of Object.entries(currentMenuValue)) {
        if (typeof value !== "object") currentMenu[key] = value
        else if (key === "card") currentMenu["card"] = value
    }

}

function update() {
    requestAnimationFrame(update);

    renderC.clearRect(0, 0, renderCanvas.width, renderCanvas.height)
    c.clearRect(0, 0, canvas.width, canvas.height);

    textInputs.forEach(e => { e.htmlElement.style.display = "none" })

    board?.update();
    currentMenu?.draw();
    logger?.draw();

    hoverList.forEach((e, i) => {
        c.font = 20 + "px " + "verdanai";
        c.drawText(e, Math.max(c.measureText(e).width / 2 + 5, mouse.x), mouse.y + 35 * (i + 1) - 10, 20, "center", "black", { color: "white", blur: 5 });
    })
    hoverList = [];

    //c.drawText(fps, 5, 80, 20)

    renderC.drawImage(canvas, 0, 0, renderCanvas.width, renderCanvas.height);

    renderCanvas.style.cursor = logger?.hover || logger?.follow || (players.map(e => e.hover).includes(true) || board?.boardPieces.map(e => e.hover).includes(true) || buttons?.map(e => (e.hover && !e.disabled)).includes(true)) ? "pointer" : "auto"

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
        this.loadButton.disabled = (JSON.parse(localStorage.getItem("monopolyGames")) == undefined || JSON.parse(localStorage.getItem("monopolyGames")).length == 0);

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
    constructor(online = false, selectedId) {
        this.scroll = 0;
        let self = this;
        this.key = online ? "monopolyOnlineGames" : "monopolyGames"

        this.backButton = new Button({ x: 10, y: 10, w: 325, h: 60 }, images.buttons.back, function () { currentMenu = online ? new PublicGames() : new MainMenu() });
        this.startButton = new Button({ x: canvas.width / 4 - 194 / 2, y: canvas.height - 70, w: 194, h: 60 }, images.buttons.start, function () {
            let game = self.games[self.gameButtons.indexOf(self.selected)]
            if (!online) loadGame(game)
            else currentMenu = new OnlineJoinLobby(true, { game: game })
        })

        this.deleteButton = new Button({ x: canvas.width / 4 + 194 / 2 + 20, y: canvas.height - 60, w: 40, h: 40, hoverText: "Radera sparfil" }, images.buttons.sellbutton, function () {
            let index = self.gameButtons.indexOf(self.selected);
            self.games.splice(index, 1);

            let tmpGames = self.games.map(e => JSON.prune(e));
            localStorage.setItem(self.key, JSON.prune(tmpGames));
            self.init();
            if (self.games[index]) {
                self.gameButtons[index].selected = true;
                self.gameButtons[index].onClick();
            } else if (self.games[index - 1]) {
                self.gameButtons[index - 1].selected = true;
                self.gameButtons[index - 1].onClick();
            }
            if (JSON.parse(localStorage.getItem(self.key)).length == 0) {
                currentMenu = new MainMenu();
            }
        })
        this.statButton = new Button({ x: canvas.width / 4 - 194 / 2 - 20 - 40, y: canvas.height - 60, w: 40, h: 40, hoverText: "Statistik" }, images.buttons.statbutton, function () {
            let game = self.games[self.gameButtons.indexOf(self.selected)]
            currentMenu = new StatMenu(game)
        })

        this.image = new Image();
        this.selected = undefined;
        this.selectedIdForStart = selectedId;

        this.init()


    }
    init() {
        let self = this;
        this.games = (JSON.parse(localStorage.getItem(this.key)) || []).map(e => JSON.parse(e))
        this.games = this.games.sort((a, b) => b.currentTime - a.currentTime)
        this.gameButtons = [];
        this.games.forEach((game, i) => {
            this.gameButtons.push(new Button({ x: 500, y: 10 + i * 50, w: 450, h: 40, text: new Date(game.currentTime).today() + " " + new Date(game.currentTime).timeNow(), textSize: 30, selectButton: true }, images.buttons.saveselect, function () {
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
        if (this.selectedIdForStart !== undefined) {
            this.games.forEach((e, i) => {
                if (e.id == this.selectedIdForStart) {
                    this.gameButtons[i].onClick()
                    this.gameButtons[i].selected = true;
                }
            })
        }
    }
    draw() {
        c.drawImageFromSpriteSheet(images.menus.lobbymenu);
        this.backButton.update();
        this.gameButtons.forEach(e => e.update());
        this.selected = this.gameButtons.filter(e => e.selected)[0];
        if (this.selected) {
            c.lineWidth = 2;
            c.strokeStyle = "black";
            c.strokeRect(0, canvas.height / 4 - 2, canvas.width / 2 + 2, canvas.height / 2 + 4);
            c.drawImage(this.image, 0, canvas.height / 4);
            c.drawText("Spelversion: " + latestSaveVersion, 10, 440, 20, "left", latestSaveVersion == this.games[this.gameButtons.indexOf(this.selected)].saveVersion ? "green" : "red")
            c.drawText("Sparfilsversion: " + this.games[this.gameButtons.indexOf(this.selected)].saveVersion, 10, 460, 20, "left", latestSaveVersion == this.games[this.gameButtons.indexOf(this.selected)].saveVersion ? "green" : "red")
        }
        this.startButton.disabled = !this.selected || JSON.parse(this.games[this.gameButtons.indexOf(this.selected)].board).done || !(latestSaveVersion == this.games[this.gameButtons.indexOf(this.selected)].saveVersion)
        this.deleteButton.disabled = !this.selected
        this.statButton.disabled = !this.selected || !(latestSaveVersion == this.games[this.gameButtons.indexOf(this.selected)].saveVersion)
        this.startButton.update();
        this.deleteButton.update();
        this.statButton.update();

        let text = localStorageSpace(true, 2) + "/" + localStorageMaxSpace(true, 2);
        c.drawText(text, 420, 50, c.getFontSize(text, 150, 30), "center")
    }
    scrollFunc() {
        this.scroll = this.scroll.clamp(-((this.gameButtons.length - 10) * 50 - 10), 0);
        for (let i = 0; i < this.gameButtons.length; i++) {

            let button = this.gameButtons[i];
            button.y = 10 + i * 50 + this.scroll;
        }
    }
}
class StatMenu {
    constructor(game) {
        this.game = game;
        this.game.players = this.game.players.map(e => JSON.parse(e));
        this.game.boardPieces = JSON.parse(this.game.boardPieces);
        this.game.players.forEach(player => {
            player.ownedPlaces.forEach(place => {
                this.game.boardPieces[place.n].owner = player;
            })
        })
        this.stats = StatTypes;
        this.currentStat = 0;
        this.order = -1;
        this.scroll = 0;
        this.backButton = new Button({ x: 10, y: 10, w: 325, h: 60 }, images.buttons.back, () => {
            currentMenu = new LoadGames(false, this.game.id);
        });

        this.sortOrder = new Button({ x: canvas.width - 50, y: 20, w: 40, h: 40, rotation: 180 }, images.buttons.arrowup, () => {
            this.sortOrder.rotation += 180;
            this.order *= -1;
            this.scroll = 0;
        });

        this.moveRight = new Button({ x: canvas.width - 50 - 60, y: 20, w: 40, h: 40, rotation: 90 }, images.buttons.arrowup, () => {
            this.currentStat++;
            this.currentStat %= this.stats.length;
            this.currentStat = Math.abs(this.currentStat);
            this.scroll = 0;
        });
        this.moveLeft = new Button({ x: 325 + 10 + 10, y: 20, w: 40, h: 40, rotation: 270 }, images.buttons.arrowup, () => {
            this.currentStat--;
            this.currentStat %= this.stats.length;
            this.currentStat = Math.abs(this.currentStat);
            this.scroll = 0;
        });
    }
    draw() {
        c.drawImageFromSpriteSheet(images.menus.lobbymenu);


        if (this.stats[this.currentStat].variable[0] == "player") {
            this.scroll = 0;
            this.game.players.sort((a, b) => this.order * a[this.stats[this.currentStat].variable[1]] - this.order * b[this.stats[this.currentStat].variable[1]])
            this.game.players.forEach((player, index) => {
                c.drawText(player.name, 10, 120 + index * 55 + this.scroll, c.getFontSize(player.name, 325, 50), "left", player.info.color)

                c.drawText(player[this.stats[this.currentStat].variable[1]] + this.stats[this.currentStat].unit, 10 + 340, 120 + index * 55 + this.scroll, 50, "left")
            })
        } else if (this.stats[this.currentStat].variable[0] == "boardpiece") {
            let filteredboardpieces = this.game.boardPieces.filter((e) => pieces[e.n]?.name && pieces[e.n]?.name !== "Start" && pieces[e.n]?.name !== "fängelse" && pieces[e.n]?.name !== "Fri parkering" && pieces[e.n]?.name !== "Gå till finkan" && pieces[e.n]?.name !== "Chans" && pieces[e.n]?.name !== "Allmänning")
            this.scroll = this.scroll.clamp(-((filteredboardpieces.length - 8) * 55 - 20), 0)
            this.game.boardPieces.sort((a, b) => this.order * a[this.stats[this.currentStat].variable[1]] - this.order * b[this.stats[this.currentStat].variable[1]])
            filteredboardpieces.forEach((boardPiece, index) => {
                c.drawText(pieces[boardPiece.n]?.name, 10, 120 + index * 55 + this.scroll, c.getFontSize(pieces[boardPiece.n]?.name, 325, 50), "left", pieces[boardPiece.n]?.color || "black", { color: "black", blur: 10 })

                c.drawText(boardPiece.owner?.name || "Banken", 10 + 340, 120 + index * 55 + this.scroll, c.getFontSize(boardPiece.owner?.name || "Banken", 250, 50), "left", boardPiece.owner?.info?.color || "black")

                c.drawText(boardPiece[this.stats[this.currentStat].variable[1]] + this.stats[this.currentStat].unit, 10 + 340 + 265, 120 + index * 55 + this.scroll, c.getFontSize(boardPiece[this.stats[this.currentStat].variable[1]] + this.stats[this.currentStat].unit, 320, 50), "left", "black")

            })
        }
        c.drawImageFromSpriteSheet(images.menus.lobbymenu, { cropH: 75, h: 75 });
        this.backButton.update();
        this.sortOrder.update();
        this.moveLeft.update();
        this.moveRight.update();
        c.drawText(this.stats[this.currentStat].name, 335 + 287, 60, c.getFontSize(this.stats[this.currentStat].name, 440, 50), "center")
    }
}
class PublicGames {
    constructor() {
        this.backButton = new Button({ x: 10, y: 10, w: 325, h: 60 }, images.buttons.back, function () { currentMenu = new MainMenu() });
        this.joinID = new TextInput({ x: 340, y: 10, w: 200, h: 60, maxLength: 6, textSize: 45, placeHolder: "ID" })
        this.joinButton = new Button({ x: 550, y: 10, w: 195, h: 60 }, images.buttons.joingame, () => { currentMenu = new OnlineLobby(false, this.joinID.value) });
        this.hostButton = new Button({ x: 750, y: 10, w: 195, h: 60 }, images.buttons.hostgame, function () { currentMenu = new OnlineLobby(true) });
        this.loadButton = new Button({ x: 750, y: 82, w: 195, h: 52 }, images.buttons.load, function () { currentMenu = new LoadGames(true) });
    }
    draw() {
        c.drawImageFromSpriteSheet(images.menus.lobbymenu);
        this.joinButton.disabled = this.joinID.value?.length < 6;
        this.backButton.update();
        this.joinID.draw();
        this.joinButton.update();
        this.hostButton.update();
        this.loadButton.disabled = (JSON.parse(localStorage.getItem("monopolyOnlineGames")) == undefined || JSON.parse(localStorage.getItem("monopolyOnlineGames")).length == 0);
        this.loadButton.update()
    }
}

class OnlineLobby {
    constructor(hosting, id, createPeer = true) {
        this.hosting = hosting
        this.players = []
        this.settings = []
        this.playersPlaying = 0

        if (this.hosting) {
            if (createPeer) this.peer = createHost()
            this.initPlayers(8)
            this.startButton = new Button({ x: 10, y: canvas.height - 70, w: 194, h: 60 }, images.buttons.start, () => {
                let tmpPlayers = []

                for (let i = 0; i < this.players.length; i++) {
                    let player = this.players[i]
                    if (!player.client) break
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
            if (createPeer) this.peer = connectToHost(id)
            this.initPlayers(1)
        }

        this.selectedColors = []
        this.backButton = new Button({ x: 10, y: 10, w: 325, h: 60 }, images.buttons.back, () => {
            if (this.hosting) Object.values(this.peer.clients).forEach(client => client.connection.close())
            else this.peer.connection.close()
            currentMenu = new PublicGames()
        })
        this.prev = -1

        setTimeout(() => {
            this.spectatorButton = createSpectatorButton(0)
            this.spectatorButton.selected = true
        }, 10)
    }
    initPlayers(amount) {
        let self = this;
        let off = this.players.length
        for (let i = off; i < amount + off; i++) {
            this.players.push(
                {
                    textInput: new TextInput({ x: 10, y: 80 + 48 * i, w: 300, h: 45, maxLength: 15, textSize: 40 }),
                    colorButton: new Button({ x: 320, y: 82 + 48 * i, w: 40, h: 40, selectButton: true, disableSelectTexture: true, disableDisabledTexture: true }, images.playercolorbuttons.unselected, () => {
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

            player.client = undefined
            player.textInput.htmlElement.disabled = true
            player.textInput.htmlElement.style.backgroundColor = ""
            player.textInput.htmlElement.oninput = () => {
                let text = player.textInput.htmlElement.value
                if (this.hosting) sendPlayers({ name: text })
                else sendMessage(currentMenu.peer.connection, "nameChange", text)
            }

            player.colorButton.disabled = true
            player.colorButton.disableDisabledTexture = true
        }
    }

    draw() {
        c.drawImageFromSpriteSheet(images.menus.lobbymenu);
        this.backButton.update();
        this.spectatorButton?.update()
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
        this.startButton.disabled = this.players.some(p => p.client && p.textInput.htmlElement.style.backgroundColor !== "") || this.playersPlaying < 2
        this.startButton.update();

        c.drawText("Id: " + this.peer.id, 250, canvas.height - 30, 30)
        if (detectCollision(240, canvas.height - 60, 180, 40, mouse.x, mouse.y, 1, 1)) {
            c.drawText("Id: " + this.peer.id, 250, canvas.height - 30, 30, "left", "blue")
            if (mouse.down) {
                mouse.down = false
                //navigator.clipboard.writeText(`${window.location.href}?lobbyId=${this.peer.id}`)
                navigator.clipboard.writeText(this.peer.id)

                //currentMenu.players[0].textInput.htmlElement.value = "Player 1" // TEMP
                //setTimeout(() => { currentMenu.players[0].confirmButton.onClick() }, 100) // TEMP
            }
        }
    }
}

class OnlineJoinLobby extends OnlineLobby {
    constructor(hosting, options = {}) {
        super(hosting, options.id, false)
        this.players = []
        this.settings = []
        this.selectedPlayer = -1
        this.peer = options.client

        if (this.hosting) {
            let game = options.game
            this.peer = createHost() // Override this.peer if options.client is undefined
            this.initPlayers(game.players.map(e => JSON.parse(e)))

            Object.values(JSON.parse(game.board).settings).forEach((value, i) => {
                let length = settings.length
                let mainSetting = settings[i]
                let htmlSetting

                if (mainSetting.type === "select") {
                    htmlSetting = new Button({ x: 450, y: splitPoints(length, canvas.height, 35, i), w: 500, h: 35, selectButton: true, text: mainSetting.title, textSize: c.getFontSize(mainSetting.title, 470, 32), color: "black", disableDisabledTexture: true }, images.buttons.setting, () => sendPlayers(this.peer))
                    htmlSetting.selected = value
                } else if (mainSetting.type === "slider") {
                    htmlSetting = new Slider({ x: 450, y: splitPoints(length, canvas.height, 35, i), w: 500, h: 35, from: mainSetting.from, to: mainSetting.to, unit: mainSetting.unit, steps: mainSetting.steps, beginningText: mainSetting.title }, () => sendPlayers(this.peer))
                    htmlSetting.percentage = value / (mainSetting.to - mainSetting.from)
                    htmlSetting.value = value
                }
                htmlSetting.disabled = true
                this.settings.push(htmlSetting)
            })

            this.startButton = new Button({ x: 10, y: canvas.height - 70, w: 194, h: 60 }, images.buttons.start, () => {
                loadGame(game, this.selectedPlayer)
                if (this.hosting) sendMessageToAll("startGame", game)
            })
        }
    }
    initPlayers(playersData) {
        let self = this;
        let off = this.players.length
        for (let i = off; i < playersData.length + off; i++) {
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

            let playerData = playersData[i]
            let player = this.players[i]

            player.textInput.htmlElement.disabled = true
            player.textInput.htmlElement.value = playerData.name
            player.textInput.htmlElement.style.backgroundColor = playerData.selected ? "" : "white"

            player.selectedColor = playerData.color
            player.colorButton.disabled = true
            player.colorButton.disableDisabledTexture = true

            player.confirmButton = new Button({
                x: 370,
                y: 82 + 48 * i,
                w: 40,
                h: 40
            }, playerData.selected ? images.buttons.no : images.buttons.yes, (invalid = false, client = undefined) => {
                let state = player.confirmButton.image === images.buttons.yes ? true : false
                if (!invalid) this.selectedPlayer = state ? i : -1

                if (state) {
                    player.confirmButton.image = images.buttons.no
                    player.textInput.htmlElement.style.backgroundColor = ""
                    currentMenu.players.forEach((e, j) => e.confirmButton.disabled = j !== i)
                } else {
                    player.confirmButton.image = images.buttons.yes
                    player.textInput.htmlElement.style.backgroundColor = "white"
                    currentMenu.players.forEach(e => e.confirmButton.disabled = e.confirmButton.image === images.buttons.no)
                }

                if (this.hosting) sendPlayers({ selected: state })
                else if (!invalid) sendMessage(this.peer.connection, "choosePlayer", { index: i, selected: state })
            })
            player.confirmButton.disabled = ((playerData.selected || this.selectedPlayer !== -1) && (i !== this.selectedPlayer))
            player.confirmButton.disableDisabledTexture = true
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
        this.settings.forEach(setting => setting.update());

        if (!this.hosting) return

        this.startButton.disabled = Object.entries(this.peer.clients).length === 0 ||
            !this.players.every(player => player.textInput.htmlElement.style.backgroundColor === "")
        this.startButton.update();

        c.drawText("Id: " + this.peer.id, 250, canvas.height - 30, 30)
        if (detectCollision(240, canvas.height - 60, 180, 40, mouse.x, mouse.y, 1, 1)) {
            c.drawText("Id: " + this.peer.id, 250, canvas.height - 30, 30, "left", "blue")
            if (mouse.down) {
                mouse.down = false
                //navigator.clipboard.writeText(`${window.location.href}?lobbyId=${this.peer.id}`)
                navigator.clipboard.writeText(this.peer.id)

                //currentMenu.players[0].textInput.htmlElement.value = "Player 1" // TEMP
                //setTimeout(() => { currentMenu.players[0].confirmButton.onClick() }, 100) // TEMP
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
        this.statButton = new Button({ x: canvas.width / 2 - 120 + splitPoints(5, 240, 40, 2), y: canvas.height / 2 + 25, w: 40, h: 40, hoverText: "Visa Statistik" }, images.buttons.statbutton, function () {
            exitGame();
            setTimeout(() => {
                let games = (JSON.parse(localStorage.getItem("monopolyGames")) || []).map(e => JSON.parse(e))
                games = games.sort((a, b) => b.currentTime - a.currentTime)
                let game = games[0];
                currentMenu = new StatMenu(game);

            }, 60);
            currentMenu = undefined;

        });
        this.exitButton = new Button({ x: canvas.width / 2 - 120 + splitPoints(5, 240, 40, 3), y: canvas.height / 2 + 25, w: 40, h: 40, hoverText: "Återvänd till Huvudmenyn" }, images.buttons.yes, function () {
            if (currentMenu.constructor.name == "SmallMenu") currentMenu = undefined;
            if (board.constructor.name === "Board") { exitGame(); return }
            if (board.hosting) {
                Object.values(board.peer.clients).forEach(client => client.connection.close())
                board.peer.clients = {}
                exitGame(true)
            } else {
                board.peer.connection.close()
                currentMenu = new PublicGames()
            }
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
        this.statButton.disabled = (board instanceof OnlineBoard);
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

        this.rollDiceButton = new Button({ x: canvas.width / 2 - 123 + boardOffsetX, y: canvas.height / 2 + boardOffsetY, w: 246, h: 60 }, images.buttons.rolldice, this.rollDice)
        this.nextPlayerButton = new Button({ x: canvas.width / 2 - 123 + boardOffsetX, y: canvas.height / 2 + boardOffsetY, w: 246, h: 60 }, images.buttons.nextplayer, this.nextPlayer);

        this.menuButton = new Button({ x: 0, y: canvas.height - 40, w: 80, h: 40 }, images.buttons.menu, function () { currentMenu = new SmallMenu() })
        this.muteButton = new Button({ x: 80, y: canvas.height - 40, w: 40, h: 40, hoverText: "Tysta ljudet" }, images.buttons.music);

        this.init();
    }
    rollDice() {
        players[turn].rollDice();
        board.playerHasRolled = true;
        logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " har kastat tärningarna", color: "black" }])
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
        if (players[turn].inPrison) {
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

        c.drawText("Just nu:" + players[turn].name, canvas.width / 2 + 170, canvas.height - 10, c.getFontSize("Just nu:" + players[turn].name, 220, 30), "center", players[turn].info.color)

        if (this.settings.giveAllTaxToParking) {
            c.drawText(this.money + "kr", canvas.width / 2, 220, 20, "center", "gold")
        }

        this.dices.draw();

        this.nextPlayerButton.disabled = players[turn].money < 0;


        if (this.dices.hidden && !currentMenu && (this.playerIsWalkingTo === false)) {
            this.menuButton.update();
            this.muteButton.update();
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
        c.drawImageFromSpriteSheet(images.static.insideboard, { x: canvas.width / 2 - 286 + boardOffsetX, y: canvas.height / 2 - 143 + boardOffsetY })
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

        if (this.hosting) window.onbeforeunload = function () {
            Object.values(board.peer.clients).forEach(client => client.connection.close())
            saveGame(true)
        }

        this.rollDiceButton = new Button({ x: canvas.width / 2 - 123 + boardOffsetX, y: canvas.height / 2 + boardOffsetY, w: 246, h: 60 }, images.buttons.rolldice, () => {
            let dice1 = randomIntFromRange(1, 6)
            let dice2 = randomIntFromRange(1, 6)
            if (this.hosting) {
                resetReady()
                sendMessageToAll("throwDices", { dice1: dice1, dice2: dice2 })
                this.rollDice(dice1, dice2)
                board.cardId = randomIntFromRange(0, 999999);
                sendMessageToAll("saveCardId", board.cardId);
            } else sendMessage(this.peer.connection, "requestDiceRoll")
        })
        this.nextPlayerButton = new Button({ x: canvas.width / 2 - 123 + boardOffsetX, y: canvas.height / 2 + boardOffsetY, w: 246, h: 60 }, images.buttons.nextplayer, () => {
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
}

class PrisonMenu {
    constructor() {
        this.payButton = new Button({ x: canvas.width / 2 - 138 + splitPoints(3, 276, 82, 0), y: canvas.height / 2 + 50, w: 82, h: 35 }, images.buttons.prisonpay, function (request = true) {
            if (requestAction("buyPrison", undefined, request)) return

            players[turn].money -= 50;
            board.money += board.settings.giveAllToParking ? 50 : 0;
            players[turn].getOutOfPrison();
            soundEffects.play("cash");
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " betalade 50kr för att", color: "black" }])
            logger.log([{ text: "lämna finkan", color: "black" }])

            currentMenu = undefined;
        });
        this.rollDiceButton = new Button({ x: canvas.width / 2 - 138 + splitPoints(3, 276, 82, 1), y: canvas.height / 2 + 50, w: 82, h: 35 }, images.buttons.prisonrolldice, function (request = true, rigged1 = randomIntFromRange(1, 6), rigged2 = randomIntFromRange(1, 6)) {
            if (requestAction("rollPrison", { rigged1: rigged1, rigged2: rigged2 }, request)) return
            resetReady()
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " kastade tärningarna för att", color: "black" }])
            logger.log([{ text: "försöka lämna finkan", color: "black" }])

            board.dices.roll(function (dice1, dice2) {
                readyUp()
                if (dice1 == dice2) {
                    players[turn].getOutOfPrison();
                    players[turn].teleportTo(players[turn].pos + dice1 + dice2);
                    logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " lyckades rymma från finkan", color: "black" }])

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
        this.cardButton = new Button({ x: canvas.width / 2 - 138 + splitPoints(3, 276, 82, 2), y: canvas.height / 2 + 50, w: 82, h: 35 }, images.buttons.prisongetoutofjail, function (request = true) {
            if (requestAction("prisonCardPay", undefined, request)) return

            players[turn].getOutOfPrison();
            players[turn].prisonCards--;
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " använde ett fängelsekort", color: "black" }])
            logger.log([{ text: "för att lämna finkan", color: "black" }])

            currentMenu = undefined;
        });
    }
    draw() {
        if (!board.ready || !players[turn].playing) return

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
        this.earned = 0;

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
        let isometricMouse = { x: to_grid_coordinate(mouse.x - boardOffsetX, mouse.y - boardOffsetY).x, y: to_grid_coordinate(mouse.x - boardOffsetX, mouse.y - boardOffsetY).y }
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
            offsetY: (this.hover ? 1 : 0) + boardOffsetY,
            offsetX: boardOffsetX
        })
        if (this.owner !== undefined) {
            c.drawIsometricImage(images.players[this.owner.info.ownedImg], {
                x: this.drawX + (Math.floor(this.n / 10) === 2 ? -12 : 0),
                y: this.drawY,
                w: 96,
                cropW: 96,
                cropX: this.textureStart,
                offsetY: (this.hover ? 1 : 0) + boardOffsetY,
                offsetX: boardOffsetX
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
            offsetY: (this.hover ? 1 : 0) + boardOffsetY,
            offsetX: boardOffsetX
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
            soundEffects.play("cash");
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
                    cropY: 0,
                    offsetX: boardOffsetX,
                    offsetY: boardOffsetY
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
                cropY: 0,
                offsetX: boardOffsetX,
                offsetY: boardOffsetY
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
            readyUp();
        } else {
            readyUp();
        }
    }
    buy(request = true) {
        if (requestAction("buyProperty", this.n, request)) return


        players[turn].money -= this.info.price;
        board.money += board.settings.giveAllToParking ? this.info.price : 0;
        this.owner = players[turn];
        players[turn].ownedPlaces.push(this);
        players[turn].hasBought = true;
        soundEffects.play("cash");

        logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " köpte " }, { text: this.info.name, color: this.info.color }])
    }
    sell(request = true) {
        if (requestAction("sellProperty", this.n, request)) return

        players[turn].money += this.mortgaged ? 0 : this.info.price / 2;
        this.owner = undefined;
        players[turn].ownedPlaces.splice(players[turn].ownedPlaces.indexOf(this), 1);
        soundEffects.play("cash");

        logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " sålde " }, { text: this.info.name, color: this.info.color }])

    }
    upgrade() {
        this.level++;
        players[turn].money -= this.info.housePrice;
        board.money += board.settings.giveAllToParking ? this.info.housePrice : 0;
        soundEffects.play("cash");

        logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " köpte hus i " }, { text: this.info.name, color: this.info.color }])

    }
    mortgage(request = true) {
        if (requestAction("mortgageProperty", this.n, request)) return

        this.mortgaged = !this.mortgaged;
        players[turn].money += (this.mortgaged ? this.info.price / 2 : -(this.info.price / 2) * 1.1)
        soundEffects.play("cash");
        logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " intecknade " }, { text: this.info.name, color: this.info.color }])

    }
    downgrade() {
        this.level--;
        players[turn].money += this.info.housePrice / 2;
        soundEffects.play("cash");
        logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " sålde hus i " }, { text: this.info.name, color: this.info.color }])

    }
    payRent() {
        if (!(!this?.owner?.inPrison || board.settings.prisonpay)) return
        let colorGroup = board.getColorGroup(this.info.group);
        currentMenu = new Bankcheck(players.indexOf(this.owner), turn, this.info.rent[this.level] * ((colorGroup.length == colorGroup.filter(e => e.owner == this.owner).length && board.settings.doublePay) ? 2 : 1), "Hyra")
        players[turn].lastPayment = this.owner;
        this.earned += this.info.rent[this.level] * ((colorGroup.length == colorGroup.filter(e => e.owner == this.owner).length && board.settings.doublePay) ? 2 : 1);
    }
}
class Station extends BuyableProperty {
    step() {
        if (this.owner == undefined && players[turn].playing) {
            this.openCard();
            readyUp();
        } else if (this.owner != undefined && this.owner != players[turn]) {
            this.level = (this.owner.ownedPlaces.filter(e => e.constructor.name == "Station").length) - 1;
            this.payRent();
            readyUp();
        } else {
            readyUp();
        }
    }
}
class Utility extends BuyableProperty {
    step(steps) {
        if (this.owner == undefined && players[turn].playing) {
            this.openCard();
            readyUp();
        } else if (this.owner != players[turn] && this.owner != undefined) {
            if (!(!this.owner?.inPrison || board.settings.prisonpay)) return
            let amount = this.owner.ownedPlaces.filter(e => e.constructor.name == "Utility").length;
            if (steps == undefined) {
                let self = this;
                board.dices.roll(function (dice1, dice2) {
                    self.pay(dice1 + dice2, amount);
                    board.dices.hidden = true;
                    readyUp();
                }, randomIntFromRange(1, 6, board.cardId), randomIntFromRange(1, 6, board.cardId * 13))
            } else {
                this.pay(steps, amount)
                readyUp();
            }

        }
    }
    pay(steps, amount) {
        let rent = steps * (amount == 1 ? 4 : 10);
        currentMenu = new Bankcheck(players.indexOf(this.owner), turn, rent, "Avgift")
        players[turn].lastPayment = this.owner;
        this.earned += rent;
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
        this.startButton = new Button({ x: canvas.width / 2 - 256 + 28, y: canvas.height / 2 + 80, w: 220, h: 40 }, images.buttons.startauction, function () {
            self.startAuction()
            readyUp();
        })
        this.auctionMoney = 0;
        this.turn = turn;
        this.minimumPay = this.boardPiece.info.price * (board.settings.lowestAuction / 100);
        this.playerlist = [...players];
        if ((this.playerlist[this.turn].money < this.auctionMoney + 2) || this.playerlist[this.turn].money < this.minimumPay) {
            this.leaveAuction();
        };

        logger.log([{ text: "En auktion har startat i ", color: "black" }, { text: board.boardPieces[cardId].info.name, color: board.boardPieces[cardId].info.color }])

    }

    startAuction() {
        let self = this;
        this.started = true;
        this.add2 = new Button({ x: canvas.width / 2 - 256 + 28 + splitPoints(3, 220, 54, 0), y: canvas.height / 2 + 10, w: 54, h: 54 }, images.buttons["auction+2"], function () { self.addMoney(2) });
        this.add10 = new Button({ x: canvas.width / 2 - 256 + 28 + splitPoints(3, 220, 54, 1), y: canvas.height / 2 + 10, w: 54, h: 54 }, images.buttons["auction+10"], function () { self.addMoney(10) });
        this.add100 = new Button({ x: canvas.width / 2 - 256 + 28 + splitPoints(3, 220, 54, 2), y: canvas.height / 2 + 10, w: 54, h: 54 }, images.buttons["auction+100"], function () { self.addMoney(100) });
        this.leaveButton = new Button({ x: canvas.width / 2 - 256 + 28, y: canvas.height / 2 + 80, w: 220, h: 40 }, images.buttons.exitauction, function () { self.leaveAuction() });
    };
    addMoney(amount, request = true) {
        if (requestAction("auctionAddMoney", amount, request)) return;
        this.auctionMoney += amount;
        if (this.auctionMoney >= this.minimumPay) {
            this.playerlist[this.turn].hasLaidOver = true;
        }
        logger.log([{ text: this.playerlist[this.turn].name, color: this.playerlist[this.turn].info.color }, { text: " la ett bud på " + this.auctionMoney + "kr", color: "black" }])

        this.nextPlayer();
    };
    leaveAuction(request = true) {
        if (requestAction("auctionLeave", undefined, request)) return;

        logger.log([{ text: this.playerlist[this.turn].name, color: this.playerlist[this.turn].info.color }, { text: " har lämnat auktionen ", color: "black" }])

        this.playerlist.splice(this.turn, 1);
        if (this.playerlist.length == 1 && this.playerlist[0].hasLaidOver) {
            this.winAuction(this.playerlist[0]);
        } else if (this.playerlist.length == 0) {
            currentMenu = undefined;
        } else {
            this.turn--
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

        logger.log([{ text: winner.name, color: winner.info.color }, { text: " vann auktionen för " + this.auctionMoney + "kr", color: "black" }])

        if (this.auctionMoney >= this.minimumPay) {
            players[playerIndex].money -= this.auctionMoney;
            board.money += board.settings.giveAllToParking ? this.auctionMoney : 0;
            soundEffects.play("cash");
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
        } else if (board.ready && this.playerlist[this.turn].playing) {
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
            if (this.playerlist[this.turn]?.name) {
                c.drawText(this.playerlist[this.turn].name, canvas.width / 2 - 190, canvas.height / 2 - 50, c.getFontSize(this.playerlist[this.turn].name, 180, 40), "left", this.playerlist[this.turn].info.color)
            }

            c.drawText(this.auctionMoney + "kr", canvas.width / 2 - 118, canvas.height / 2, 30, "center", !this.started ? "black" : (this.auctionMoney < this.minimumPay) ? "red" : "green")
        }
    }


}

class Trade {
    constructor(player1Id, player2Id) {
        let self = this;

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

        this.player1MoneySlider = new Slider({ x: canvas.width / 2 - 455 + 30, y: 100, w: 400, h: 20, from: 0, to: this.player1.money, steps: 10, unit: "kr" }, undefined, function (value = self.player1MoneySlider.percentage, request = true) {
            if (requestAction("tradeSliderChange", { id: 1, value: value }, request)) return;
            self.player1MoneySlider.percentage = value;
            self.player1MoneySlider.updateValue();
        })
        this.player2MoneySlider = new Slider({ x: canvas.width / 2 + 455 - 430, y: 100, w: 400, h: 20, from: 0, to: this.player2.money, steps: 10, unit: "kr" }, undefined, function (value = self.player2MoneySlider.percentage, request = true) {
            if (requestAction("tradeSliderChange", { id: 2, value: value }, request)) return;
            self.player2MoneySlider.percentage = value;
            self.player2MoneySlider.updateValue();
        })

        this.player1MoneySlider.disabled = !this.player1.playing;
        this.player2MoneySlider.disabled = !this.player2.playing;

        this.player1Accept = new Button({ x: canvas.width / 2 - 455 + 205 - 55, y: 460, w: 150, h: 50, selectButton: true, disableDisabledTexture: true, disabledSelectOnClick: true }, images.buttons.accept, function (request = true) {
            if (requestAction("acceptTrade", 1, request)) return;
            this.selected = !this.selected
        });
        this.player2Accept = new Button({ x: canvas.width / 2 - 455 + 900 - 455 / 2 - 55, y: 460, w: 150, h: 50, selectButton: true, disableDisabledTexture: true, disabledSelectOnClick: true }, images.buttons.accept, function (request = true) {
            if (requestAction("acceptTrade", 2, request)) return;
            this.selected = !this.selected
        });

        this.player1Accept.disabled = !this.player1.playing;
        this.player2Accept.disabled = !this.player2.playing;
        this.initProperties();
    }
    initProperties() {
        let self = this;
        this.player1Properties = [];

        this.player1.ownedPlaces.forEach((place, i, amount) => {
            if (place.level == 0 || place.info.type == "station") {
                this.player1Properties.push({
                    place: place, button: new Button({ x: 35 + splitPoints(2, 440, 186, (i % 2)), y: 130 + splitPoints(Math.ceil(amount.length / 2), 330, 21, Math.floor(i / 2)), w: 186, h: 21, textSize: 15, text: place.info.name, color: place.info.color, selectButton: true, disableDisabledTexture: true, disabledSelectOnClick: true }, images.buttons.tradingcityname, function (request = true) {
                        if (requestAction("tradeSelectProperty", { id: 1, value: i }, request)) return;
                        self.player1Accept.selected = false;
                        self.player2Accept.selected = false;
                        this.selected = !this.selected
                    })
                })
            }
        })
        this.player1Properties.forEach(e => {
            e.button.disabled = !this.player1.playing;
        })

        this.player2Properties = [];

        this.player2.ownedPlaces.forEach((place, i, amount) => {
            if (place.level == 0 || place.info.type == "station") {
                this.player2Properties.push({
                    place: place, button: new Button({ x: 450 + 35 + splitPoints(2, 440, 186, (i % 2)), y: 130 + splitPoints(Math.ceil(amount.length / 2), 330, 21, Math.floor(i / 2)), w: 186, h: 21, textSize: 15, text: place.info.name, color: place.info.color, selectButton: true, disableDisabledTexture: true, disabledSelectOnClick: true }, images.buttons.tradingcityname, function (request = true) {
                        if (requestAction("tradeSelectProperty", { id: 2, value: i }, request)) return;
                        self.player1Accept.selected = false;
                        self.player2Accept.selected = false;
                        this.selected = !this.selected
                    })
                })
            }
        })

        this.player2Properties.forEach(e => {
            e.button.disabled = !this.player2.playing;
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

        this.closeTrade(false);
    }
    closeTrade(request = true) {
        if (requestAction("closeTrade", undefined, request)) return;
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

        soundEffects.play("whoosh");
    }
    draw() {

        this.xPos -= (3 + Math.abs(this.xPos - canvas.width / 2 - 256) / 50) * deltaTime

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
        c.fillText((typeof this.from == "number") ? players[this.from].name : this.from, 500 - canvas.width / 2 - 256 + this.xPos, 335);
    }
    doCard() {
        if (typeof this.to == "number") {
            players[this.to].money += this.amount;
        }
        if (typeof this.from == "number") {
            players[this.from].money -= this.amount;


        }
        soundEffects.play("cash");
        soundEffects.play("whoosh");
        logger.log([{ text: (typeof this.from == "number") ? players[this.from].name : this.from, color: (typeof this.from == "number") ? players[this.from].info.color : "black" }, { text: " fick betala " + this.amount + "kr till", color: "black" }])
        logger.log([{ text: (typeof this.to == "number") ? players[this.to].name : this.to, color: (typeof this.to == "number") ? players[this.to].info.color : "black" }, { text: " för " + this.reason, color: "black" }])

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
            requestAction("closeCard", undefined, request)
            resetReady();
        })

        soundEffects.play("card")

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
            this.yPos -= (1 - (canvas.height / 2 - 250 - this.yPos) / 20) * deltaTime;
            if (canvas.height / 2 - 180 - this.yPos > 0) {
                this.animationStep = 1;
            }
        } else if (this.animationStep == 1) {
            this.yPos += (1 - (this.yPos - canvas.height / 2 - 128) / 50) * deltaTime;
            if (this.yPos > canvas.height / 2 - 128) {
                this.yPos = canvas.height / 2 - 128;
                this.animationStep = 2;
                readyUp();
            }
        } else if (this.animationStep == 3) {
            this.yPos -= (1 - (canvas.height / 2 - 250 - this.yPos) / 20) * deltaTime;
            if (canvas.height / 2 - 180 - this.yPos > 0) {
                this.animationStep = 4;
            }
        } else if (this.animationStep == 4) {
            this.yPos += Math.abs((1 + (this.yPos) / 20) * deltaTime);
            if (this.yPos > canvas.height) {
                this.useCard();
            }
        }

    }
    useCard() {
        let close = true;
        if (this.card.teleport !== undefined) {
            players[turn].teleportTo(this.card.teleport);
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " fick gå till ", color: "black" }, { text: board.boardPieces[Math.abs(this.card.teleport)].info.name, color: board.boardPieces[Math.abs(this.card.teleport)].info.color }])
        } else if (this.card.moneyChange) {
            players[turn].money += this.card.moneyChange;
            readyUp();
            if (this.card.moneyChange < 0) {
                board.money += board.settings.giveAllToParking ? this.card.moneyChange : 0;
                soundEffects.play("cash");
            }
            players[turn].lastPayment = undefined;
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: (Math.sign(this.card.moneyChange) == 1 ? " fick " : " förlorade ") + Math.abs(this.card.moneyChange) + "kr", color: "black" }])

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
            readyUp();
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " fick ett fängelsekort", color: "black" }])
        } else if (this.card.type == "gotoprison") {
            players[turn].goToPrison();
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " fick gå till finkan", color: "black" }])
        } else if (this.card.steps) {
            players[turn].teleportTo((players[turn].pos + this.card.steps) * Math.sign(this.card.steps))
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " fick gå till ", color: "black" }, { text: board.boardPieces[players[turn].pos + this.card.steps].info.name, color: board.boardPieces[players[turn].pos + this.card.steps].info.color }])

        } else if (this.card.gotoClosest) {
            let self = this;
            let closest = findClosest(players[turn].pos, board.boardPieces.filter(e => e.constructor.name == self.card.gotoClosest).map(e => e.n))
            players[turn].teleportTo(closest * Math.sign(closest - players[turn].pos), true);
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " fick gå till ", color: "black" }, { text: board.boardPieces[closest].info.name, color: board.boardPieces[closest].info.color }])

        } else if (this.card.properyPrice) {
            readyUp();
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
            soundEffects.play("cash");

            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " fick betala för sina hus/hotell", color: "black" }])

        } else if (this.type == "special" && (this.cardId == 0 || this.cardId == 1)) {
            players[turn].goToPrison();
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " fick gå till finkan", color: "black" }])
        } else if (this.type == "special" && this.cardId == 2) {
            readyUp();
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " fick betala " + (players[turn].money > 2000 ? 200 : Math.round(players[turn].money / 10)) + "kr i skatt", color: "black" }])
            players[turn].money -= (players[turn].money > 2000 ? 200 : Math.round(players[turn].money / 10));
            board.money += board.settings.giveAllTaxToParking ? players[turn].money > 2000 ? 200 : Math.round(players[turn].money / 10) : 0;
            soundEffects.play("cash");
            players[turn].lastPayment = undefined;
            board.boardPieces[4].earned += board.settings.giveAllTaxToParking ? players[turn].money > 2000 ? 200 : Math.round(players[turn].money / 10) : 0;


        } else if (this.type == "special" && this.cardId == 3) {
            readyUp();
            players[turn].money -= 100;
            board.money += board.settings.giveAllTaxToParking ? 100 : 0;
            soundEffects.play("cash");
            players[turn].lastPayment = undefined;
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " fick betala 100kr i skatt", color: "black" }])
            board.boardPieces[38].earned += 100;
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

        this.auctionButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(2, 234, 97, 0), y: canvas.height / 2 + 100, w: 97, h: 40 }, images.buttons.auction, function (request = true) {
            if (requestAction("startAuction", self.n, request)) return;
            if (board.hosting) {
                resetReady();
            }
            players[turn].hasBought = true;
            currentMenu = new Auction(self.n)

        });
        this.buyButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(2, 234, 97, 1), y: canvas.height / 2 + 100, w: 97, h: 40 }, images.buttons.buythislawn, function () {
            self.buyThis();
        });

        if (!this.hasUpgradeButtons) {
            this.sellButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(2, 234, 40, 0), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Sälj" }, images.buttons.sellbutton, function () { self.sellThis() })
            this.mortgageButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(2, 234, 40, 1), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Inteckna" }, images.buttons.mortgage, function () { board.boardPieces[self.n].mortgage() })
        } else {
            this.sellButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(4, 234, 40, 0), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Sälj" }, images.buttons.sellbutton, function () { self.sellThis() })
            this.mortgageButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(4, 234, 40, 1), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Inteckna" }, images.buttons.mortgage, function () { board.boardPieces[self.n].mortgage() })
            this.downgradeButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(4, 234, 40, 2), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Sälj Hus" }, images.buttons.arrowdown, function (request = true) {
                logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " sålde hus i" + board.boardPieces[self.n].info.name, color: "black" }])
                if (self.downgradeInfo?.index) {
                    if (requestAction("downgradeProperty", self.n, request)) return
                    board.boardPieces[self.downgradeInfo.index].downgrade()
                } else {
                    if (-self.downgradeInfo.price > board.boardPieces[self.n].info.housePrice && players[turn].playing) {
                        currentMenu = new CardDraw("textSpecial", "Matchen har slut på hus och^du måste nedgradera några^gator mer än en nivå.^Detta kommer att ge dig " + -self.downgradeInfo.price * 0.9 + "kr^Är du säker på att du vill^göra detta?")
                        currentMenu.useCard = function () {
                            if (requestAction("downgradeProperty", self.n, request)) return

                            self.downgradeInfo.values.forEach(e => {
                                board.boardPieces[e.n].level = e.level
                            })
                            players[turn].money -= self.downgradeInfo.price * 0.9;
                            currentMenu = undefined;
                        }
                    } else {
                        if (requestAction("downgradeProperty", self.n, request)) return

                        self.downgradeInfo.values.forEach(e => {
                            board.boardPieces[e.n].level = e.level
                        })
                        players[turn].money -= self.downgradeInfo.price * 0.9;
                    }
                }
            })
            this.upgradeButton = new Button({ x: canvas.width / 2 - 128 + 11 + splitPoints(4, 234, 40, 3), y: canvas.height / 2 + 100, w: 40, h: 40, hoverText: "Köp Hus" }, images.buttons.arrowup, function (request = true) {
                logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " köpte hus i" + board.boardPieces[self.n].info.name, color: "black" }])
                if (self.upgradeInfo?.index) {
                    if (requestAction("upgradeProperty", self.n, request)) return
                    board.boardPieces[self.upgradeInfo.index].upgrade(board instanceof OnlineBoard)
                } else {
                    if (self.upgradeInfo.price > board.boardPieces[self.n].info.housePrice && players[turn].playing) {
                        currentMenu = new CardDraw("textSpecial", "Matchen har slut på hus och^du måste uppgradera några^gator till hotell.^Detta kommer att kosta " + self.upgradeInfo.price + "kr^Är du säker på att du vill^göra detta?")
                        currentMenu.useCard = function () {
                            if (requestAction("upgradeProperty", self.n, request)) return

                            self.upgradeInfo.values.forEach(e => {
                                board.boardPieces[e.n].level = e.level
                            })
                            players[turn].money -= self.upgradeInfo.price;
                            board.money += board.settings.giveAllToParking ? self.upgradeInfo.price : 0;
                            soundEffects.play("cash");

                            currentMenu = undefined;

                        }
                    } else {
                        if (requestAction("upgradeProperty", self.n, request)) return

                        self.upgradeInfo.values.forEach(e => {
                            board.boardPieces[e.n].level = e.level
                        })
                        players[turn].money -= self.upgradeInfo.price;
                        board.money += board.settings.giveAllToParking ? self.upgradeInfo.price : 0;
                        soundEffects.play("cash");
                    }

                }
            })
        }

    };
    buyThis() {
        board.boardPieces[this.n].buy()
        this.closeCard();
    }
    sellThis() {
        board.boardPieces[this.n].sell()
        this.closeCard();
    }

    calculateUpgrade() {
        let colorGroupName = board.boardPieces[this.n].info.group;
        let colorGroup = board.getColorGroup(colorGroupName);

        if (colorGroup.length == colorGroup.filter(e => e.owner == players[turn] && !e.mortgaged).length || !board.settings.buyHouseGroup) {
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
                    this.upgradeButton.disabled = board.boardPieces[this.n].mortgaged || (!this.upgradeInfo || (board.settings.houseOnStanding ? !(players[turn].pos == this.n) : false));
                    this.downgradeButton.disabled = !this.downgradeInfo || (board.settings.houseOnStanding ? !(players[turn].pos == this.n) : false);
                    this.downgradeButton.update();
                    this.upgradeButton.update();
                }
            } else {
                this.closeButton.update();
            }
        } else {
            this.animationFactor += (0.001) * deltaTime;
            this.animationFactor *= 1 + .5 * deltaTime;
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
        this.netWorth = this.money;

        this.moneyShowerThing = new Money(this);

        this.calculateDrawPos();
        board.boardPieces[0].playersOnBoardPiece.push(this);
    }
    calculateDrawPos() {
        let index = this.inPrison && this.pos == 40 ? players.filter(e => e.inPrison).indexOf(this) : board.boardPieces[this.pos].playersOnBoardPiece.indexOf(this);

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
        this.hover = players[turn].playing && (detectCollision(coord.x + boardOffsetX, coord.y + boardOffsetY, 24, 48, mouse.x, mouse.y, 1, 1) && !currentMenu && board.dices.hidden && (board.playerIsWalkingTo == false));
        if (this.hover) { hoverList.push(this.name + ((players[turn] !== this) ? "(Föreslå bytesförslag)" : "(Du)")) }
        if (this.hover && mouse.down && (players[turn] !== this)) {
            this.moneyShowerThing.button.onClick();
            mouse.down = false;
        }

        c.drawIsometricImage(images.players[this.info.img], {
            x: this.drawX,
            y: this.drawY,
            offsetY: (this.hover ? 1 : 0) + boardOffsetY,
            offsetX: boardOffsetX
        })
        this.moneyShowerThing.update();
        this.netWorth = this.money;
        if (this.ownedPlaces.length > 0) {
            this.netWorth = this.money + this.ownedPlaces.map(e => e.info.price / 2 * (e.mortgaged ? 0 : 1))?.reduce((partialSum, a) => partialSum + a) + this.ownedPlaces.map(e => (e.info?.housePrice == undefined ? 0 : e.info?.housePrice) * e.level)?.reduce((partialSum, a) => partialSum + a);
        }
        if (this.netWorth < 0 && this.ownedPlaces.length == 0 && !this.dead) {
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
        board.playerIsWalkingTo = newPos;

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
                    soundEffects.play("movement")
                }
            }, 250)
        }


    }

    goToPrison() {
        resetReady()
        let self = this;
        board.playerHasRolled = true;
        this.inPrison = true;
        this.animateSteps(10, 1, function () {
            self.pos = 40;
            self.calculateDrawPos();
            readyUp()
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
            logger.log([{ text: players[turn].name, color: players[turn].info.color }, { text: " slog en " + (dice1 + dice2) + ":a och", color: "black" }])
            logger.log([{ text: "hamnade på ", color: "black" }, { text: board.boardPieces[(self.pos + dice1 + dice2) % 40].info.name, color: board.boardPieces[(self.pos + dice1 + dice2) % 40].info.color }])

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
        this.drawX = (this.index % 4) * 240;
        this.drawY = Math.floor(this.index / 4) * 54;

        let self = this;

        this.button = new Button({ x: this.drawX, y: this.drawY, w: 240, h: 54, hoverText: "Föreslå bytesförslag", disableDisabledTexture: true }, images.buttons.playerborder, function (player1 = players.indexOf(players[turn]), player2 = players.indexOf(self.player)) {
            if (requestAction("newTrade", { player1: player1, player2: player2 })) return;
            currentMenu = new Trade(player1, player2);
        })
    }
    update() {
        this.button.disabled = !players[turn].playing || (this.player == players[turn] || currentMenu);
        this.button.update();

        if (this.player.prisonCards > 0) {
            c.drawImageFromSpriteSheet(images.buttons.playerborderwithcard, { x: this.drawX, y: this.drawY })
        }
        if (players[turn] == this.player) {
            c.drawImageFromSpriteSheet(images.buttons.playerborderturn, { x: this.drawX, y: this.drawY })
        }

        c.drawImageFromSpriteSheet(images.players[this.player.info.img], { x: this.drawX + 2, y: 3 + this.drawY })

        c.drawText(this.player.name, this.drawX + 36, this.drawY + 22, c.getFontSize(this.player.name, 86, 18), "left", this.player.info.color)

        c.drawText(this.player.money + "kr", this.drawX + 36, this.drawY + 44, 18)


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

        soundEffects.play("dice")

        let rollAnimation = function () {
            if (counter < 300) {
                self.randomizeDice(rigged1, rigged2);
                counter *= 1.33;
                setTimeout(rollAnimation, counter);
            } else {
                if (rigged1) board.dices.dice1 = rigged1
                if (rigged2) board.dices.dice2 = rigged2
                setTimeout(() => {
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
                h: 64,
                offsetX: boardOffsetX,
                offsetY: boardOffsetY
            })
            c.drawIsometricImage(images.dices.dices, {
                x: 1050,
                y: 120,
                cropX: this.dice2Type * 64,
                cropY: (this.dice2 - 1) * 64,
                cropW: 64,
                cropH: 64,
                w: 64,
                h: 64,
                offsetX: boardOffsetX,
                offsetY: boardOffsetY
            })
        }
    }
}

class Logger {
    constructor() {
        this.height = 100;
        this.width = 192;

        this.minHeight = 100;
        this.maxHeight = 400;

        this.info = [
            [{ color: "black", text: "Spelet har startat med " + players.length + " spelare" }]
        ]

        this.follow = false;
    }
    log(item) {
        this.info.unshift(item);
    }
    draw() {
        c.fillStyle = "white"
        c.fillRect(canvas.width - 192, canvas.height - this.height, this.width, this.height);
        c.lineWidth = 2;
        c.strokeStyle = "black";
        c.strokeRect(canvas.width - 192, canvas.height - this.height, this.width, this.height);

        this.hover = detectCollision(canvas.width - 192, canvas.height - this.height - 2, this.width, 6, mouse.x, mouse.y, 1, 1);

        if (mouse.down && this.hover) {
            mouse.down = false;
            this.follow = true;
        };
        if (mouse.up && this.follow) {
            this.follow = false;
        };

        if (this.follow) {
            this.height = (canvas.height - mouse.y).clamp(this.minHeight, this.maxHeight);
        };
        if (this.hover || this.follow) {
            c.fillStyle = "gray";
            c.fillRect(canvas.width - 192, canvas.height - this.height - 2, this.width, 6)

            hoverList.push("")
        }
        this.info.forEach((i, Iindex) => {
            let last = 0;
            Object.values(i).forEach((text, index) => {
                let fontSize = 9;
                c.font = fontSize + "px verdanai";
                if ((Iindex + 1.5) * (fontSize + 5) < this.height) {
                    c.drawText(text.text, canvas.width - 192 + 10 + c.measureText(index > 0 ? i[index - 1].text : "").width + last, canvas.height - 10 - Iindex * (fontSize + 5), fontSize, "left", text.color)
                    last += c.measureText(index > 0 ? i[index - 1].text : "").width;
                }
            })
        })

    }
}

init();
