var board;
var players = [];
var currentMenu;
var turn = 0;
var hoverList = [];

let colorsToPick = [0,1,2,3,4,5,6,7];

async function init() {
    fixCanvas();
    await loadImages(images);
    
   currentMenu = new MainMenu();
    update();
};

function startGame(playersToStartGameWith){
    board = new Board();

    playersToStartGameWith.forEach(player => {
        if(player.color != -1){
            players.push(new Player(player.color,player.name));
        }else{
            addRandomPlayer(player.name);
        }
    })

    board.calculateNameFontSize();

}

function addRandomPlayer(name){
    let random = randomIntFromRange(0,colorsToPick.length-1);
    players.push(new Player(colorsToPick[random],name));
    colorsToPick.splice(random,1);
}

function update(){
    requestAnimationFrame(update);
    
    renderC.clearRect(0, 0, renderCanvas.width, renderCanvas.height)
    c.clearRect(0, 0, canvas.width, canvas.height);

    textInputs.forEach(e =>{
        e.htmlElement.style.display = "none"
    })
    
    board?.update();
    players.forEach(e => e.draw());
    currentMenu?.draw();

    hoverList.forEach((e,i) => {
        c.drawText(e,mouse.x,mouse.y+35*(i+1)- 10,20,"center","black",{color:"white",blur:5});
    })
    hoverList = [];
    

    c.drawText(fps, 5, 80,20)

    renderC.imageSmoothingEnabled = false;
    renderC.drawImage(canvas, 0, 0, renderCanvas.width, renderCanvas.height);

    let tmp = false;
    buttons.forEach(e => {
        if (e.hover && !e.disabled) {
            tmp = true;
        }
        e.hover = false;
    });
    board?.boardPieces.forEach(e => {
        if(e.hover){
            tmp = true;
        };
        e.hover = false;
    });
    players.forEach(e => {
        if(e.hover){
            tmp = true;
        };
        e.hover = false;
    });
    

    if (tmp === true) {
        renderCanvas.style.cursor = "pointer"
    } else {
        renderCanvas.style.cursor = "auto"
    }
}
class MainMenu{
    constructor(){
        this.localButton = new Button({x:35,y:160,w:195,h:52},images.buttons.local,function(){currentMenu = new LobbyMenu()});
        this.loadButton = new Button({x:35,y:240,w:195,h:52},images.buttons.load);
        this.onlineButton = new Button({x:35,y:320,w:195,h:52},images.buttons.online,function(){currentMenu = new PublicGames()});
        this.creditsButton = new Button({x:35,y:400,w:195,h:52},images.buttons.credits);
    }
    draw(){
        c.drawImageFromSpriteSheet(images.menus.mainmenu)

        this.localButton.update();
        this.loadButton.update();
        this.onlineButton.update();
        this.creditsButton.update();
    }
}
class PublicGames{
    constructor(){
        this.backButton = new Button({x:10,y:10,w:325,h:60},images.buttons.back,function(){currentMenu = new MainMenu()});
        this.joinID = new TextInput({x:340,y:10,w:150,h:60,maxLength:6,textSize:45,placeHolder:"ID"})
        this.joinButton = new Button({x:500,y:10,w:195,h:52,disableDisabledTexture:true},images.buttons.joingame,function(){currentMenu = new OnlineLobby(false)});
        this.hostButton = new Button({x:750,y:10,w:195,h:52},images.buttons.hostgame,function(){currentMenu = new OnlineLobby(true)});

    }
    draw(){
        c.drawImageFromSpriteSheet(images.menus.lobbymenu);
        this.joinButton.disabled = this.joinID.value?.length < 6;
        this.backButton.update();
        this.joinID.draw();
        this.joinButton.update();
        this.hostButton.update();
    }
}
class OnlineLobby{
    constructor(host){
        this.hosting = host;
        this.backButton = new Button({x:10,y:10,w:325,h:60},images.buttons.back,function(){currentMenu = new PublicGames()});
    }
    draw(){
        c.drawImageFromSpriteSheet(images.menus.lobbymenu);
        this.backButton.update();
    }
}
class LobbyMenu{
    constructor(){
        let self = this;

        this.backButton = new Button({x:10,y:10,w:325,h:60},images.buttons.back,function(){currentMenu = new MainMenu()});
        this.startButton = new Button({x:10 + 100,y:canvas.height-70,w:194,h:60},images.buttons.start,function(){
            let tmp = [];
            self.players.filter(e => e.textInput.value.length > 1).forEach(e => {
                tmp.push({
                    name: e.textInput.value,
                    color: e.selectedColor
                })
            })
            startGame(tmp);
            currentMenu = undefined;
        });

        this.currentMenu = undefined;

        this.players = [];
        this.selectedColors = [];
        this.initPlayers();
    }
    initPlayers(){
        let self = this;
        for(let i = 0; i<8; i++){
            this.players.push(
                {
                    textInput: new TextInput({x:10,y:80 + 48*i,w:300,h:40, maxLength:15}),
                    colorButton: new Button({x:320,y:82+48*i,w:40,h:40, selectButton:true,disableSelectTexture:true},images.playercolorbuttons.unselected,function(){
                        self.players.forEach((e,index) => {
                            if(index != i){e.colorButton.selected = false;}else{
                                self.players.forEach((b) => {
                                    b.textInput.w = 300;
                                })
                                if(index >= 4){
                                    self.currentMenu = e.colorButton.selected ? new ColorSelector(320 - 30-40,-62+48*(i+1),e,self.selectedColors) : undefined;
                                   
                                    if(self.currentMenu){
                                        self.players[index-1].textInput.w = 230;
                                        self.players[index-2].textInput.w = 230;
                                    }
                                }else{
                                    self.currentMenu = e.colorButton.selected ? new ColorSelector(320 - 30-40,82+48*(i+1),e,self.selectedColors) : undefined;
                                    
                                    if(self.currentMenu){
                                        self.players[index+1].textInput.w = 230;
                                        self.players[index+2].textInput.w = 230;
                                    }
                                }
                            }
                        }); 
                    }),
                    selectedColor:-1,
                    botButton:new Button({x:370,y:82+48*i,w:40,h:40, selectButton:true},images.buttons.bot)
                }
            );
        }
    }
    draw(){
        let self = this;
        c.drawImageFromSpriteSheet(images.menus.lobbymenu);
        this.backButton.update();
        this.selectedColors = this.players.map(e => e.selectedColor).filter(e => e != -1);
        this.players.forEach(player =>{
            player.textInput.draw();
            player.colorButton.image = images.playercolorbuttons[(player.selectedColor == -1 ? "unselected" : "playercolorbutton" + (player.selectedColor == 0 ? "" : player.selectedColor+1))]
            if(self.currentMenu?.hover){
                player.colorButton.draw();
                player.botButton.draw();
            }else{
                player.colorButton.update();
                player.botButton.update();
            }
        })
        this.currentMenu?.draw();

        let readyPlayers = this.players.filter(e => e.textInput.value.length > 1);
        this.startButton.disabled = (readyPlayers.length < 2 || hasDuplicates(readyPlayers.map(e => e.textInput.value)))
        this.startButton.update();
        
    }   
}

class ColorSelector{
    constructor(x,y,player,selectedColors){
        this.x = x;
        this.y = y;
        this.w = 180,
        this.h = 90;
        this.colorButtons = [];
        this.hover = false;     
        this.selectedColors = selectedColors;

        this.initColors();   
        this.player = player;
    }
    initColors(){
        let self = this;
        for(let i = 0; i<8; i++){
            this.colorButtons.push(new Button({x:this.x + splitPoints(4,180,40,i%4),y:this.y + splitPoints(2,90,40,Math.floor(i/4)),w:40,h:40, selectButton:true},images.playercolorbuttons["playercolorbutton" + (i == 0 ? "" : i+1)],function(){
                self.colorButtons.forEach((e,index) => {
                    if(index != i){e.selected = false}else{
                        if(e.selected){
                            if(self.player.selectedColor != -1){
                                self.selectedColors.splice(self.selectedColors.indexOf(self.player.selectedColor))
                            }
                            self.player.selectedColor = i;
                            self.selectedColors.push(i);
                        }else{
                            self.selectedColors.splice(self.selectedColors.indexOf(self.player.selectedColor))
                            self.player.selectedColor = -1;
                        }
                    };
                })
                self.colorButtons.forEach((e,index) => {
                    e.disabled = self.player?.selectedColor != index && self.selectedColors?.length > 0 && (self.selectedColors?.indexOf(index) != -1)
                })
            }))
            this.colorButtons[i].disabled = self.player?.selectedColor != -1 && this.selectedColors?.length > 0 && (this.selectedColors?.indexOf(i) != -1)
        }
        
    }
    draw(){
        this.hover = detectCollision(this.x,this.y,this.w,this.h,mouse.x,mouse.y,1,1)
        if(!this.hover && mouse.down){
            mouse.down = false;
            currentMenu.players.forEach(e => {e.colorButton.selected = false;e.textInput.w = 300});
            currentMenu.currentMenu = undefined;
        }
        c.fillStyle = "black";
        c.fillRect(this.x,this.y,this.w,this.h)
        this.colorButtons.forEach(e => e.update());
    }
}

class SmallMenu{
    constructor(){
        this.leaveButton = new Button({x:canvas.width/2 - 120 + splitPoints(5,240,40,1), y:canvas.height/2 + 25, w:40, h:40, hoverText: "Stäng ruta",invertedHitbox:{x:canvas.width/2 - 128, y: canvas.height/2 - 128,w:256,h:256}},images.buttons.no,function(){currentMenu = undefined});
        this.statButton = new Button({x:canvas.width/2 - 120 + splitPoints(5,240,40,2), y:canvas.height/2 + 25, w:40, h:40, hoverText: "Visa Statistik"},images.buttons.statbutton);
        this.exitButton = new Button({x:canvas.width/2 - 120 + splitPoints(5,240,40,3), y:canvas.height/2 + 25, w:40, h:40, hoverText: "Återvänd till Huvudmenyn"},images.buttons.yes,function(){
            board = undefined;
            players = [];
            currentMenu = new MainMenu();

        });
        this.antiAliasingButton = new Button({x:canvas.width/2 - 120 + splitPoints(5,240,40,0), y:canvas.height/2 + 75, w:40, h:40, hoverText: "Antialiasing"},images.buttons.antilising);
        this.fullScreenButton = new Button({x:canvas.width/2 - 120 + splitPoints(5,240,40,1), y:canvas.height/2 + 75, w:40, h:40, hoverText: "Fullskärm"},images.buttons.fullscreen);
        this.muteButton = new Button({x:canvas.width/2 - 120 + splitPoints(5,240,40,4), y:canvas.height/2 + 75, w:40, h:40, hoverText: "Tysta ljudet"},images.buttons.music);

        this.volumeSlider = new Slider({x:canvas.width/2 - 120 + splitPoints(5,240,40,2), y:canvas.height/2 + 75, w:80, h:40,from:0,to:100,textSize:25,unit:"%"})
    }
    draw(){
        c.drawImageFromSpriteSheet(images.menus.exitmenu,{x:canvas.width/2 - 128, y: canvas.height/2 - 128})
        this.leaveButton.update();
        this.statButton.update();
        this.exitButton.update();
        this.antiAliasingButton.update();
        this.fullScreenButton.update();
        this.muteButton.update();
        this.volumeSlider.update();
    }
}

class Board{
    constructor(){
        this.boardPieces = [];
        this.dices = new Dice();
        this.playerHasRolled = false;
        this.playerIsWalking = false;

        this.rollDiceButton = new Button({x:canvas.width/2 - 123,y:canvas.height/2,w:246,h:60},images.buttons.rolldice,this.rollDice)
        this.nextPlayerButton = new Button({x:canvas.width/2 - 123,y:canvas.height/2,w:246,h:60},images.buttons.nextplayer,this.nextPlayer);

        this.menuButton = new Button({x:canvas.width/2 - 40, y: canvas.height-40, w:80,h:40},images.buttons.menu,function(){currentMenu = new SmallMenu()})

        this.init();
    }
    rollDice(){
        players[turn].rollDice();
        board.playerHasRolled = true;
    }
    nextPlayer(){
        players[turn].rolls = 0;
        turn++;
        turn = turn%players.length;
        board.playerHasRolled = false;
        if(players[turn].inPrison){
            currentMenu = new PrisonMenu(); 
        }
        board.calculateNameFontSize();
    }
    getColorGroup(group){
        return this.boardPieces.filter(e => e?.info?.group == group);
    }
    init(){
        for (let n = 0; n < 40; n++) {
            if (n % 10 === 0) {
                this.boardPieces.push(new Corner(n))
            } else {
                if(pieces[n].price){
                    if(pieces[n].type == "utility"){
                        this.boardPieces.push(new Utility(n))
                    }else if(pieces[n].type == "station"){
                        this.boardPieces.push(new Station(n))
                    }else{
                        this.boardPieces.push(new BuyableProperty(n))
                    }
                }else{
                    if(pieces[n].type == "community chest"){
                        this.boardPieces.push(new Community(n))
                    }else if(pieces[n].type == "chance"){
                        this.boardPieces.push(new Chance(n))
                    }else if(pieces[n].type == "income tax"){
                        this.boardPieces.push(new IncomeTax(n))
                    }else if(pieces[n].type == "supertax"){
                        this.boardPieces.push(new SuperTax(n))
                    }else{
                        this.boardPieces.push(new BoardPiece(n))
                    }
                }
            }
        }
        this.boardPieces.push(new Prison());
    }
    calculateNameFontSize(){
        let textsize = measureText({ font: "verdanai", text: "Just nu:" + players[turn].name})
        this.nameFontSize = (1 / textsize.width) * 22000 > 30 ? 30 : (1 / textsize.width) * 22000
    }
    update(){
        this.drawBack();

        this.boardPieces.forEach(e => e.draw());

        this.boardPieces.forEach(e => {if(e.owner && e.constructor.name == "BuyableProperty") e.drawHouses()})
        this.boardPieces.forEach(e => {if(e.hover){hoverList.push(e.info.name + (e.owner !== undefined ? "(" + e.owner.name + ")" : ""))}});

        c.drawText("Just nu:" + players[turn].name,canvas.width/2,30,this.nameFontSize,"center", players[turn].info.color)

        this.dices.draw();

        
        if(this.dices.hidden && !currentMenu && !this.playerIsWalking){
            this.menuButton.update();
            if(!this.playerHasRolled){
                this.rollDiceButton.update();
            }else{
                this.nextPlayerButton.update();
            }
        }

    }
    drawBack(){
        for (let x = -2; x < 2; x++) {
            for (let y = -2; y < 2; y++) {
                let coords = to_screen_coordinate(x, y)
                c.drawImageFromSpriteSheet(images.static.realbackground,{x:canvas.width/2 + 832*coords.x - 416,y:canvas.height/2 + 832*coords.y - 208})
            }
        }
        c.drawImageFromSpriteSheet(images.static.insideboard,{x:canvas.width/2-286,y:canvas.height/2 - 143})
    }
}

class PrisonMenu{
    constructor(){
        this.payButton = new Button({x:canvas.width/2 - 138 + splitPoints(3,276,82,0),y:canvas.height/2 + 50,w:82,h:35},images.buttons.prisonpay,function(){
            players[turn].money -= 50;
            players[turn].getOutOfPrison();
            currentMenu = undefined;
        });
        this.rollDiceButton = new Button({x:canvas.width/2 - 138 + splitPoints(3,276,82,1),y:canvas.height/2 + 50,w:82,h:35},images.buttons.prisonrolldice,function(){
            board.dices.roll(function(dice1, dice2){
                if(dice1 == dice2){
                    players[turn].getOutOfPrison();
                    players[turn].teleportTo(players[turn].pos + dice1 + dice2);
                }else{
                    board.playerHasRolled = true;
                    board.dices.hidden = true;
                    players[turn].rollsInPrison ++;
                    if(players[turn].rollsInPrison == 3){
                        players[turn].getOutOfPrison();
                        players[turn].rollsInPrison = 0;
                        
                    }
                }
            })
            currentMenu = undefined;
        });
        this.cardButton = new Button({x:canvas.width/2 - 138 + splitPoints(3,276,82,2),y:canvas.height/2 + 50,w:82,h:35},images.buttons.prisongetoutofjail,function(){
            players[turn].getOutOfPrison();
            currentMenu = undefined;
        });
    }
    draw(){
        c.drawImageFromSpriteSheet(images.menus.prisonmenu,{x:canvas.width/2 - 150, y:canvas.height/2 + 5})

        this.payButton.disabled = (players[turn].money < 50)
        this.cardButton.disabled = (players[turn].prisonCards == 0)

        this.payButton.update();
        this.rollDiceButton.update();
        this.cardButton.update();
    }
}

class Prison{
    constructor(){
        this.drawX = 128 * 4 + 60;
        this.drawY = 64 * 6 - 4;    
    }
    draw(){

    }
}

class BoardPiece{
    constructor(n){
        this.n = n;
        this.info = pieces[n];
        this.playersOnBoardPiece = [];

        this.calculateDrawPos();
    }

    calculateDrawPos(){
        this.drawX = 0;
        this.drawY = 0;
        this.textureStart = 0;
        if (Math.floor(this.n/10) === 0) {
            this.drawX = 128 * 9 - this.n * 64 + 94;
            this.drawY = 64 * 6 + 29;
            this.textureStart = 0;
        }
        if (Math.floor(this.n/10) === 1) {
            this.drawX = 128 * 4 + 60;
            this.drawY = 64 * 6 - (this.n-10)*64 - 4;
            this.textureStart = 96*3;
            if(this.n % 10 == 0){
                this.drawX -= 32;
                this.drawY += 32;
            }
        }
        if (Math.floor(this.n/10) === 2) {
            this.drawX = 128 * 4 + (this.n-20) * 64 + 94;
            this.drawY = 64 * 6 + 29 - 64*11;
            this.textureStart = 96;
            if(this.n % 10 == 0){
                this.drawX -= 64;
            }
        }
        if (Math.floor(this.n/10) === 3) {
            this.drawX = 128 * 4 + 60 + 64*11;
            this.drawY = - 64 * 4 + (this.n-30)*64 - 4;
            this.textureStart = 96*2;
            if(this.n % 10 == 0){
                this.drawX -= 32;
                this.drawY -= 32;
            }
        }
    }

    draw(){
        let isometricMouse = {x: to_grid_coordinate(mouse.x,mouse.y).x, y: to_grid_coordinate(mouse.x,mouse.y).y}
        this.hover = (this.info.price && !currentMenu && board.dices.hidden && ((Math.floor(this.n/10) === 0 || Math.floor(this.n/10) === 2) && isometricMouse.x > this.drawX + 64 && isometricMouse.x < this.drawX + 128 && isometricMouse.y > this.drawY - 64 && isometricMouse.y < this.drawY + 64 ||
        (Math.floor(this.n/10) === 1 || Math.floor(this.n/10) === 3) && isometricMouse.x > this.drawX + 32 && isometricMouse.x < this.drawX + 128 + 32 && isometricMouse.y > this.drawY-32 && isometricMouse.y < this.drawY + 32
        ));
        if(this.hover && mouse.down){
            mouse.down = false;
            this.openCard();
        }
        
        let img = !this.mortgaged ? images.plates[this.info.img] : images.plates[this.info.mortgaged];
        c.drawIsometricImage(img,{
            x:this.drawX,
            y:this.drawY,
            w:96,
            cropW:96,
            cropX:this.textureStart,
            offsetY:(this.hover ? 1 : 0)
        })
        if(this.owner !== undefined){
            c.drawIsometricImage(images.players[this.owner.info.ownedImg],{
                x:this.drawX + (Math.floor(this.n/10) === 2 ? -12 : 0),
                y:this.drawY,
                w:96,
                cropW:96,
                cropX:this.textureStart,
                offsetY:(this.hover ? 1 : 0)
            })
        }
    }
}

class Corner extends BoardPiece{
    draw(){
        c.drawIsometricImage(images.corners[this.info.img],{
            x:this.drawX,
            y:this.drawY,
            w:128,
            cropW:128,
            cropX:0,
            offsetY:(this.hover ? 1 : 0)
        })
    }
    step(){
        if(this.n == 30){
            currentMenu = new CardDraw("special", 0,function(){    
                players[turn].goToPrison();
            })
        }
    }
}

class BuyableProperty extends BoardPiece{
    constructor(n){
        super(n)
        this.owner = undefined;
        this.level = 0;
        this.mortgaged = false;
    }
    calculateHouseDrawPos(){
        if (Math.floor(this.n/10) === 0) {
            this.houseDrawX = this.drawX+32;
            this.houseDrawY = this.drawY-64;
            this.houseModX = 14;
            this.houseModY = 0;
            this.houseType = 0;
        }
        if (Math.floor(this.n/10) === 1) {
            this.houseDrawX = this.drawX + 104;
            this.houseDrawY = this.drawY - 36;
            this.houseModX = 0;
            this.houseModY = 14;
            this.houseType = 1;
        }
        if (Math.floor(this.n/10) === 2) {
            this.houseDrawX = this.drawX + 74;
            this.houseDrawY = this.drawY + 30;
            this.houseModX = -14;
            this.houseModY = 0;
            this.houseType = 2;
        }
        if (Math.floor(this.n/10) === 3) {
            this.houseDrawX = this.drawX + 12;
            this.houseDrawY = this.drawY - 40;
            this.houseModX = 0;
            this.houseModY = 14;
            this.houseType = 3;
        }
    }
    drawHouses(){
        this.calculateHouseDrawPos()
        if(this.level < 5){
            for(let i = 0; i < this.level; i++){
                c.drawIsometricImage(images.buildings.house,{
                    x:this.houseDrawX + this.houseModX*i,
                    y:this.houseDrawY + this.houseModY*i,
                    w:24,
                    h:24,
                    cropW:24,
                    cropH:24,
                    cropX:this.houseType*24,
                    cropY:0
                });
            }
        }else{
            c.drawIsometricImage(images.buildings.hotel,{
                x:this.houseDrawX+ this.houseModX*2,
                y:this.houseDrawY+ this.houseModY*2,
                w:24,
                h:24,
                cropW:24,
                cropH:24,
                cropX:(this.houseType%2)*24,
                cropY:0
            });
        }
    }
    openCard(){
        currentMenu = new PropertyCard(this.n);
    }
    step(){
        if(this.owner == undefined){
            this.openCard();
        }else if(this.owner != players[turn] && !this.mortgaged){
            this.payRent();
        }
    }
    buy(){
        players[turn].money -= this.info.price;
        this.owner = players[turn];
        players[turn].ownedPlaces.push(this);
    }
    sell(){
        players[turn].money += this.mortgaged ? 0 : this.info.price/2;
        this.owner = undefined;
        players[turn].ownedPlaces.splice(players[turn].ownedPlaces.indexOf(this),1);
    }
    upgrade(){
        this.level++;
        players[turn].money -= this.info.housePrice;
    }
    mortgage(){
        this.mortgaged = !this.mortgaged;
        players[turn].money += (this.mortgaged ? this.info.price / 2 : -(this.info.price/2)*1.1)
    }
    downgrade(){
        this.level--;
        players[turn].money += this.info.housePrice/2;
    }
    payRent(){
        this.owner.money += this.info.rent[this.level];
        players[turn].money -= this.info.rent[this.level];
    }
}
class Station extends BuyableProperty{
    step(){
        if(this.owner == undefined){
            this.openCard();
        }else if(this.owner != players[turn]){
            this.level = (this.owner.ownedPlaces.filter(e => e.constructor.name == "Station").length)-1;
            this.payRent();
        }
    }
}
class Utility extends BuyableProperty{
    step(steps){
        if(this.owner == undefined){
            this.openCard();
        }else if(this.owner != players[turn]){
            let amount = this.owner.ownedPlaces.filter(e => e.constructor.name == "Utility").length;
            if(steps == undefined){
                let self = this;
                board.dices.roll(function(dice1,dice2){
                    self.pay(dice1+dice2,amount);
                    board.dices.hidden = true;
                })
            }else{
                this.pay(steps,amount)
            }

        }
    }
    pay(steps,amount){
        let rent = steps * (amount == 1 ? 4 : 10);
        this.owner.money += rent;
        players[turn].money -= rent;
    }
}
class Community extends BoardPiece{
    step(){
        currentMenu = new CardDraw("community");
    }
}
class Chance extends BoardPiece{
    step(){
        currentMenu = new CardDraw("chance");
    }
}
class IncomeTax extends BoardPiece{
    step(){
        currentMenu = new CardDraw("special", 2,function(){
            players[turn].money -= (players[turn].money > 2000 ? 200 : Math.round(players[turn].money/10));
        })
    }
}
class SuperTax extends BoardPiece{
    step(){
        currentMenu = new CardDraw("special", 3,function(){
            players[turn].money -= 100;
        })
    }
}

class Auction{
    constructor(cardId){
        let self = this;
        this.boardPiece = board.boardPieces[cardId];
        this.startButton = new Button({x:canvas.width/2-256 + 28,y:canvas.height/2 + 80,w:220,h:40},images.buttons.startauction,function(){self.startAuction()})
        this.auctionMoney = 0;
        this.turn = turn;
        this.playerlist = [...players];
        this.calculateNameFontSize();
        if((this.playerlist[this.turn].money < this.auctionMoney+2) || this.playerlist[this.turn].money < this.boardPiece.info.price/2){
            this.leaveAuction();
        };
    }

    startAuction(){
        let self = this;
        this.started = true;
        this.add2 = new Button({x:canvas.width/2-256 + 28 + splitPoints(3,220,54,0),y:canvas.height/2 + 10,w:54,h:54},images.buttons["auction+2"],function(){self.addMoney(2)});
        this.add10 = new Button({x:canvas.width/2-256 + 28 + splitPoints(3,220,54,1),y:canvas.height/2 + 10,w:54,h:54},images.buttons["auction+10"],function(){self.addMoney(10)});
        this.add100 = new Button({x:canvas.width/2-256 + 28 + splitPoints(3,220,54,2),y:canvas.height/2 + 10,w:54,h:54},images.buttons["auction+100"],function(){self.addMoney(100)});
        this.leaveButton = new Button({x:canvas.width/2-256 + 28,y:canvas.height/2 + 80,w:220,h:40},images.buttons.exitauction,function(){self.leaveAuction()});
    };
    addMoney(amount){
        this.auctionMoney+=amount;
        if(this.auctionMoney >= this.boardPiece.info.price/2){
            this.playerlist[this.turn].hasLaidOver = true;
        }
        this.nextPlayer();
    };
    leaveAuction(){
        this.playerlist.splice(this.turn,1);
        if(this.playerlist.length == 1 && this.playerlist[0].hasLaidOver){
            this.winAuction(this.playerlist[0]);
        }else if(this.playerlist.length == 0){
            currentMenu = undefined;
        }else{
            this.nextPlayer();
        };
    };
    nextPlayer(){
        this.turn = (this.turn+1)%this.playerlist.length;
        console.log(this.playerlist.length == 1,this.playerlist[this.turn].hasLaidOver)
        if(this.playerlist.length == 1 && this.playerlist[this.turn].hasLaidOver){
            this.winAuction(this.playerlist[0]);
        }
        if((this.playerlist[this.turn].money < this.auctionMoney+2) || this.playerlist[this.turn].money < this.boardPiece.info.price/2){
            this.leaveAuction();
        };
    }
    winAuction(winner){
        let playerIndex = players.indexOf(winner);

        if(this.auctionMoney >= this.boardPiece.info.price/2){
            players[playerIndex].money -= this.auctionMoney;
            this.boardPiece.owner = players[playerIndex];
            players[playerIndex].ownedPlaces.push(this.boardPiece);
        };
        currentMenu = undefined;
    };

    calculateNameFontSize(){
        let textsize = measureText({ font: "verdanai", text: this.playerlist[turn].name})
        this.nameFontSize = (1 / textsize.width) * 20000 > 30 ? 30 : (1 / textsize.width) * 20000
    }
    draw(){
        c.drawImageFromSpriteSheet(images.cards[this.boardPiece.info.card],{x:canvas.width/2 - 10,y:canvas.height/2-162})
        c.drawImageFromSpriteSheet(images.menus.auctionmenubackground,{x:canvas.width/2-256 + 10,y:canvas.height/2-162})
        if(!this.started){
            this.startButton.update();
        }else{
            this.add100.disabled = (this.playerlist[this.turn].money < this.auctionMoney+100)
            this.add10.disabled = (this.playerlist[this.turn].money < this.auctionMoney+10)
            this.add2.update();
            this.add10.update();
            this.add100.update();
            this.leaveButton.update();
        }
        if(this.playerlist.length > 0){
            c.drawImageFromSpriteSheet(images.players[this.playerlist[this.turn].info.img],{x:canvas.width/2-220,y:canvas.height/2 - 90})

            c.drawText(this.playerlist[this.turn].name,canvas.width/2-190,canvas.height/2- 50,this.nameFontSize,"left",this.playerlist[this.turn].info.color)
    
            c.drawText(this.auctionMoney + "kr",canvas.width/2-118,canvas.height/2,30,"center", !this.started ? "black" : (this.auctionMoney < this.boardPiece.info.price/2) ? "red" : "green")
        }
    }
    

}

class Trade{
    constructor(player1,player2){
        this.player1 = player1;
        this.player2 = player2;

        this.closeButton = new Button({x:canvas.width/2 +455 - 22,y:canvas.height/2 - 256 + 4,w:18,h:18,invertedHitbox:{
            x:canvas.width/2 - 455, 
            y: canvas.height/2 - 256,
            w:910,
            h:512
        },disableHover:true},images.buttons.exitCard,this.closeTrade)

        this.player1MoneySlider = new Slider({x:canvas.width/2 -455 +30,y:100,w:400,h:20,from:0,to:this.player1.money,steps:10,unit:"kr"})
        this.player2MoneySlider = new Slider({x:canvas.width/2 +455 -430 ,y:100,w:400,h:20,from:0,to:this.player2.money,steps:10,unit:"kr"})

        this.player1Accept = new Button({x:canvas.width/2 - 455 + 205 - 55,y:460,w:150,h:50,selectButton:true},images.buttons.accept);
        this.player2Accept = new Button({x:canvas.width/2 - 455 + 900 - 455/2 - 55,y:460,w:150,h:50,selectButton:true},images.buttons.accept);
        this.initProperties();
    }
    initProperties(){
        let self = this;
        this.player1Properties = [];

        this.player1.ownedPlaces.forEach((place,i,amount) => {
            if(place.level == 0 || place.info.type == "station"){
                this.player1Properties.push({place:place,button:new Button({x:35 + splitPoints(2,440,186,(i%2)),y:130 + splitPoints(Math.ceil(amount.length/2),330,21,Math.floor(i/2)),w:186,h:21,textSize:15,text:place.info.name,color:place.info.color,selectButton:true},images.buttons.tradingcityname,function(){self.player1Accept.selected = false;self.player2Accept.selected = false;})})
            }
        })

        this.player2Properties = [];

        this.player2.ownedPlaces.forEach((place,i,amount) => {
            if(place.level == 0 || place.info.type == "station"){
                this.player2Properties.push({place:place,button:new Button({x:450 + 35 + splitPoints(2,440,186,(i%2)),y:130 + splitPoints(Math.ceil(amount.length/2),330,21,Math.floor(i/2)),w:186,h:21,textSize:15,text:place.info.name,color:place.info.color,selectButton:true},images.buttons.tradingcityname,function(){self.player1Accept.selected = false;self.player2Accept.selected = false;})})
            }
        })
    }
    draw(){
        c.drawImageFromSpriteSheet(images.menus.tradingmenu,{x:canvas.width/2 - 455, y: canvas.height/2 - 256})

        c.drawText(this.player1.name,canvas.width/2 - 455/2,70,30,"center")

        c.drawText(this.player2.name,canvas.width/2 - 455 + 900 - 455/2,70,30,"center")

        this.closeButton.update();
        this.player1MoneySlider.update();
        this.player2MoneySlider.update();

        this.player1Properties.forEach(e => e.button.update())
        this.player2Properties.forEach(e => e.button.update())

        this.player1Accept.update();
        this.player2Accept.update();

        if(this.player1Accept.selected && this.player2Accept.selected){
            this.acceptTrade();
        }

    }   
    acceptTrade(){
        let self = this;
        this.player1.money += this.player2MoneySlider.value;
        this.player2.money -= this.player2MoneySlider.value;

        this.player1.money -= this.player1MoneySlider.value;
        this.player2.money += this.player1MoneySlider.value;

        this.player1Properties.forEach(property => {
            if(property.button.selected){
                self.player1.ownedPlaces.splice(self.player1.ownedPlaces.indexOf(property.place),1);
                self.player2.ownedPlaces.push(property.place);
                property.place.owner = self.player2;
            }
        })
        this.player2Properties.forEach(property => {
            if(property.button.selected){
                self.player2.ownedPlaces.splice(self.player2.ownedPlaces.indexOf(property.place),1);
                self.player1.ownedPlaces.push(property.place);
                property.place.owner = self.player1;
            }
        })

        this.closeTrade();
    }
    closeTrade(){
        currentMenu = undefined;
    }
}

class CardDraw{
    constructor(type,cardId,onUse){
        this.type = type;
        if(this.type !== "special"){
            this.cardId = randomIntFromRange(0,(this.type == "community") ? 12 : 13)

            this.card = ((this.type == "community") ? communitycards[this.cardId] : chanceCards[this.cardId])
        }else{
            this.cardId = cardId;
            this.card = specialCards[this.cardId];
            this.onUse = onUse;
        }

        let self = this;
        this.okayButton = new Button({x:canvas.width/2 - 100,y:330,w:200,h:60,invertedHitbox:{x:canvas.width/2 - 256,y:canvas.height/2 - 128,w:512,h:256}},images.buttons.okej,function(){self.useCard()})

    }
    draw(){
        c.drawImageFromSpriteSheet(images["community card and chance card"][this.card.img],{x:canvas.width/2 - 256,y:canvas.height/2 - 128,w:512,h:256})

        this.okayButton.update();

    }
    useCard(){
        if(this.card.teleport !== undefined){
            players[turn].teleportTo(this.card.teleport);
        }else if(this.card.moneyChange){
            players[turn].money += this.card.moneyChange;
        }else if(this.card.moneyFromPlayers){
            players[turn].money += (this.card.moneyFromPlayers * players.length);
            players.forEach(e => {
                e.money -= this.card.moneyFromPlayers;
            });
        }else if(this.card.type == "getprisoncard"){
            players[turn].prisonCards++;
        }else if(this.card.type == "gotoprison"){
            players[turn].goToPrison();
        }else if(this.card.steps){
            players[turn].teleport((players[turn].pos + this.card.steps) * Math.sign(this.card.steps))
        }else if(this.card.gotoClosest){
            let self = this;
            let closest = findClosest(players[turn].pos,board.boardPieces.filter(e => e.constructor.name == self.card.gotoClosest).map(e => e.n))
            players[turn].teleportTo(closest * Math.sign(closest-players[turn].pos),true);
        }else if(this.card.properyPrice){
            let self = this;
            players[turn].ownedPlaces.forEach(place =>{
                if(place.level < 5){
                    players[turn].money -= self.card.properyPrice.house*place.level;
                }else{
                    players[turn].money -= self.card.properyPrice.hotel;
                }
            })
        }else if(this.onUse){
            this.onUse();
        }
        currentMenu = undefined;
    }
}

class PropertyCard{
    constructor(n){
        this.n = n;
        this.closeButton = new Button({x:590,y:108,w:18,h:18,invertedHitbox:{
            x:canvas.width/2 - 128,
            y:canvas.height/2 - 162,
            w:256,
            h:324
        },disableHover:true},images.buttons.exitCard,this.closeCard)
        
        let self = this;

        this.hasUpgradeButtons = !(board.boardPieces[this.n] instanceof Station || board.boardPieces[this.n] instanceof Utility);

        this.auctionButton = new Button({x:canvas.width/2 - 128+11 + splitPoints(2,234,97,0),y:canvas.height/2 + 100,w:97,h:40},images.buttons.auction,function(){players[turn].hasBought = true;currentMenu = new Auction(self.n)});
        this.buyButton = new Button({x:canvas.width/2 - 128+11 + splitPoints(2,234,97,1),y:canvas.height/2 + 100,w:97,h:40},images.buttons.buythislawn,function(){self.buyThis();});

        if(!this.hasUpgradeButtons){
            this.sellButton = new Button({x:canvas.width/2 - 128+11 + splitPoints(2,234,40,0),y:canvas.height/2 + 100,w:40,h:40,hoverText:"Sälj"},images.buttons.sellbutton,function(){self.sellThis()})
            this.mortgageButton = new Button({x:canvas.width/2 - 128+11 + splitPoints(2,234,40,1),y:canvas.height/2 + 100,w:40,h:40,hoverText:"Inteckna"},images.buttons.mortgage,function(){board.boardPieces[self.n].mortgage()})
        }else{
            this.sellButton = new Button({x:canvas.width/2 - 128+11 + splitPoints(4,234,40,0),y:canvas.height/2 + 100,w:40,h:40,hoverText:"Sälj"},images.buttons.sellbutton,function(){self.sellThis()})
            this.mortgageButton = new Button({x:canvas.width/2 - 128+11 + splitPoints(4,234,40,1),y:canvas.height/2 + 100,w:40,h:40,hoverText:"Inteckna"},images.buttons.mortgage,function(){board.boardPieces[self.n].mortgage()})
            this.downgradeButton = new Button({x:canvas.width/2 - 128+11 + splitPoints(4,234,40,2),y:canvas.height/2 + 100,w:40,h:40,hoverText:"Sälj Hus"},images.buttons.arrowdown,function(){board.boardPieces[self.indexToDowngrade].downgrade()})
            this.upgradeButton = new Button({x:canvas.width/2 - 128+11 + splitPoints(4,234,40,3),y:canvas.height/2 + 100,w:40,h:40,hoverText:"Köp Hus"},images.buttons.arrowup,function(){board.boardPieces[self.indexToUpgrade].upgrade()})
        }

    };
    buyThis(){
        board.boardPieces[this.n].buy()
        players[turn].hasBought = true;
        this.closeCard();
    }
    sellThis(){
        board.boardPieces[this.n].sell()
        this.closeCard();
    }
    
    calculateUpgrade(){
        let colorGroup = board.getColorGroup(board.boardPieces[this.n].info.group);

        if(colorGroup.length == colorGroup.filter(e => e.owner == players[turn]).length){
            if(players[turn].money < board.boardPieces[this.n].info.housePrice){
                return false;
            }else{
                let lowest = colorGroup.sort((a, b) => a.level - b.level)[0].level;
                if(lowest == 5){
                    return false;
                }
                if(board.boardPieces[this.n].level == lowest){
                    return this.n;
                }
                let propertyWithLowestLevel = colorGroup.filter(e => e.level == lowest);
                return propertyWithLowestLevel.sort((a,b) => b.n - a.n)[0].n;
            }
        }else{
            return false;
        }
    }
    calculateDowngrade(){
        let colorGroup = board.getColorGroup(board.boardPieces[this.n].info.group);
        if(colorGroup.length == colorGroup.filter(e => e.owner == players[turn]).length){
            let highest = colorGroup.sort((a, b) => b.level - a.level)[0].level;
            if(highest == 0){
                return false;
            };
            if(board.boardPieces[this.n].level == highest){
                return this.n;
            };
            let propertyWithHighestLevel = colorGroup.filter(e => e.level == highest);
            return propertyWithHighestLevel.sort((a,b) => a.n - b.n)[0].n;
        }else{
            return false;
        }

    }
    draw(){
        c.drawRotatedImageFromSpriteSheet(images.cards[pieces[this.n].card],{
            x:canvas.width/2 - 128,
            y:canvas.height/2 - 162
        });
        if(board.boardPieces[this.n].mortgaged){
            c.drawRotatedImageFromSpriteSheet(images.cards.mortgageoverlay,{
                x:canvas.width/2 - 128,
                y:canvas.height/2 - 162
            });
        }
        


        if(players[turn].pos === this.n && board.boardPieces[this.n].owner === undefined && !players[turn].hasBought){

            let self = this;
            this.buyButton.disabled = (players[turn].money < board.boardPieces[this.n].info.price);
            this.auctionButton.disabled = (players.filter(e => e.money >= board.boardPieces[self.n].info.price/2).length < 2);
            

            if(this.buyButton.disabled && this.auctionButton.disabled){
                this.closeButton.update();
            }

            this.buyButton.update();
            this.auctionButton.update();

        }else if(board.boardPieces[this.n].owner == players[turn]){
            this.closeButton.update();
            let colorGroup = board.getColorGroup(board.boardPieces[this.n].info.group);

            this.mortgageButton.disabled = (colorGroup.filter(e => e.level > 0).length) || (board.boardPieces[this.n].mortgaged ? !(players[turn].money >= (board.boardPieces[this.n].info.price/2)*1.1) : false)
            this.sellButton.disabled = (colorGroup.filter(e => e.level > 0).length);
            this.sellButton.update();
            this.mortgageButton.update();
            if(this.hasUpgradeButtons){
                this.indexToUpgrade = this.calculateUpgrade();
                this.indexToDowngrade = this.calculateDowngrade();
                this.upgradeButton.disabled = (players[turn].money < board.boardPieces[this.n].info.housePrice || !this.indexToUpgrade);
                this.downgradeButton.disabled = !this.indexToDowngrade;
                this.downgradeButton.update();
                this.upgradeButton.update();
            }
        }else{
            this.closeButton.update();
        }
    }
    closeCard(){
        currentMenu = undefined;
    };
}

class Player{
    constructor(color,name){
        this.color = color;
        this.pos = 0;
        this.money = 1400;
        this.ownedPlaces = [];
        this.name = name;
        this.prisonCards = 0;
        this.info = playerInfo[this.color];
        this.inPrison = false;
        this.rolls = 0;
        this.rollsInPrison = 0;
        this.hasBought = false;

        this.moneyShowerThing = new Money(this);

        this.calculateDrawPos();
    }
    calculateDrawPos(){
        let self = this;
        let playersAtPos = players.filter(e => e.pos == self.pos).length;

        this.drawX = board.boardPieces[this.pos].drawX;
        this.drawY = board.boardPieces[this.pos].drawY - 64;

        if(this.pos % 10 == 0){
            this.drawX += 32;
            if(Math.floor(this.pos/10) === 1){
                this.drawY += 48
            }
        }
        if(Math.floor(this.pos/10) === 0){
            this.drawY += 32*(playersAtPos-1)
        }
        if(Math.floor(this.pos/10) === 1){
            this.drawX -= 32*(playersAtPos-1)
        }
        if(Math.floor(this.pos/10) === 2){
            this.drawY -= 32*(playersAtPos-1)
        }
        if(Math.floor(this.pos/10) === 3){
            this.drawX += 32*(playersAtPos-1)
        }
        if(this.pos == 40){
            this.drawX += 32*(playersAtPos-1)
            this.drawY -= 32*(playersAtPos-1)
        }
    }

    draw(){
        let coord = to_screen_coordinate(this.drawX,this.drawY);    
        this.hover = (detectCollision(coord.x,coord.y,24,48,mouse.x,mouse.y,1,1) && !currentMenu && board.dices.hidden && !board.playerIsWalking);
        if(this.hover){hoverList.push(this.name + ((players[turn] !== this) ? "(Föreslå bytesförslag)" : "(Du)"))}
        if(this.hover && mouse.down && (players[turn] !== this)){
            this.moneyShowerThing.button.onClick();
            mouse.down = false;
        }

        c.drawIsometricImage(images.players[this.info.img],{
            x:this.drawX,
            y:this.drawY,
            offsetY:this.hover ? 1 : 0
        })
        this.moneyShowerThing.update();
    }

    teleportTo(newPos,noSteps){
        newPos = newPos%40;
        let direction = 1;
        if (newPos < 0) {
            direction = -1;
        };
        let self = this;
        
        this.animateSteps(Math.abs(newPos),direction,function(steps){
            if(board.boardPieces[self.pos]?.step){
                board.boardPieces[self.pos].step((noSteps ? undefined : steps));
            }
        });
    }
    animateSteps(newPos,direction,onStep){
        board.playerIsWalking = true;
        let self = this;
        let steps = newPos-self.pos;

        let timer = setInterval(() =>{
            self.pos += direction;
            self.pos = self.pos%40;
            self.calculateDrawPos();
            if(self.pos == 0 && !self.inPrison){
                self.money += 200;
            }
            if(self.pos == newPos){
                clearInterval(timer)
                board.dices.hidden = true;
                board.playerIsWalking = false;
                onStep(steps);
            };
        },250)
    }
    
    goToPrison(){
        let self = this;
        board.playerHasRolled = true;
        this.inPrison = true;
        this.animateSteps(10,1,function(){
            self.pos = 40;
            self.calculateDrawPos();
        });
    }
    getOutOfPrison(){
        this.pos = 10;
        this.calculateDrawPos();
        this.inPrison = false;
    }

    rollDice(){
        let self = this;
        this.hasBought = false;
        
        board.dices.roll(function(dice1,dice2){
            if(dice1 == dice2){
                board.playerHasRolled = false;
                self.rolls++;
                if(self.rolls == 3){
                    currentMenu = new CardDraw("special", 1,function(){
                        self.goToPrison();
                    })
                    return;
                }
            }
            self.teleportTo(self.pos + dice1 + dice2);
        })
    }
}
class Money{
    constructor(player){
        this.player = player;
        this.index = players.length
        this.calculateDrawPos();
        this.calculateNameFontSize();
    }
    calculateDrawPos(){
        this.side = this.index % 2;
        this.drawX = (this.side ? canvas.width-354 : 0)
        this.drawY = (this.index < 2 ? 0 : this.index < 4 ? canvas.height-54 : this.index < 6 ? 54 : canvas.height-54*2)

        let self = this;
        
        this.button = new Button({x:this.drawX,y:this.drawY,w:354,h:54,mirrored:!this.side,hoverText:"Föreslå bytesförslag",disableDisabledTexture:true},images.buttons.playerborder,function(){
            currentMenu = new Trade(players[turn],self.player)
        })
    }
    calculateNameFontSize(){
        let textsize = measureText({ font: "verdanai", text: this.player.name })
        this.nameFontSize = (1 / textsize.width) * 16000 > 30 ? 30 : (1 / textsize.width) * 16000
    }
    update(){
        this.button.disabled = (this.player == players[turn] || currentMenu);
        this.button.update();
        c.drawImageFromSpriteSheet(images.players[this.player.info.img],{x:(!this.side ? 3 : canvas.width - 3 - images.players.player.w),y:3 + this.drawY})
        
        c.drawText(this.player.name, this.drawX + (this.side ? 15 : 30), this.drawY + 36,this.nameFontSize,"left",this.player.info.color)
                
        c.drawText(this.player.money + "kr",this.drawX + (this.side ? 185 : 200), this.drawY + 36,30)
    }
}

class Dice{
    constructor(){
        this.dice1 = 1;
        this.dice2 = 1;
        this.dice1Type = 0;
        this.dice2Type = 0;
        this.hidden = true;
    }
    roll(callback){
        let self = this;

        this.hidden = false;
        
        let counter = 1;
        
        let rollAnimation = function(){
            if(counter < 500){
                self.randomizeDice();
                counter *= 1.2;
                setTimeout(rollAnimation,counter);
            }else{
                setTimeout(() => {
                    callback(self.dice1, self.dice2);
                }, 1000);
            }
            
        }
        rollAnimation();
    }
    randomizeDice(){
        this.dice1Type = randomIntFromRange(0, 3);
        this.dice2Type = randomIntFromRange(0, 3);
        this.dice1 = randomIntFromRange(1, 6);
        this.dice2 = randomIntFromRange(1, 6);
    }

    draw(){
        if(!this.hidden){
            c.drawIsometricImage(images.dices.dices,{
                x:950,
                y:200,
                cropX:this.dice1Type*64,
                cropY:(this.dice1-1)*64,
                cropW:64,
                cropH:64,
                w:64,
                h:64
            })
            c.drawIsometricImage(images.dices.dices,{
                x:1050,
                y:120,
                cropX:this.dice2Type*64,
                cropY:(this.dice2-1)*64,
                cropW:64,
                cropH:64,
                w:64,
                h:64
            })
        }
    }
}

init();