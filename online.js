const peer = new Peer(generateId(6), { debug: 1 })

function createHost() {
    peer.clients = {}

    window.onbeforeunload = () => Object.values(peer.clients).forEach(client => client.connection.close())

    peer.on('connection', x => {
        let id = x.peer

        x.on('open', () => {
            // Connnection
            peer.clients[id] = { connection: peer.connect(id) }

            waitForOpenConnection(peer.clients[id], () => {
                if (currentMenu instanceof OnlineJoinLobby) sendMessage(peer.clients[id].connection, "changeLobby")
                else sendMessage(peer.clients[id].connection, "selectedColors", currentMenu.selectedColors)
                sendPlayers()
            })

            if (currentMenu instanceof OnlineJoinLobby) return

            //console.log("Id: ", id, " connected")
            // HTML
            const idx = Object.entries(peer.clients).length
            const player = currentMenu.players[idx]
        })

        x.on('close', () => {
            if (currentMenu instanceof OnlineLobby) removeClient(id)
            else if (board instanceof OnlineBoard) {
                Object.values(peer.clients).forEach(client => client.connection.close())
                peer.clients = {}
                exitGame(true)
            }
        })

        x.on('data', (response) => {
            const client = peer.clients[id] //
            let player
            if (currentMenu instanceof OnlineLobby) for (let p of currentMenu.players) if (p.client === id) player = p
            const type = response.type
            const data = response.data
            console.log(response)

            // General
            if (type === "ready") addReady()
            if (type === "requestDiceRoll") board.rollDiceButton.onClick()
            if (type === "requestNextPlayer") board.nextPlayerButton.onClick()
            if (type === "requestCloseCard") currentMenu.okayButton.onClick()

            // Trade
            if (type === "requestAcceptTrade") currentMenu["player" + data + "Accept"].onClick()
            if (type === "requestCloseTrade") currentMenu?.closeTrade()
            if (type === "requestTradeSliderChange") currentMenu["player" + data.id + "MoneySlider"].onMouseUp(data.value)
            if (type === "requestTradeSelectProperty") currentMenu["player" + data.id + "Properties"][data.value].button.onClick()
            if (type === "requestNewTrade") {
                sendMessageToAll("newTrade", data)
                currentMenu = new Trade(data.player1, data.player2)
            }

            // Auction
            if (type === "requestStartAuction") new PropertyCard(data).auctionButton.onClick()
            if (type === "requestAuctionAddMoney") currentMenu.addMoney(data)
            if (type === "requestAuctionLeave") currentMenu.leaveAuction()

            // Prison
            if (type === "requestBuyPrison") new PrisonMenu().payButton.onClick()
            if (type === "requestRollPrison") new PrisonMenu().rollDiceButton.onClick()
            if (type === "requestPrisonCardPay") new PrisonMenu().cardButton.onClick()

            // Property
            if (type === "requestBuyProperty") board.boardPieces[data].buy()
            if (type === "requestSellProperty") board.boardPieces[data].sell()
            if (type === "requestMortgageProperty") board.boardPieces[data].mortgage()
            if (type === "requestUpgradeProperty") {
                let p = new PropertyCard(data)
                p.upgradeInfo = p.calculateUpgrade()
                p.upgradeButton.onClick()
                delete p
            }
            if (type === "requestDowngradeProperty") {
                let p = new PropertyCard(data)
                p.downgradeInfo = p.calculateDowngrade()
                p.downgradeButton.onClick()
                delete p
            }

            // Online Lobby
            if (type === "spectator") {
                let response = currentMenu.playersPlaying < 8
                if (data) removeHTMLPlayer(id)
                else if (response) addHTMLPlayer(id)
                sendMessage(client.connection, "spectatorValidation", data || response)
                sendPlayers()
            }
            if (type === "nameChange") { player.textInput.htmlElement.value = data; sendPlayers({ client: client, name: data }) }
            if (type === "colorChange") { player.selectedColor = data; sendPlayers({ client: client, color: data }) }
            if (type === "deselect") {
                removeColor(data.color)
                player.textInput.htmlElement.style.backgroundColor = "white"
                sendMessage(client.connection, "deselect")
                sendMessageToAll("selectedColors", currentMenu.selectedColors)
                sendPlayers({ client: client, selected: false })
            }
            if (type === "select") {
                let [valid, name, reason] = validPlayer(player, data.name, data.color)
                
                sendMessage(client.connection, "select", { valid: valid, name: name, reason: reason })
                if (!valid) return

                player.textInput.htmlElement.value = name
                player.textInput.htmlElement.style.backgroundColor = ""
                if (data.color !== -1) {
                    currentMenu.selectedColors.push(data.color)
                    if (currentMenu.currentMenu) currentMenu.currentMenu.selectedColors.push(data.color)
                }
                for (let p2 of currentMenu.players) if (p2 !== player && p2.selectedColor === data.color) p2.selectedColor = -1
                sendMessageToAll("selectedColors", currentMenu.selectedColors, [client])
                sendPlayers({ client: client, selected: true })
            }

            // Online Join Lobby
            if (type === "choosePlayer") {
                let player = currentMenu.players[data.index]
                if (!data.selected) {
                    player.confirmButton.image = images.buttons.yes
                    player.textInput.htmlElement.style.backgroundColor = "white"
                    player.confirmButton.disabled = currentMenu.selectedPlayer !== -1
                    sendMessageToAll("selectPlayer", data, [client])
                } else if (currentMenu.players[data.index].textInput.htmlElement.style.backgroundColor === "") {
                    sendMessage(client.connection, "invalidPlayer", data.index)
                } else {
                    player.confirmButton.image = images.buttons.no
                    player.textInput.htmlElement.style.backgroundColor = ""
                    player.confirmButton.disabled = true
                    sendMessageToAll("selectPlayer", data, [client])
                }
            }
        })
    })

    peer.on("error", error => {
        Object.values(peer.clients).forEach(client => client.connection.close())
        peer.clients = {}
        throw new Error(error.type)
    })
    return peer
}

function connectToHost(hostId) {
    const peer = new Peer(generateId(6), { debug: 1 })

    peer.on("open", id => {
        peer.connection = peer.connect(hostId)
        window.onbeforeunload = function () { peer.connection.close() }
    })

    peer.on("connection", x => {
        x.on("open", () => {
            //console.log("Connected to " + x.peer)
            //currentMenu.players[0].textInput.htmlElement.value = generateId(5) // TEMP
            //currentMenu.players[0].confirmButton.onClick() // TEMP
        })

        x.on("close", () => {
            //console.log("Connection Lost")
            delete peer
            if (board) exitGame(true, true)
            else currentMenu = new PublicGames()
        })

        x.on("data", (response) => {
            let player
            if (currentMenu instanceof OnlineLobby) player = currentMenu.players[0]
            const type = response.type
            const data = response.data
            console.log(response)

            // General
            if (type === "ready") board.ready = true
            if (type === "saveCardId") board.cardId = data
            if (type === "closeCard") currentMenu?.okayButton?.onClick(false)
            if (type === "startGame") {
                if (currentMenu instanceof OnlineJoinLobby) {
                    loadGame(data, currentMenu.selectedPlayer)
                } else {
                    startGame(data.players, data.settings)
                    turn = data.turn
                    players = riggedShuffle(players, data.riggedShuffle)
                    if (data.index !== undefined) players[data.index].playing = true
                    logger.log([{ color: players[turn].info.color, text: players[turn].name + "s" }, { color: "black", text: " tur" }]);
            }
            }
            if (type === "throwDices") {
                board.rollDice(data.dice1, data.dice2)
                resetReady()
            }
            if (type === "nextPlayer") {
                board.nextPlayer()
                resetReady()
            }
            // Trade
            if (type === "newTrade") currentMenu = new Trade(data.player1, data.player2)
            if (type === "acceptTrade") currentMenu["player" + data + "Accept"].onClick(false)
            if (type === "closeTrade") currentMenu?.closeTrade(false)
            if (type === "tradeSliderChange") currentMenu["player" + data.id + "MoneySlider"].onMouseUp(data.value, false)
            if (type === "tradeSelectProperty") currentMenu["player" + data.id + "Properties"][data.value].button.onClick(false)

            // Auction
            if (type === "auctionLeave") currentMenu.leaveAuction(false)
            if (type === "auctionAddMoney") currentMenu.addMoney(data, false)
            if (type === "startAuction") {
                new PropertyCard(data).auctionButton.onClick(false)
                resetReady()
            }

            // Prison
            if (type === "buyPrison") new PrisonMenu().payButton.onClick(false)
            if (type === "rollPrison") new PrisonMenu().rollDiceButton.onClick(false, data.rigged1, data.rigged2)
            if (type === "prisonCardPay") new PrisonMenu().cardButton.onClick(false)

            // Property
            if (type === "buyProperty") board.boardPieces[data].buy(false)
            if (type === "sellProperty") board.boardPieces[data].sell(false)
            if (type === "mortgageProperty") board.boardPieces[data].mortgage(false)
            if (type === "upgradeProperty") {
                let p = new PropertyCard(data)
                p.upgradeInfo = p.calculateUpgrade()
                p.upgradeButton.onClick(false)
                delete p
            }
            if (type === "downgradeProperty") {
                let p = new PropertyCard(data)
                p.downgradeInfo = p.calculateDowngrade()
                p.downgradeButton.onClick(false)
                delete p
            }

            // Lobby
            if (type === "spectatorValidation") {
                if (data) return
                let newState = !currentMenu.spectatorButton.selected
                player.colorButton.disabled = newState
                player.textInput.htmlElement.disabled = newState
                player.textInput.htmlElement.style.backgroundColor = newState ? "" : "white"
            }
            if (type === "deselect") {
                player.confirmButton.onClick(true)
            }
            if (type === "select") {
                if (!data.valid) {
                    if (data.reason === "Color is already taken") player.selectedColor = -1
                    alert(data.reason)
                } else {
                    player.textInput.htmlElement.value = data.name
                    player.confirmButton.onClick(true)
                }
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
                // Players
                let players = data.players
                let start = players.length === 8 ? 0 : 1

                if (currentMenu.spectatorButton.disabled) {
                    currentMenu.players[0].textInput.htmlElement.value = ""
                    currentMenu.players[0].selectedColor = -1
                }

                currentMenu.players.splice(start)
                currentMenu.initPlayers(players.length)
                currentMenu.spectatorButton.disabled = !start
                loadPlayers(players, start)

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
            return

            if (type === "selectPlayer") {
                let player = currentMenu.players[data.index]
                if (!player) return // Needed if players has not loaded yet

                player.confirmButton.image = data.selected ? images.buttons.no : images.buttons.yes
                player.confirmButton.disabled = ((data.selected || currentMenu.selectedPlayer !== -1) && data.index !== currentMenu.selectedPlayer)
                player.textInput.htmlElement.style.backgroundColor = data.selected ? "" : "white"
            }
            if (type === "invalidPlayer") {
                currentMenu.players[data].confirmButton.onClick(true)
            }
            if (type === "existingPlayers") {
                const players = data.players
                currentMenu.players = []
                currentMenu.initPlayers(players)

                //Object.values(data.settings).forEach((value, i) => {
                //    let length = settings.length
                //    let mainSetting = settings[i]
                //    let htmlSetting

                //    if (mainSetting.type === "select") {
                //        htmlSetting = new Button({ x: 450, y: splitPoints(length, canvas.height, 35, i), w: 500, h: 35, selectButton: true, text: mainSetting.title, textSize: c.getFontSize(mainSetting.title, 470, 32), color: "black", disableDisabledTexture: true }, images.buttons.setting, () => sendPlayers(this.peer))
                //        htmlSetting.selected = value
                //    } else if (mainSetting.type === "slider") {
                //        htmlSetting = new Slider({ x: 450, y: splitPoints(length, canvas.height, 35, i), w: 500, h: 35, from: mainSetting.from, to: mainSetting.to, unit: mainSetting.unit, steps: mainSetting.steps, beginningText: mainSetting.title }, () => sendPlayers(this.peer))
                //        htmlSetting.percentage = value / (mainSetting.to - mainSetting.from)
                //        htmlSetting.value = value
                //    }
                //    htmlSetting.disabled = true
                //    this.settings.push(htmlSetting)
                //})
            }
            if (type === "changeLobby") currentMenu = new OnlineJoinLobby(false, { id: hostId, client: peer })
        })
    })

    peer.on("error", error => {
        peer.connection.close()
        currentMenu = new PublicGames()
        throw new Error(error.type)
    })
    return peer
}

window.onload = () => {
    let id = new URLSearchParams(window.location.search).get("LobbyId")
    if (id) currentMenu = new OnlineLobby(false, id)
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