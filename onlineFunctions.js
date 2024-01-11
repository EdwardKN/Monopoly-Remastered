// General
function generateId(length) {
    const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let id = ""
    for (let _ = 0; _ < length; _++) {
        id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    }
    return id
}

// Online
function sendMessage(connection, _type, _data) {
    connection.send({
        type: _type,
        data: _data
    })
}

function sendMessageToAll(_type, _data, exceptions = [], exceptionType = undefined, exceptionData = undefined) {
    if (board?.constructor.name === 'Board') return
    for (let client of Object.values(peer.clients)) {
        if (!exceptions.includes(client)) sendMessage(client.connection, _type, _data)
        else if (exceptionType) sendMessage(client.connection, exceptionType, exceptionData)
    }
}

function sendPlayers(settings = {}) {
    let updatedClient = settings.client
    delete updatedClient

    let data_players = []
    
    for (let i = 0; i < currentMenu.playersPlaying; i++) {
        let player = currentMenu.players[i]
        let client = peer.clients[player.client]

        data_players.push({
            name: player.textInput.htmlElement.value,
            color: player.selectedColor,
            selected: player.textInput.htmlElement.style.backgroundColor === '',
        })
        if (client && client === updatedClient) for (let [key, value] of Object.entries(settings)) if (key !== "client") data_players[i][key] = value
    }

    for (let client of Object.values(peer.clients)) {
        if (client === updatedClient) continue
        
        let data = data_players.filter((_, j) => peer.clients[currentMenu.players[j].client] !== client)
        sendMessage(client.connection, currentMenu instanceof OnlineJoinLobby ? "existingPlayers" : "players", {
            players: data,
            settings: currentMenu.settings
                .map(e => e.constructor.name === "Button" ? e.selected : { percentage: e.percentage, value: e.value }),
            lobbyType: currentMenu instanceof OnlineJoinLobby
        })
    }
}

function waitForOpenConnection(client, callback) {
    const checkConnection = () => {
        if (client.connection.open) callback(client.connection)
        else requestAnimationFrame(checkConnection)
    }

    checkConnection()
}

function createSpectatorButton() {
    return new Button({ x: 370, y: 20, w: 40, h: 40, selectButton: true, disableDisabledTexture: true }, images.buttons.bot, () => {
        let selected = currentMenu.spectatorButton.selected
        let player = currentMenu.players[currentMenu.playersPlaying]
        for (let p of currentMenu.players) if (p.client === peer.id) player = p

        player.colorButton.disabled = selected
        player.textInput.htmlElement.disabled = selected
        player.textInput.htmlElement.style.backgroundColor = selected ? "" : "white"

        if (currentMenu.hosting) {
            if (selected) removeHTMLPlayer(currentMenu.peer.id)
            else addHTMLPlayer(currentMenu.peer.id)
            sendPlayers()
            return
        }

        if (selected) {
            player.textInput.htmlElement.value = ""
            removeColor(player.selectedColor)
            player.selectedColor = -1
            delete player.confirmButton
        } else player.confirmButton = createConfirmButton(0)
        sendMessage(currentMenu.peer.connection, "spectator", selected)
    })
}

function createConfirmButton(i) {
    return new Button({
        x: 370,
        y: 82 + 48 * i,
        w: 40,
        h: 40,
        disableDisabledTexture: true
    }, images.buttons.yes, (forced = false) => {
        if (currentMenu.currentMenu) {
            currentMenu.players[i].colorButton.selected = false
            currentMenu.players[i].colorButton.onClick()
        }
        let player = currentMenu.players[currentMenu.playersPlaying]
        for (let p of currentMenu.players) if (p.client === peer.id) player = p
        let text = player.textInput.htmlElement

        if (currentMenu.hosting && !text.disabled && !forced) {
            let [valid, name, reason] = validPlayer(player, player.textInput.value, player.selectedColor)
                if (!valid) {
                    if (reason === "Color is already taken") player.selectedColor = -1
                    player.confirmButton.onClick(true)
                    alert(reason)
                } else player.textInput.htmlElement.value = name
        }

        if (currentMenu.hosting || forced) {
            text.disabled = !text.disabled
            let state = text.disabled
            player.confirmButton.image = state ? images.buttons.no : images.buttons.yes
            text.style.backgroundColor = state ? "" : "white"
            player.colorButton.disabled = state
        }

        if (!forced && !currentMenu.hosting) sendMessage(currentMenu.peer.connection, !text.disabled ? "select" : "deselect", { name: text.value, color: player.selectedColor })    
        if (currentMenu.hosting) sendPlayers()    
    })
}

// Lobby
function removeHTMLPlayer(id) {
    currentMenu.playersPlaying--

    for (let i = 0; i < currentMenu.players.length; i++) {
        let player = currentMenu.players[i]
        if (player.client !== id) continue
        removeColor(player.selectedColor)
        for (let j = i + 1; j < currentMenu.players.length; j++) {
            let prevPlayer = currentMenu.players[j - 1]
            let curPlayer = currentMenu.players[j]
            if (curPlayer.client === undefined) break

            setTimeout(() => { // JAVASCRIPT IS FUCKING BULLSHIT
                prevPlayer.textInput.htmlElement.value = curPlayer.textInput.htmlElement.value
                prevPlayer.textInput.htmlElement.disabled = curPlayer.textInput.htmlElement.disabled
                prevPlayer.textInput.htmlElement.style.backgroundColor = curPlayer.textInput.htmlElement.style.backgroundColor
                prevPlayer.selectedColor = curPlayer.selectedColor
                prevPlayer.colorButton.disabled = curPlayer.colorButton.disabled
                prevPlayer.client = curPlayer.client
            })
            
            let btn = curPlayer.kickButton || curPlayer.confirmButton
            delete prevPlayer.kickButton
            delete prevPlayer.confirmButton
            if (!btn) continue
            
            prevPlayer[btn === curPlayer.kickButton ? "kickButton" : "confirmButton"] = btn
            btn.y -= 48
        }

        setTimeout(() => {
            currentMenu.players.splice(currentMenu.playersPlaying)
            currentMenu.initPlayers(8 - currentMenu.playersPlaying)
        })
        break
    }
}

function addHTMLPlayer(id) {
    let newPlayer = currentMenu.players[currentMenu.playersPlaying]

    if (id === currentMenu.peer.id) {
        newPlayer.colorButton.disabled = false
        newPlayer.textInput.htmlElement.disabled = false
        newPlayer.textInput.htmlElement.style.backgroundColor = 'white'
        newPlayer.confirmButton = createConfirmButton(currentMenu.playersPlaying)
    } else {
        newPlayer.kickButton = new Button({
            x: 370,
            y: 82 + 48 * currentMenu.playersPlaying,
            w: 40,
            h: 40
        }, images.buttons.sellbutton, () => { removeClient(id); sendPlayers() })
    }

    newPlayer.textInput.htmlElement.style.backgroundColor = 'white'
    newPlayer.client = id
    currentMenu.playersPlaying++
}

function loadPlayers(players, start) {
    for (let i = start; i < players.length + start; i++) {
        let player = currentMenu.players[i]
        let playerData = players[i - start]
        
        player.textInput.htmlElement.value = playerData.name
        player.selectedColor = playerData.color
        player.textInput.htmlElement.style.backgroundColor = playerData.selected ? "" : "white"
        if (player.selected) player.confirmButton.onClick(true)
    }
    if (currentMenu.currentMenu) currentMenu.players[0].colorButton.onClick() // Resize the width on htmlElements
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

function removeClient(id) {
    removeHTMLPlayer(id)
    peer.clients[id].connection.close()
    delete peer.clients[id]
}

function removeColor(colorIdx) {
    currentMenu.selectedColors = currentMenu.selectedColors.filter(e => e !== colorIdx)
    if (currentMenu.currentMenu) currentMenu.currentMenu.selectedColors = currentMenu.currentMenu.selectedColors.filter(e => e !== colorIdx)
}

// Board
function resetReady() {
    if (board.constructor.name === 'Board') return

    board.readyPlayers = 0
    board.ready = false
}

function readyUp() {
    if (board.constructor.name === 'Board') return

    if (board.hosting) addReady()
    else sendMessage(board.peer.connection, "ready")
}

function addReady() {
    if (board.constructor.name === 'Board') return

    board.readyPlayers++
    if (board.readyPlayers === (Object.entries(peer.clients).length + 1)) {
        board.ready = true
        sendMessageToAll("ready")
    }
}

function requestAction(type, data, request = true) {
    if (request && board instanceof OnlineBoard) {
        if (board.hosting) {
            sendMessageToAll(type, data)
            return false
        } else {
            sendMessage(board.peer.connection, "request" + type.capitalize(), data)
            return true
        }
    }
}