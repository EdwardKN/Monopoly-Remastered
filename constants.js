const latestSaveVersion = 2;

const settings = [
    {
        title: "Ge alla skattepengar till fri parkering",
        type: "select",
        variable: "giveAllTaxToParking",
        start: false
    },
    {
        title: "Ge alla bankpengar till fri parkering",
        type: "select",
        variable: "giveAllToParking",
        needed: "giveAllTaxToParking",
        start: false
    },
    {
        title: "Dubbel hyra på komplett färggrupp",
        type: "select",
        variable: "doublePay",
        start: true
    },
    {
        title: "Auktioner",
        type: "select",
        variable: "auctions",
        start: true
    },
    {
        title: "Få/förlora pengar i fängelset",
        type: "select",
        variable: "prisonpay",
        start: true
    },
    {
        title: "Möjlighet att inteckna",
        type: "select",
        variable: "canMortgage",
        start: true
    },
    {
        title: "Jämn utbyggnad",
        type: "select",
        variable: "evenHouses",
        start: true
    },
    {
        title: "Endast köpa hus på den man står på",
        type: "select",
        variable: "houseOnStanding",
        start: false
    },
    {
        title: "Startkapital: ",
        type: "slider",
        variable: "startMoney",
        start: 1400,
        unit: "kr",
        from: 0,
        to: 3000,
        steps: 100
    },
    {
        title: "Antal varv innan köp: ",
        type: "slider",
        variable: "roundsBeforePurchase",
        start: 0,
        from: 0,
        to: 5,
        steps: 1
    },
    {
        title: "Lägsta bud på auktioner(% av gatupris): ",
        type: "slider",
        variable: "lowestAuction",
        start: 50,
        from: 0,
        to: 100,
        steps: 10,
        unit: "%"
    },
    {
        title: "Max antal hus: ",
        type: "slider",
        variable: "maxHouses",
        start: 32,
        from: 1,
        to: 88,
        steps: 1
    },
    {
        title: "Max antal hotell: ",
        type: "slider",
        variable: "maxHotels",
        start: 12,
        from: 1,
        to: 22,
        steps: 1
    }
]

const playerInfo = [
    {
        color: "red",
        img: "player",
        ownedImg: "redowned"
    },
    {
        color: "pink",
        img: "player2",
        ownedImg: "pinkowned"
    },
    {
        color: "purple",
        img: "player3",
        ownedImg: "purpleowned"
    },
    {
        color: "blue",
        img: "player4",
        ownedImg: "blueowned"
    },
    {
        color: "lightblue",
        img: "player5",
        ownedImg: "lightblueowned"
    },
    {
        color: "green",
        img: "player6",
        ownedImg: "greenowned"
    },
    {
        color: "yellow",
        img: "player7",
        ownedImg: "yellowowned"
    },
    {
        color: "orange",
        img: "player8",
        ownedImg: "orangeowned"
    }
]

const specialCards = [
    {
        img: "gatillfinkanS"
    },
    {
        img: "illegaldices"
    },
    {
        img: "payincometax"
    },
    {
        img: "payrichtax"
    }
]

const communitycards = [
    {
        teleport: 0,
        img: "gatillstartc"
    },
    {
        type: "gotoprison",
        img: "gatillfinkanc"
    },
    {
        properyPrice: {
            house: 40,
            hotel: 115
        },
        img: "betalahushotellc"
    },
    {
        type: "getprisoncard",
        img: "lamnafinkangratisc"
    },
    {
        moneyFromPlayers: 10,
        img: "fa10kravallaandraspelarec"
    },
    {
        moneyFromPlayers: 50,
        img: "fa50kravallaandraspelarec"
    },
    {
        moneyChange: 10,
        img: "fa10krc"
    },
    {
        moneyChange: 20,
        img: "fa20krc"
    },
    {
        moneyChange: 50,
        img: "fa50krc"
    },
    {
        moneyChange: 100,
        img: "fa100krc"
    },
    {
        moneyChange: 200,
        img: "fa200krc"
    },
    {
        moneyChange: -25,
        img: "forlora25krc"
    },
    {
        moneyChange: -50,
        img: "forlora50krc"
    }
]
const chanceCards = [
    {
        properyPrice: {
            house: 25,
            hotel: 100
        },
        img: "betalahushotell"
    },
    {
        moneyChange: 50,
        img: "fa50kr"
    },
    {
        moneyFromPlayers: 50,
        img: "fa50kravallaandraspelare"
    },
    {
        moneyChange: 150,
        img: "fa150kr"
    },
    {
        steps: -3,
        img: "gabaktresteg"
    },
    {
        type: "gotoprison",
        img: "gatillfinkan"
    },
    {
        teleport: 24,
        img: "gatillhassleholm"
    },
    {
        teleport: 39,
        img: "gatillmalmo"
    },
    {
        gotoClosest: "Utility",
        img: "gatillnarmstaanlaggning"
    },
    {
        gotoClosest: "Station",
        img: "gatillnarmstatagstation"
    },
    {
        teleport: 11,
        img: "gatillsimrishamn"
    },
    {
        teleport: 5,
        img: "gatillsodrastationen"
    },
    {
        teleport: 0,
        img: "gatillstart"
    },
    {
        type: "getprisoncard",
        img: "lamnafinkangratis"
    }
]
const pieces = [
    {
        name: "Start",
        img: "go"
    },
    {
        name: "Sjöbo",
        price: 60,
        rent: [2, 10, 30, 90, 160, 250],
        housePrice: 50,
        group: "brown",
        img: "brown",
        mortgaged: "mortgaged",
        card: "browncard1",
        color: "#795548"
    },
    {
        name: "Allmänning",
        type: "community chest",
        img: "chest"
    },
    {
        name: "Eslöv",
        price: 60,
        rent: [4, 20, 60, 180, 320, 450],
        housePrice: 50,
        group: "brown",
        img: "brown",
        mortgaged: "mortgaged",
        card: "browncard2",
        color: "#795548"
    },
    {
        name: "Inkomstskatt",
        type: "income tax",
        img: "incometax",
    },
    {
        name: "Södra stationen",
        price: 200,
        rent: [25, 50, 100, 200],
        type: "station",
        img: "train",
        mortgaged: "trainmortgaged",
        card: "southstation",
        color: "black"
    },
    {
        name: "Hörby",
        price: 100,
        rent: [6, 30, 90, 270, 400, 550],
        housePrice: 50,
        group: "light blue",
        img: "light_blue",
        mortgaged: "mortgaged",
        card: "lightbluecard1",
        color: "#81d4fa"
    },
    {
        name: "Chans",
        type: "chance",
        img: "chance3"
    },
    {
        name: "Höör",
        price: 100,
        rent: [6, 30, 90, 270, 400, 550],
        housePrice: 50,
        group: "light blue",
        img: "light_blue",
        mortgaged: "mortgaged",
        card: "lightbluecard2",
        color: "#81d4fa"
    },
    {
        name: "Furulund",
        price: 120,
        rent: [8, 40, 100, 300, 450, 600],
        housePrice: 50,
        group: "light blue",
        img: "light_blue",
        mortgaged: "mortgaged",
        card: "lightbluecard3",
        color: "#81d4fa"
    },
    {
        name: "fängelse",
        img: "prison"
    },
    {
        name: "Simrishamn",
        price: 140,
        rent: [10, 50, 150, 450, 625, 750],
        housePrice: 100,
        group: "pink",
        img: "pink",
        mortgaged: "mortgaged",
        card: "pinkcard1",
        color: "#e91e63"
    },
    {
        name: "Elverket",
        price: 150,
        type: "utility",
        img: "electric",
        mortgaged: "electricmortgaged",
        card: "electricitycard",
        color: "black"
    },
    {
        name: "Svedala",
        price: 140,
        rent: [10, 50, 150, 450, 625, 750],
        housePrice: 100,
        group: "pink",
        img: "pink",
        mortgaged: "mortgaged",
        card: "pinkcard3",
        color: "#e91e63"
    },
    {
        name: "Staffanstorp",
        price: 160,
        rent: [12, 60, 180, 500, 700, 900],
        housePrice: 100,
        group: "pink",
        img: "pink",
        mortgaged: "mortgaged",
        card: "pinkcard2",
        color: "#e91e63"
    },
    {
        name: "Östra Stationen",
        price: 200,
        rent: [25, 50, 100, 200],
        type: "station",
        img: "train",
        mortgaged: "trainmortgaged",
        card: "eaststation",
        color: "black"
    },
    {
        name: "Lomma",
        price: 180,
        rent: [14, 70, 200, 550, 750, 950],
        housePrice: 100,
        group: "orange",
        img: "orange",
        mortgaged: "mortgaged",
        card: "orangecard1",
        color: "#ffa000"
    },
    {
        name: "Allmänning",
        type: "community chest",
        img: "chest"
    },
    {
        name: "Kävlinge",
        price: 180,
        rent: [14, 70, 200, 550, 750, 950],
        housePrice: 100,
        group: "orange",
        img: "orange",
        mortgaged: "mortgaged",
        card: "orangecard2",
        color: "#ffa000"
    },
    {
        name: "Vellinge",
        price: 200,
        rent: [16, 80, 220, 600, 800, 1000],
        housePrice: 100,
        group: "orange",
        img: "orange",
        mortgaged: "mortgaged",
        card: "orangecard3",
        color: "#ffa000"
    },
    {
        name: "Fri parkering",
        img: "parking"
    },
    {
        name: "Båstad",
        price: 220,
        rent: [18, 90, 250, 700, 875, 1050],
        housePrice: 150,
        group: "red",
        img: "red",
        mortgaged: "mortgaged",
        card: "redcard1",
        color: "#e51c23"
    },
    {
        name: "Chans",
        type: "chance",
        img: "chance"
    },
    {
        name: "Höganäs",
        price: 220,
        rent: [18, 90, 250, 700, 875, 1050],
        housePrice: 150,
        group: "red",
        img: "red",
        mortgaged: "mortgaged",
        card: "redcard2",
        color: "#e51c23"
    },
    {
        name: "Hässleholm",
        price: 240,
        rent: [20, 100, 300, 750, 925, 1100],
        housePrice: 150,
        group: "red",
        img: "red",
        mortgaged: "mortgaged",
        card: "redcard3",
        color: "#e51c23"
    },
    {
        name: "Centralstationen",
        price: 200,
        rent: [25, 50, 100, 200],
        type: "station",
        img: "train",
        mortgaged: "trainmortgaged",
        card: "centralstation",
        color: "black"
    },
    {
        name: "Ystad",
        price: 260,
        rent: [22, 110, 330, 800, 975, 1150],
        housePrice: 150,
        group: "yellow",
        img: "yellow",
        mortgaged: "mortgaged",
        card: "yellowcard1",
        color: "#ffeb3b"
    },
    {
        name: "Ängelholm",
        price: 260,
        rent: [22, 110, 330, 800, 975, 1150],
        housePrice: 150,
        group: "yellow",
        img: "yellow",
        mortgaged: "mortgaged",
        card: "yellowcard2",
        color: "#ffeb3b"
    },
    {
        name: "Vattenledningsverket",
        price: 150,
        type: "utility",
        img: "water",
        mortgaged: "watermortgaged",
        card: "waterworkscard",
        color: "black"
    },
    {
        name: "Trelleborg",
        price: 280,
        rent: [24, 120, 360, 850, 1025, 1200],
        housePrice: 150,
        group: "yellow",
        img: "yellow",
        mortgaged: "mortgaged",
        card: "yellowcard3",
        color: "#ffeb3b"
    },
    {
        name: "Gå till finkan",
        img: "gotoprison"
    },
    {
        name: "Landskrona",
        price: 300,
        rent: [26, 130, 390, 900, 1100, 1275],
        housePrice: 200,
        group: "green",
        img: "green",
        mortgaged: "mortgaged",
        card: "greencard1",
        color: "#42bd41"
    },
    {
        name: "Kristianstad",
        price: 300,
        rent: [26, 130, 390, 900, 1100, 1275],
        housePrice: 200,
        group: "green",
        img: "green",
        mortgaged: "mortgaged",
        card: "greencard2",
        color: "#42bd41"
    },
    {
        name: "Allmänning",
        type: "community chest",
        img: "chest"
    },
    {
        name: "Lund",
        price: 320,
        rent: [28, 150, 450, 1000, 1200, 1400],
        housePrice: 200,
        group: "green",
        img: "green",
        mortgaged: "mortgaged",
        card: "greencard3",
        color: "#42bd41"
    },
    {
        name: "Norra stationen",
        price: 200,
        rent: [25, 50, 100, 200],
        type: "station",
        img: "train",
        mortgaged: "trainmortgaged",
        card: "northstation",
        color: "black"
    },
    {
        name: "Chans",
        type: "chance",
        img: "chance2"
    },
    {
        name: "Helsingborg",
        price: 350,
        rent: [35, 175, 500, 1100, 1300, 1500],
        housePrice: 200,
        group: "blue",
        img: "blue",
        mortgaged: "mortgaged",
        card: "bluecard1",
        color: "#0288d1"
    },
    {
        name: "Lyxskatt",
        tax: 100,
        img: "supertax",
        type: "supertax"
    },
    {
        name: "Malmö",
        price: 400,
        rent: [50, 200, 600, 1400, 1700, 2000],
        housePrice: 200,
        group: "blue",
        img: "blue",
        mortgaged: "mortgaged",
        card: "bluecard2",
        color: "#0288d1"
    }
]