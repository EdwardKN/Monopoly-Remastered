function generateId(length) {
    const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let id = ""
    for (let _ = 0; _ < length; _++) { 
        id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    }
    return id
}

var con
function createHost() {
    const peer = new Peer(generateId(6), { debug: 1 })
    peer.connections = {}
    peer.length = 0

    peer.on('connection', x => {
        let id = x.peer
    
        x.on('open', () => {
            console.log("Id: ", x.peer)
            peer.connections[id] = { connection: peer.connect(id), id: peer.length + 1 }
        })
        
        x.on('close', () => {
            
        })
    
        x.on('data', (response) => {
            console.log(response)
            if (response.type === 'nameChange') {
                console.log("Hi")
            }
        })
    })
    
    return peer
}

function connectToHost(hostId) {
    let id = generateId(6)
    const peer = new Peer(id, { debug: 1 })

    peer.on('connection', x => {
        x.on('open', () => {
            console.log("Hi")
        })

        x.on('close', () => {

        })

        x.on('data', (response) => {
            console.log(x)
        })
    })
    con = peer.connect(hostId)
    return peer
}
