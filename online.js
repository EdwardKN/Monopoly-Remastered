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
        
        prevPlayer.textInput.htmlElement.value = player.textInput.htmlElement.value
        prevPlayer.selectedColor = player.selectedColor
        prevPlayer.textInput.htmlElement.setAttribute("placeHolder", player.textInput.htmlElement.getAttribute("placeHolder"))
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
    
    else if (color === -1) { valid = false; reason = "Must have a selected color" }
    
    else if (tempColors.includes(color)) { valid = false; reason = "Color is already taken" }
    
    else if (tempPlayers.some(p => p.textInput.htmlElement.style.backgroundColor === "" &&
        p.textInput.htmlElement.value === name)) { valid = false; reason = "Username is already taken" }

    return [valid, name, reason]
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
            setTimeout(() => { sendMessage(peer.clients[id].connection, "selectedColors", currentMenu.selectedColors); sendPlayers(peer, undefined, undefined, undefined, undefined) }, 1000)
        })
        
        x.on('close', () => {
            removeClient(peer, id)
        })
    
        x.on('data', (response) => {
            const client = peer.clients[id]
            const idx = getIndexFromObject(peer.clients, id) + 1
            const player = currentMenu.players[idx]
            const type = response.type
            const data = response.data
            console.log(response)

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

function sendPlayers(host, _client, text, color, selected) {
    let players = []
    let clients = Object.values(host.clients)

    let i = 0
    for (let player of currentMenu.players) {
        if (i > clients.length) continue

        players.push({
            name: (_client === player && text) ? text : player.textInput.value,
            color: (_client === player && color) ? color : player.selectedColor,
            placeHolder: player.textInput.htmlElement.getAttribute("placeHolder"),
            selected: (_client === player && selected) ? selected : player.textInput.htmlElement.disabled,
        })
        i++
    }
    for (let i = 0; i < clients.length; i++) {
        let client = clients[i].connection
        if (_client.connection === client) continue // Dont send to self

        let data = players.filter(p => p.placeHolder !== client.peer)
        sendMessage(client, "players", data)
    }
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
        })

        x.on("close", () => {
            console.log("Connection Lost")
            currentMenu = new PublicGames()
        })

        x.on("data", (response) => {
            const player = currentMenu.players[0]
            const type = response.type
            const data = response.data
            console.log(response)

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
                currentMenu.players.splice(1)
                currentMenu.initPlayers(data.length)

                for (let i = 1; i < data.length + 1; i++) {
                    let player = currentMenu.players[i]
                    let newPlayer = data[i - 1]
                    player.textInput.htmlElement.value = newPlayer.name
                    player.selectedColor = newPlayer.color
                    player.textInput.htmlElement.setAttribute("placeHolder", newPlayer.placeHolder)
                    if (player.selected) player.confirmButton.onClick(true)
                }
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