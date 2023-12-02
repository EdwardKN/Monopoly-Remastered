function generateId(length) {
    const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let id = ""
    for (let _ = 0; _ < length; _++) { 
        id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    }
    return id
}

function removeElementFromArray(arr, element) {
    return arr.filter(e => e !== element)
}

function sendMessage(connection, _type, _data) {
    connection.send({
        type: _type,
        data: _data
    })
}

function sendMessageToAll(clients, _type, _data) {
    for (let client of Object.values(clients)) sendMessage(client.connection, _type, _data)
}

function getIndexFromObject(obj, key) {
    let i = 0
    for (let k of Object.keys(obj)) {
        if (k === key) return i
        i++
    }
    return false
}



function changeColor(idx, from, to) {
    currentMenu.players[idx].selectedColor = to
    if (to === -1) return
    currentMenu.selectedColors = currentMenu.selectedColors.filter(e => e !== from)
    currentMenu.selectedColors.push(to)

    if (!currentMenu.currentMenu) return
    currentMenu.currentMenu.selectedColors.push(data)
    currentMenu.currentMenu.initColors()
}

function createHost() {
    const peer = new Peer(generateId(6), { debug: 1 })
    peer.clients = {}

    peer.on('connection', x => {
        let id = x.peer

        x.on('open', () => {
            console.log("Id: ", id, " connected")
            // HTML
            const length = Object.entries(peer.connections).length
            currentMenu.players[length].textInput.htmlElement.disabled = false
            currentMenu.players[length].colorButton.disabled = false

            // Connnection
            peer.clients[id] = { connection: peer.connect(id) }
            setTimeout(() => sendMessage(peer.clients[id].connection, 'selectedColors', currentMenu.selectedColors), 100)
        })
        
        x.on('close', () => {
            currentMenu.players[Object.entries(peer.connections).length + 1].textInput.htmlElement.disabled = true
            delete peer.clients[id]
        })
    
        x.on('data', (response) => {
            const client = peer.clients[id]
            const idx = getIndexFromObject(peer.clients, id) + 1 // + 1 is the host
            const type = response.type
            const data = response.data
            console.log(response)

            if (type === 'confirmName') {
                
            }
            if (type === 'nameChange') {
                currentMenu.players[idx].textInput.htmlElement.value = data
            }
            if (type === 'selectColor') {
                // Check if it is already taken
                if (currentMenu.selectedColors.includes(data.to)) { sendMessage(client.connection, 'invalidColor', data); return }

                changeColor(idx, data.from, data.to)
                sendMessageToAll(peer.clients, 'selectedColors', currentMenu.selectedColors)
            }
        })
    })

    return peer
}

function connectToHost(hostId) {
    let id = generateId(6)
    const peer = new Peer(id, { debug: 1 })

    peer.on('open', id => {
        peer.connection = peer.connect(hostId)
    })

    peer.on('connection', x => {
        x.on('open', () => {
            console.log("Connected to " + x.peer)
        })

        x.on('close', () => {

        })

        x.on('data', (response) => {
            const type = response.type
            const data = response.data
            console.log(response)

            if (type === 'invalidColor') {
                changeColor(0, data.to, data.from) // Reverse the action
            }

            if (type === 'selectedColors') {
                currentMenu.selectedColors = data
                if (currentMenu.currentMenu) {
                    currentMenu.currentMenu.selectedColors = data
                    currentMenu.currentMenu.initColors()
                }
            }
        })
    })

    peer.on('error', error => {
        if (error.type === 'peer-unavailable') currentMenu = new PublicGames()
    })
    return peer
}
