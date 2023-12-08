function generateId(length) {
    const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let id = ""
    for (let _ = 0; _ < length; _++) {
        id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    }
    return id
}

function sendMessage(connection, _type, _data) {
    connection.send({
        type: _type,
        data: _data
    })
}

function sendMessageToAll(clients, _type, _data, exceptions = []) {
    for (let client of Object.values(clients)) {
        if (!exceptions.includes(client)) sendMessage(client.connection, _type, _data)
    }
}

function removeClient(peer, id) {
    const idx = getIndexFromObject(peer.clients, id) + 1
    let values = Object.values(peer.clients)

    for (let i = idx + 1; i <= values.length; i++) {
        let player = currentMenu.players[i]
        let prevPlayer = currentMenu.players[i - 1]
        if (i <= 1) continue

        prevPlayer.selectedColor = player.selectedColor
        prevPlayer.kickButton.onClick = player.kickButton.onClick
        prevPlayer.textInput.htmlElement.value = player.textInput.htmlElement.value
        prevPlayer.textInput.htmlElement.setAttribute("placeHolder", getPlaceHolder(player))
        prevPlayer.textInput.htmlElement.style.backgroundColor = player.textInput.htmlElement.style.backgroundColor
    }

    peer.clients[id].connection.close()
    let player = currentMenu.players[values.length]

    removeColor(player.selectedColor)
    player.selectedColor = -1
    player.textInput.htmlElement.value = ""
    player.textInput.htmlElement.style.backgroundColor = ''
    player.textInput.htmlElement.setAttribute("placeHolder", "")

    delete player.kickButton
    delete peer.clients[id]
    sendPlayers(peer, undefined, undefined, undefined, undefined)
}

function removeColor(colorIdx) {
    currentMenu.selectedColors = currentMenu.selectedColors.filter(e => e !== colorIdx)
    if (currentMenu.currentMenu) currentMenu.currentMenu.selectedColors = currentMenu.currentMenu.selectedColors.filter(e => e !== colorIdx)
}

function addColor(colorIdx) {
    currentMenu.selectedColors.push(colorIdx)
    if (currentMenu.currentMenu) currentMenu.currentMenu.selectedColors.push(colorIdx)
}

function changeColor(playerIdx, from, to) {
    currentMenu.players[playerIdx].selectedColor = to
    removeColor(from)

    if (to === -1) return
    currentMenu.selectedColors.push(to)

    if (!currentMenu.currentMenu) return
    currentMenu.currentMenu.selectedColors.push(to)
    currentMenu.currentMenu.initColors()
}

function validPlayer(player, name, color) {
    let tempPlayers = currentMenu.players.filter(p2 => p2 !== player)
    let tempColors = tempPlayers.map(player => player.selectedColor)
    let valid = true
    let reason = ""
    name = name.trim()
    if (name.length < 3) { valid = false; reason = "Username must be atleast 3 characters long" }

    else if (name.length > 15) { valid = false; reason = "Username must be at most 15 characters long" }

    else if (color !== -1 && tempColors.includes(color)) { valid = false; reason = "Color is already taken" }

    else if (tempPlayers.some(p => p.textInput.htmlElement.style.backgroundColor === "" &&
        p.textInput.htmlElement.value === name)) { valid = false; reason = "Username is already taken" }

    return [valid, name, reason]
}

function waitForOpenConnection(client, callback) {
    const checkConnection = () => {
        if (client.connection.open) callback()
        else requestAnimationFrame(checkConnection)
    }

    checkConnection()
}

function getPlaceHolder(player) { return player.textInput.htmlElement.getAttribute("placeHolder") }

function sendPlayers(peer, updatedClient, text, color, selected) {
    let data_players = []
    let clients = Object.values(peer.clients)

    for (let i = 0; i < currentMenu.players.length; i++) {
        if (i > clients.length) continue

        let player = currentMenu.players[i]
        let client = peer.clients[getPlaceHolder(player)]


        if (client && client === updatedClient) {
            data_players.push({
                name: text ?? player.textInput.htmlElement.value, // Text can be ''
                color: color ?? player.selectedColor, // Color can be 0
                selected: selected ?? player.textInput.htmlElement.disabled, // Selected can be false
                placeHolder: getPlaceHolder(player),
            })
        } else {
            data_players.push({
                name: player.textInput.htmlElement.value,
                color: player.selectedColor,
                selected: player.textInput.htmlElement.disabled,
                placeHolder: getPlaceHolder(player),
            })
        }
        data_players[i].settings = currentMenu.settings.map(e => e.constructor.name === "Button" ? e.selected : e.percentage)
    }

    for (let client of clients) {
        if (client === updatedClient) continue // Don't send to updated client

        let data = data_players.filter(player => peer.clients[player.placeHolder] !== client) // Dont include self
        sendMessage(client.connection, "players", {
            players: data,
            settings: currentMenu.settings
                .map(e => e.constructor.name === "Button" ? e.selected : { percentage: e.percentage, value: e.value })
        })
    }
}
function resetReady() {
    board.readyPlayers = 0
    board.ready = false
}

function readyUp() {
    if (!board.hosting) sendMessage(board.client.connection, "ready")
    else board.readyPlayers++;
}

function createHost() {
    const peer = new Peer(generateId(6), { debug: 1 })
    peer.clients = {}

    peer.on('connection', x => {
        let id = x.peer

        x.on('open', () => {
            console.log("Id: ", id, " connected")
            // HTML
            const idx = Object.entries(peer.clients).length + 1
            const player = currentMenu.players[idx]
            player.textInput.htmlElement.style.backgroundColor = 'white'
            player.textInput.htmlElement.setAttribute('placeHolder', id)
            player.kickButton = new Button({
                x: 370,
                y: 82 + 48 * idx,
                w: 40,
                h: 40
            }, images.buttons.no, () => removeClient(peer, id))

            // Connnection
            peer.clients[id] = { connection: peer.connect(id) }

            waitForOpenConnection(peer.clients[id], () => {
                sendMessage(peer.clients[id].connection, "selectedColors", currentMenu.selectedColors)
                sendPlayers(peer, undefined, undefined, undefined, undefined)
            })
        })

        x.on('close', () => {
            removeClient(peer, id)
        })

        x.on('data', (response) => {
            const client = peer.clients[id] //
            const idx = getIndexFromObject(peer.clients, id) + 1
            let player
            if (currentMenu instanceof OnlineLobby) player = currentMenu.players[idx]
            const type = response.type
            const data = response.data
            console.log(response)



            if (type === "ready") {
                board.readyPlayers++
                if (board.readyPlayers === Object.entries(peer.clients).length + 1) {
                    board.ready = true
                    sendMessageToAll(peer.clients, "ready")
                }
            }
            if (type === "requestDiceRoll") {
                board.rollDiceButton.onClick()
            }
            if (type === "requestNextPlayer") {
                board.nextPlayerButton.onClick()
            }
            if (type === "requestBuyProperty") {
                board.boardPieces[data].buy();
            }

            if (type === 'deselect') {
                removeColor(data.color)
                player.textInput.htmlElement.style.backgroundColor = 'white'
                sendMessageToAll(peer.clients, "selectedColors", currentMenu.selectedColors)
            }
            if (type === 'select') {
                let [valid, name, reason] = validPlayer(player, data.name, data.color)

                sendMessage(client.connection, "select", { valid: valid, name: name, reason: reason })
                sendPlayers(peer, client, undefined, undefined, valid)
                if (!valid) return

                // Update HTML
                player.textInput.htmlElement.value = name
                player.textInput.htmlElement.style.backgroundColor = ""
                addColor(data.color)
                for (let p2 of currentMenu.players) if (player !== p2 && p2.selectedColor === data.color) p2.selectedColor = -1
                sendMessageToAll(peer.clients, "selectedColors", currentMenu.selectedColors, [client])
            }
            if (type === "nameChange") { player.textInput.htmlElement.value = data; sendPlayers(peer, client, data, undefined, undefined) }
            if (type === "colorChange") { player.selectedColor = data; sendPlayers(peer, client, undefined, data, undefined) }
        })
    })
    return peer
}

function connectToHost(hostId) {
    let id = generateId(6)
    const peer = new Peer(id, { debug: 1 })

    peer.on("open", id => {
        peer.connection = peer.connect(hostId)
    })

    peer.on("connection", x => {
        x.on("open", () => {
            console.log("Connected to " + x.peer)
            currentMenu.players[0].textInput.htmlElement.value = generateId(5) // TEMP
            currentMenu.players[0].confirmButton.onClick() // TEMP
        })

        x.on("close", () => {
            console.log("Connection Lost")
            currentMenu = new PublicGames()
        })

        x.on("data", (response) => {
            const player = currentMenu?.players[0]
            const type = response.type
            const data = response.data
            console.log(response)

            if (type === "ready") {
                board.ready = true
            }
            if (type === "startGame") {
                startGame(data.players, data.settings)
                players[data.index].playing = true
            }
            if (type === "throwDices") {
                board.rollDice(data.dice1, data.dice2)
                resetReady();
            }
            if (type === "nextPlayer") {
                board.nextPlayer()
                resetReady();
            }
            if (type === "buyProperty") {
                board.boardPieces[data].buy(false);
            }

            if (type === "select") {
                if (!data.valid) {
                    if (data.reason === "Color is already taken") player.selectedColor = -1
                    player.confirmButton.onClick()
                    alert(data.reason)
                } else player.textInput.htmlElement.value = data.name
            }
            if (type === "selectedColors") {
                if (data.includes(player.selectedColor)) player.selectedColor = -1

                currentMenu.selectedColors = data
                if (currentMenu.currentMenu) {
                    currentMenu.currentMenu.selectedColors = data
                    currentMenu.currentMenu.initColors()
                }
            }
            if (type === "players") {
                const players = data.players

                // Players
                currentMenu.players.splice(1)
                currentMenu.initPlayers(players.length)

                for (let i = 1; i < players.length + 1; i++) {
                    let player = currentMenu.players[i]
                    let newPlayer = players[i - 1]
                    player.textInput.htmlElement.value = newPlayer.name
                    player.selectedColor = newPlayer.color
                    player.textInput.htmlElement.setAttribute("placeHolder", newPlayer.placeHolder)
                    player.textInput.htmlElement.style.backgroundColor = newPlayer.selected ? "" : "white"
                    if (player.selected) player.confirmButton.onClick(true)
                }

                if (currentMenu.currentMenu) player.colorButton.onClick() // Resize the width on htmlElements

                // Settings
                currentMenu.settings = []
                let length = data.settings.length
                data.settings.forEach((setting, index) => {
                    const origSetting = settings[index]

                    if (typeof setting === "boolean") { // Button
                        currentMenu.settings.push(new Button({ x: 450, y: splitPoints(length, canvas.height, 35, index), w: 500, h: 35, selectButton: true, text: origSetting.title, textSize: c.getFontSize(origSetting.title, 470, 32), color: "black", disableDisabledTexture: true }, images.buttons.setting))
                        currentMenu.settings[index].selected = setting
                    } else { // Slider
                        currentMenu.settings.push(new Slider({ x: 450, y: splitPoints(length, canvas.height, 35, index), w: 500, h: 35, from: origSetting.from, to: origSetting.to, unit: origSetting.unit, steps: origSetting.steps, beginningText: origSetting.title }))
                        currentMenu.settings[index].percentage = setting.percentage
                        currentMenu.settings[index].value = setting.value
                    }
                    currentMenu.settings[index].disabled = true
                    currentMenu.settings[index].disableDisabledTexture = true
                })
            }

        })
    })

    peer.on("error", error => {
        if (error.type === "peer-unavailable") currentMenu = new PublicGames()
        else console.log(error.type)
    })
    return peer
}

window.onload = () => {
    let id = new URLSearchParams(window.location.search).get("lobbyId")
    if (id) currentMenu = new OnlineLobby(false, id)
}