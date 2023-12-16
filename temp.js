function createConfirmButton(i) {
    return new Button({
        x: 370,
        y: 82 + 48 * i,
        w: 40,
        h: 40,
        disabled: true,
        disableDisabledTexture: true
    }, images.buttons.yes, (forced = false) => {
        let player = currentMenu.players[currentMenu.playersPlaying]
        for (let p of currentMenu.players) if (p.client === peer.id) player = p
        let text = player.textInput.htmlElement

        if (currentMenu.hosting && !text.disabled) {
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
    })
}

function createSpectatorButton() {
    return new Button({ x: 370, y: 20, w: 40, h: 40, selectButton: true, disableDisabledTexture: true }, images.buttons.bot, () => {
        if (currentMenu.playersPlaying >= 8) return

        let player = currentMenu.players[currentMenu.playersPlaying] // New player?
        for (let p of currentMenu.players) if (p.client === peer.id) player = p // Already a player?
        let state = currentMenu.spectatorButton.selected

        player.colorButton.disabled = state
        player.textInput.htmlElement.disabled = state
        player.textInput.htmlElement.style.backgroundColor = state ? "" : "white"

        if (state) {
            if (currentMenu.hosting) removeHTMLPlayer(currentMenu.peer.id)
            else delete player.confirmButton
            player.textInput.htmlElement.value = ""
            player.selectedColor = -1
            removeColor(player.selectedColor)
        } else {
            if (currentMenu.hosting) addHTMLPlayer(currentMenu.peer.id)
            else player.confirmButton = createConfirmButton(currentMenu.playersPlaying)
        }
            

        if (currentMenu.hosting) sendMessageToAll()
        else sendMessage(currentMenu.peer.connection, "spectator", state)
    })
}


function removeHTMLPlayer(id) {
    currentMenu.playersPlaying--

    for (let i = 0; i < currentMenu.players.length; i++) {
        let player = currentMenu.players[i]
        if (player.client !== id) continue

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
        }, images.buttons.sellbutton, () => removeClient(id))
    }

    newPlayer.textInput.htmlElement.style.backgroundColor = 'white'
    newPlayer.client = id
    currentMenu.playersPlaying++
}

function changeSelection(id, selected) {
    for (let player of currentMenu.players) {
        if (player.client !== id) continue

        if (selected) {

        } else {
            removeColor(data.color)
            player.textInput.htmlElement.style.backgroundColor = 'white'
            sendMessageToAll("selectedColors", currentMenu.selectedColors)
        }
    }
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
    if (currentMenu.currentMenu) player.colorButton.onClick() // Resize the width on htmlElements
}